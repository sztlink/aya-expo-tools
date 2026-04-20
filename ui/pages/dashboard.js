// Dashboard Page — pragmatic local operational view
import { html, useState, useEffect } from '../app.js';
import { authFetch } from '../app.js';
import { Card, Badge, StatusDot, Button } from '../components/base/index.js';
import { ClusterCard } from '../components/composed/index.js';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function buildNextEvent(schedule) {
  if (!schedule?.todaySchedule) return 'Hoje fechado';
  return schedule.isOpen
    ? `Fechamento ${schedule.todaySchedule.close}`
    : `Abertura ${schedule.todaySchedule.open}`;
}

function deriveClusterStatus({ projectors, cameras, cvStatus, config, health, schedule }) {
  const projectorList = projectors?.data || [];
  const cameraList = cameras?.data || [];
  const onlineProjectors = projectorList.filter(p => p.online).length;
  const onlineCameras = cameraList.filter(c => c.online).length;
  const cv = cvStatus?.data || {};

  return {
    equipment: {
      status: onlineProjectors === projectorList.length && projectorList.length > 0 ? 'ok' : (onlineProjectors > 0 ? 'warn' : 'error'),
      metrics: [
        { label: 'Projetores online', value: `${onlineProjectors}/${projectorList.length}` },
        { label: 'Áudio', value: health?.tvs === 0 ? 'Local' : 'Ativo' },
      ]
    },
    cameras: {
      status: onlineCameras === cameraList.length && cameraList.length > 0 ? 'ok' : (onlineCameras > 0 ? 'warn' : 'error'),
      metrics: [
        { label: 'Câmeras online', value: `${onlineCameras}/${cameraList.length}` },
        { label: 'Preview', value: onlineCameras > 0 ? 'Disponível' : 'Indisponível' },
      ]
    },
    cv: {
      status: cv.enabled ? (cv.running ? 'ok' : 'warn') : 'info',
      metrics: [
        { label: 'Detectores', value: `${cv.cameras || 0}` },
        { label: 'Counter', value: cv.counter?.running ? 'Ativo' : 'Parado' },
      ]
    },
    data: {
      status: (health?.server?.disk?.pct ?? 0) < 85 ? 'ok' : 'warn',
      metrics: [
        { label: 'Disco C:', value: `${health?.server?.disk?.pct ?? 0}%` },
        { label: 'Livre', value: `${health?.server?.disk?.free ?? 0} GB` },
      ]
    },
    communication: {
      status: health?.internet ? 'ok' : 'warn',
      metrics: [
        { label: 'Internet', value: health?.internet ? 'Online' : 'Offline' },
        { label: 'Agenda', value: schedule?.jobCount ? `${schedule.jobCount} jobs` : 'Sem jobs' },
      ]
    }
  };
}

export default function Dashboard() {
  const [expoData, setExpoData] = useState(null);
  const [clusterStatus, setClusterStatus] = useState({
    equipment: { status: 'info', metrics: [] },
    cameras: { status: 'info', metrics: [] },
    cv: { status: 'info', metrics: [] },
    data: { status: 'info', metrics: [] },
    communication: { status: 'info', metrics: [] }
  });
  const [serverHealth, setServerHealth] = useState({ cpu: 0, gpu: 0, disk: 0, ram: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(loadDashboardData, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [healthRes, infoRes, projectorsRes, camerasRes, cvRes, scheduleRes] = await Promise.all([
        authFetch('/api/health'),
        authFetch('/api/info'),
        authFetch('/api/projectors'),
        authFetch('/api/cameras'),
        authFetch('/api/cv/status'),
        authFetch('/api/schedule')
      ]);

      const [health, info, projectors, cameras, cvStatus, scheduleWrap] = await Promise.all([
        healthRes.json(),
        infoRes.json(),
        projectorsRes.json(),
        camerasRes.json(),
        cvRes.json(),
        scheduleRes.json()
      ]);

      const schedule = scheduleWrap?.data || {};
      const exhibition = info?.exhibition || {};
      const isOpen = !!schedule.isOpen;

      setExpoData({
        name: exhibition.name || health.exhibition || 'Exposição',
        location: [exhibition.venue, exhibition.city].filter(Boolean).join(' · ') || 'Local não definido',
        period: exhibition.dates ? `${formatDate(exhibition.dates.open)} → ${formatDate(exhibition.dates.close)}` : 'Período não definido',
        status: isOpen ? 'aberta' : 'fechada',
        nextEvent: buildNextEvent(schedule),
      });

      setClusterStatus(deriveClusterStatus({ projectors, cameras, cvStatus, config: null, health, schedule }));
      setServerHealth({
        cpu: health?.server?.cpu ?? 0,
        gpu: health?.server?.gpus?.[0]?.temp ?? 0,
        disk: health?.server?.disk?.pct ?? 0,
        ram: health?.server?.ram?.pct ?? 0,
      });
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
      setError(err.message || 'Erro ao carregar dashboard');
      setExpoData(prev => prev || {
        name: 'AYA Expo Tools',
        location: 'Falha ao carregar',
        period: '—',
        status: 'fechada',
        nextEvent: 'Indisponível',
      });
    }
  };

  const handleOpenExpo = async () => {
    if (!confirm('Tem certeza que deseja abrir a exposição?')) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/schedule/open', { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao abrir exposição');
      await loadDashboardData();
    } catch (err) {
      console.error('[Dashboard] Failed to open expo:', err);
      alert('Erro ao abrir exposição');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseExpo = async () => {
    if (!confirm('Tem certeza que deseja fechar a exposição?')) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/schedule/close', { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao fechar exposição');
      await loadDashboardData();
    } catch (err) {
      console.error('[Dashboard] Failed to close expo:', err);
      alert('Erro ao fechar exposição');
    } finally {
      setLoading(false);
    }
  };

  if (!expoData) {
    return html`
      <div style="padding: 2rem; text-align: center;">
        <p style="color: var(--muted-foreground);">Carregando dashboard...</p>
      </div>
    `;
  }

  const isOpen = expoData.status === 'aberta';
  const statusVariant = isOpen ? 'success' : 'muted';

  return html`
    <div style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <h1 style="margin: 0; font-size: 2rem; font-weight: 700;">${expoData.name || 'Exposição'}</h1>
            <${Badge} label=${isOpen ? 'ABERTA' : 'FECHADA'} variant=${statusVariant} />
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <${StatusDot}
              status=${isOpen ? 'ok' : 'warn'}
              label=${isOpen ? 'Em Operação' : 'Fechada'}
              pulse=${isOpen}
            />
          </div>
        </div>
        <p style="color: var(--muted-foreground); margin: 0; font-size: 0.875rem;">
          ${expoData.location || 'Local não definido'} · ${expoData.period || 'Período não definido'}
        </p>
        ${error && html`
          <p style="margin: 0.75rem 0 0 0; color: var(--operacional); font-size: 0.875rem;">
            ${error}
          </p>
        `}
      </div>

      <${Card} className="quick-actions" style="margin-bottom: 2rem;">
        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <${Button}
            label="🟢 Abrir Exposição"
            variant=${isOpen ? 'secondary' : 'primary'}
            onClick=${handleOpenExpo}
            disabled=${loading || isOpen}
            loading=${loading}
            className="btn-large"
            style="flex: 1; min-width: 200px; font-size: 1rem; padding: 1rem 1.5rem;"
          />
          <${Button}
            label="🔴 Fechar Exposição"
            variant="destructive"
            onClick=${handleCloseExpo}
            disabled=${loading || !isOpen}
            loading=${loading}
            className="btn-large"
            style="flex: 1; min-width: 200px; font-size: 1rem; padding: 1rem 1.5rem;"
          />
          <div style="flex: 1; min-width: 200px; padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card);">
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
              Próximo Evento Automático
            </div>
            <div style="font-family: var(--font-mono); font-weight: 600; font-size: 0.875rem;">
              ${expoData.nextEvent || 'Nenhum agendado'}
            </div>
          </div>
        </div>
      <//>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <${ClusterCard}
          name="Equipamentos"
          status=${clusterStatus.equipment.status}
          icon="🎬"
          metrics=${clusterStatus.equipment.metrics}
          onClick=${() => location.href = '/config.html'}
        />
        <${ClusterCard}
          name="Câmeras"
          status=${clusterStatus.cameras.status}
          icon="📹"
          metrics=${clusterStatus.cameras.metrics}
          onClick=${() => location.href = '/config.html'}
        />
        <${ClusterCard}
          name="Visão Computacional"
          status=${clusterStatus.cv.status}
          icon="👁️"
          metrics=${clusterStatus.cv.metrics}
          onClick=${() => location.href = '/cv.html'}
        />
        <${ClusterCard}
          name="Dados"
          status=${clusterStatus.data.status}
          icon="💾"
          metrics=${clusterStatus.data.metrics}
          onClick=${() => location.href = '/server.html'}
        />
        <${ClusterCard}
          name="Comunicação"
          status=${clusterStatus.communication.status}
          icon="🔗"
          metrics=${clusterStatus.communication.metrics}
          onClick=${() => location.href = '/server.html'}
        />
      </div>

      <${Card} title="Saúde do Servidor" status=${serverHealth.cpu > 90 || serverHealth.gpu > 85 ? 'error' : serverHealth.cpu > 70 ? 'warn' : 'ok'}>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">CPU</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: ${serverHealth.cpu > 90 ? 'var(--destructive)' : serverHealth.cpu > 70 ? 'var(--operacional)' : 'var(--secondary)'};">
              ${serverHealth.cpu}%
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">GPU Temp</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: ${serverHealth.gpu > 85 ? 'var(--destructive)' : serverHealth.gpu > 75 ? 'var(--operacional)' : 'var(--secondary)'};">
              ${serverHealth.gpu}°C
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Disco</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: ${serverHealth.disk > 90 ? 'var(--destructive)' : serverHealth.disk > 80 ? 'var(--operacional)' : 'var(--secondary)'};">
              ${serverHealth.disk}%
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">RAM</div>
            <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: ${serverHealth.ram > 90 ? 'var(--destructive)' : serverHealth.ram > 80 ? 'var(--operacional)' : 'var(--secondary)'};">
              ${serverHealth.ram}%
            </div>
          </div>
        </div>
      <//>
    </div>
  `;
}
