// Dashboard Page — Leonardo's daily operational view
import { html, useState, useEffect } from '../app.js';
import { ws, authFetch } from '../app.js';
import { Card, Badge, StatusDot, Button } from '../components/base/index.js';
import { ClusterCard } from '../components/composed/index.js';

export default function Dashboard() {
  const [expoData, setExpoData] = useState(null);
  const [clusterStatus, setClusterStatus] = useState({
    equipment: { status: 'info', metrics: [] },
    cameras: { status: 'info', metrics: [] },
    cv: { status: 'info', metrics: [] },
    data: { status: 'info', metrics: [] },
    communication: { status: 'info', metrics: [] }
  });
  const [serverHealth, setServerHealth] = useState({
    cpu: 0,
    gpu: 0,
    disk: 0,
    ram: 0
  });
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  // WebSocket updates
  useEffect(() => {
    const handleUpdate = (data) => {
      if (data.type === 'cluster_status') {
        setClusterStatus(data.clusters || clusterStatus);
      }
      if (data.type === 'server_health') {
        setServerHealth(data.health || serverHealth);
      }
      if (data.type === 'expo_status') {
        setExpoData(data.expo || expoData);
      }
    };

    ws.on('cluster_status', handleUpdate);
    ws.on('server_health', handleUpdate);
    ws.on('expo_status', handleUpdate);

    return () => {
      ws.off('cluster_status', handleUpdate);
      ws.off('server_health', handleUpdate);
      ws.off('expo_status', handleUpdate);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const res = await authFetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setExpoData(data.expo);
        setClusterStatus(data.clusters || clusterStatus);
        setServerHealth(data.serverHealth || serverHealth);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
    }
  };

  const handleOpenExpo = async () => {
    if (!confirm('Tem certeza que deseja abrir a exposição?')) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/expo/open', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setExpoData(data.expo);
      }
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
      const res = await authFetch('/api/expo/close', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setExpoData(data.expo);
      }
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
      <!-- Header -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
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
      </div>

      <!-- Quick Action Bar -->
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

      <!-- Cluster Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <${ClusterCard}
          name="Equipamentos"
          status=${clusterStatus.equipment.status}
          icon="🎬"
          metrics=${clusterStatus.equipment.metrics}
          onClick=${() => location.hash = '/selftest'}
        />
        <${ClusterCard}
          name="Câmeras"
          status=${clusterStatus.cameras.status}
          icon="📹"
          metrics=${clusterStatus.cameras.metrics}
          onClick=${() => location.hash = '/selftest'}
        />
        <${ClusterCard}
          name="Visão Computacional"
          status=${clusterStatus.cv.status}
          icon="👁️"
          metrics=${clusterStatus.cv.metrics}
          onClick=${() => location.hash = '/cv'}
        />
        <${ClusterCard}
          name="Dados"
          status=${clusterStatus.data.status}
          icon="💾"
          metrics=${clusterStatus.data.metrics}
          onClick=${() => location.hash = '/archive'}
        />
        <${ClusterCard}
          name="Comunicação"
          status=${clusterStatus.communication.status}
          icon="🔗"
          metrics=${clusterStatus.communication.metrics}
        />
      </div>

      <!-- Server Health Bar -->
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
