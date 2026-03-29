// SelfTest Page — Equipment health checks for Leonardo
import { html, useState, useEffect } from '../app.js';
import { authFetch } from '../app.js';
import { Card, StatusDot, Button, Badge } from '../components/base/index.js';
import { SelftestItem } from '../components/composed/index.js';

export default function SelfTest() {
  const [checks, setChecks] = useState({
    equipamentos: [],
    cameras: [],
    cv: [],
    comunicacao: [],
    servidor: []
  });
  const [overallStatus, setOverallStatus] = useState('info');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    loadChecks();
  }, []);

  const loadChecks = async () => {
    try {
      const res = await authFetch('/api/selftest');
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks);
        setOverallStatus(data.overallStatus);
        setLastRun(data.lastRun);
      }
    } catch (err) {
      console.error('[SelfTest] Failed to load checks:', err);
    }
  };

  const runAllChecks = async () => {
    setRunning(true);
    try {
      const res = await authFetch('/api/selftest/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks);
        setOverallStatus(data.overallStatus);
        setLastRun(new Date().toISOString());
      }
    } catch (err) {
      console.error('[SelfTest] Failed to run checks:', err);
      alert('Erro ao executar verificações');
    } finally {
      setRunning(false);
    }
  };

  const getStatusMessage = () => {
    switch (overallStatus) {
      case 'ok': return '✅ Tudo Funcionando';
      case 'warn': return '⚠️ Atenção Necessária';
      case 'error': return '❌ Problemas Detectados';
      default: return 'ℹ️ Aguardando Verificação';
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'ok': return 'var(--secondary)';
      case 'warn': return 'var(--operacional)';
      case 'error': return 'var(--destructive)';
      default: return 'var(--muted-foreground)';
    }
  };

  const countByStatus = (items) => {
    return {
      ok: items.filter(i => i.status === 'ok').length,
      warn: items.filter(i => i.status === 'warn').length,
      error: items.filter(i => i.status === 'error').length
    };
  };

  return html`
    <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
      <!-- Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 700;">Auto-Diagnóstico</h1>
        <p style="color: var(--muted-foreground); margin: 0; font-size: 0.875rem;">
          Verificação automática de todos os sistemas da exposição
        </p>
      </div>

      <!-- Overall Status Banner -->
      <div style="
        padding: 2rem;
        margin-bottom: 2rem;
        border-radius: var(--radius);
        background: var(--card);
        border: 2px solid ${getStatusColor()};
        text-align: center;
      ">
        <div style="font-size: 2rem; font-weight: 700; color: ${getStatusColor()}; margin-bottom: 0.5rem;">
          ${getStatusMessage()}
        </div>
        ${lastRun && html`
          <div style="font-size: 0.875rem; color: var(--muted-foreground); font-family: var(--font-mono);">
            Última verificação: ${new Date(lastRun).toLocaleString('pt-BR')}
          </div>
        `}
      </div>

      <!-- Action Button -->
      <div style="margin-bottom: 2rem; text-align: center;">
        <${Button}
          label=${running ? 'Verificando...' : '🔄 Verificar Novamente'}
          variant="primary"
          onClick=${runAllChecks}
          disabled=${running}
          loading=${running}
          style="font-size: 1rem; padding: 1rem 2rem;"
        />
      </div>

      <!-- Check Groups -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- Equipamentos -->
        ${checks.equipamentos.length > 0 && html`
          <${Card} title="🎬 Equipamentos" status=${
            checks.equipamentos.some(c => c.status === 'error') ? 'error' :
            checks.equipamentos.some(c => c.status === 'warn') ? 'warn' : 'ok'
          }>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
              ${(() => {
                const stats = countByStatus(checks.equipamentos);
                return html`
                  ${stats.ok > 0 && html`<${Badge} label="${stats.ok} OK" variant="success" />`}
                  ${stats.warn > 0 && html`<${Badge} label="${stats.warn} Atenção" variant="warning" />`}
                  ${stats.error > 0 && html`<${Badge} label="${stats.error} Erro" variant="destructive" />`}
                `;
              })()}
            </div>
            <div>
              ${checks.equipamentos.map(check => html`
                <${SelftestItem}
                  name=${check.name}
                  status=${check.status}
                  detail=${check.detail}
                />
              `)}
            </div>
          <//>
        `}

        <!-- Cameras -->
        ${checks.cameras.length > 0 && html`
          <${Card} title="📹 Câmeras" status=${
            checks.cameras.some(c => c.status === 'error') ? 'error' :
            checks.cameras.some(c => c.status === 'warn') ? 'warn' : 'ok'
          }>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
              ${(() => {
                const stats = countByStatus(checks.cameras);
                return html`
                  ${stats.ok > 0 && html`<${Badge} label="${stats.ok} Online" variant="success" />`}
                  ${stats.warn > 0 && html`<${Badge} label="${stats.warn} Instável" variant="warning" />`}
                  ${stats.error > 0 && html`<${Badge} label="${stats.error} Offline" variant="destructive" />`}
                `;
              })()}
            </div>
            <div>
              ${checks.cameras.map(check => html`
                <${SelftestItem}
                  name=${check.name}
                  status=${check.status}
                  detail=${check.detail}
                />
              `)}
            </div>
          <//>
        `}

        <!-- CV -->
        ${checks.cv.length > 0 && html`
          <${Card} title="👁️ Visão Computacional" status=${
            checks.cv.some(c => c.status === 'error') ? 'error' :
            checks.cv.some(c => c.status === 'warn') ? 'warn' : 'ok'
          }>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
              ${(() => {
                const stats = countByStatus(checks.cv);
                return html`
                  ${stats.ok > 0 && html`<${Badge} label="${stats.ok} OK" variant="success" />`}
                  ${stats.warn > 0 && html`<${Badge} label="${stats.warn} Atenção" variant="warning" />`}
                  ${stats.error > 0 && html`<${Badge} label="${stats.error} Erro" variant="destructive" />`}
                `;
              })()}
            </div>
            <div>
              ${checks.cv.map(check => html`
                <${SelftestItem}
                  name=${check.name}
                  status=${check.status}
                  detail=${check.detail}
                />
              `)}
            </div>
          <//>
        `}

        <!-- Comunicacao -->
        ${checks.comunicacao.length > 0 && html`
          <${Card} title="🔗 Comunicação" status=${
            checks.comunicacao.some(c => c.status === 'error') ? 'error' :
            checks.comunicacao.some(c => c.status === 'warn') ? 'warn' : 'ok'
          }>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
              ${(() => {
                const stats = countByStatus(checks.comunicacao);
                return html`
                  ${stats.ok > 0 && html`<${Badge} label="${stats.ok} Conectado" variant="success" />`}
                  ${stats.warn > 0 && html`<${Badge} label="${stats.warn} Instável" variant="warning" />`}
                  ${stats.error > 0 && html`<${Badge} label="${stats.error} Desconectado" variant="destructive" />`}
                `;
              })()}
            </div>
            <div>
              ${checks.comunicacao.map(check => html`
                <${SelftestItem}
                  name=${check.name}
                  status=${check.status}
                  detail=${check.detail}
                />
              `)}
            </div>
          <//>
        `}

        <!-- Servidor -->
        ${checks.servidor.length > 0 && html`
          <${Card} title="💻 Servidor" status=${
            checks.servidor.some(c => c.status === 'error') ? 'error' :
            checks.servidor.some(c => c.status === 'warn') ? 'warn' : 'ok'
          }>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
              ${(() => {
                const stats = countByStatus(checks.servidor);
                return html`
                  ${stats.ok > 0 && html`<${Badge} label="${stats.ok} Normal" variant="success" />`}
                  ${stats.warn > 0 && html`<${Badge} label="${stats.warn} Atenção" variant="warning" />`}
                  ${stats.error > 0 && html`<${Badge} label="${stats.error} Crítico" variant="destructive" />`}
                `;
              })()}
            </div>
            <div>
              ${checks.servidor.map(check => html`
                <${SelftestItem}
                  name=${check.name}
                  status=${check.status}
                  detail=${check.detail}
                />
              `)}
            </div>
          <//>
        `}
      </div>
    </div>
  `;
}
