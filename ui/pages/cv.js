// CV Page — Computer Vision monitoring and analytics
import { html, useState, useEffect } from '../app.js';
import { ws, authFetch } from '../app.js';
import { Card, Badge } from '../components/base/index.js';

export default function CV() {
  const [cvData, setCvData] = useState({
    visitorsToday: 0,
    activeIdentities: 0,
    staffFiltered: 0,
    reidMatches: 0,
    zones: [],
    hourlyData: []
  });
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadCVData();
  }, []);

  // WebSocket updates
  useEffect(() => {
    const handleUpdate = (data) => {
      if (data.type === 'cv_update') {
        setCvData(prev => ({ ...prev, ...data.data }));
      }
    };

    ws.on('cv_update', handleUpdate);
    return () => ws.off('cv_update', handleUpdate);
  }, []);

  const loadCVData = async () => {
    try {
      const res = await authFetch('/api/cv/stats');
      if (res.ok) {
        const data = await res.json();
        setCvData(data);
      }
    } catch (err) {
      console.error('[CV] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return html`
      <div style="padding: 2rem; text-align: center;">
        <p style="color: var(--muted-foreground);">Carregando dados de CV...</p>
      </div>
    `;
  }

  const maxHourlyVisitors = Math.max(...cvData.hourlyData.map(d => d.count), 1);

  return html`
    <div style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
      <!-- Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 700;">Visão Computacional</h1>
        <p style="color: var(--muted-foreground); margin: 0; font-size: 0.875rem;">
          Monitoramento de visitantes e análise de fluxo
        </p>
      </div>

      <!-- Hero Stat -->
      <${Card} className="hero-stat" style="margin-bottom: 2rem; text-align: center; padding: 3rem 2rem;">
        <div style="font-size: 0.875rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem;">
          Visitantes Únicos Hoje
        </div>
        <div style="font-family: var(--font-mono); font-size: 4rem; font-weight: 700; color: var(--primary); line-height: 1;">
          ${cvData.visitorsToday}
        </div>
      <//>

      <!-- Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <${Card} status="ok">
          <div style="text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              Identidades Ativas
            </div>
            <div style="font-family: var(--font-mono); font-size: 2.5rem; font-weight: 700; color: var(--foreground);">
              ${cvData.activeIdentities}
            </div>
          </div>
        <//>
        
        <${Card} status="info">
          <div style="text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              Staff Filtrados
            </div>
            <div style="font-family: var(--font-mono); font-size: 2.5rem; font-weight: 700; color: var(--foreground);">
              ${cvData.staffFiltered}
            </div>
          </div>
        <//>
        
        <${Card} status="ok">
          <div style="text-align: center;">
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              ReID Matches
            </div>
            <div style="font-family: var(--font-mono); font-size: 2.5rem; font-weight: 700; color: var(--foreground);">
              ${cvData.reidMatches}
            </div>
          </div>
        <//>
      </div>

      <!-- Zone Grid -->
      ${cvData.zones.length > 0 && html`
        <div style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Zonas de Interesse</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
            ${cvData.zones.map(zone => html`
              <${Card} status=${zone.count > 0 ? 'ok' : 'muted'}>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-size: 1rem; font-weight: 600; margin: 0;">${zone.name}</h3>
                    ${zone.count > 0 && html`
                      <${Badge} label=${`${zone.count} pessoas`} variant="success" />
                    `}
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                    <span style="color: var(--muted-foreground);">Tempo médio:</span>
                    <span style="font-family: var(--font-mono); font-weight: 600;">
                      ${zone.dwellTime || '0'} min
                    </span>
                  </div>
                </div>
              <//>
            `)}
          </div>
        </div>
      `}

      <!-- Hourly Chart -->
      <${Card} title="Visitantes por Hora (Últimas 24h)">
        <div style="display: flex; align-items: flex-end; gap: 0.5rem; height: 200px; padding-top: 1rem;">
          ${cvData.hourlyData.length === 0 && html`
            <div style="width: 100%; text-align: center; color: var(--muted-foreground); font-size: 0.875rem;">
              Sem dados disponíveis
            </div>
          `}
          ${cvData.hourlyData.map(hour => {
            const barHeight = maxHourlyVisitors > 0 ? (hour.count / maxHourlyVisitors) * 100 : 0;
            return html`
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <div 
                  style="
                    width: 100%;
                    background: linear-gradient(180deg, var(--primary) 0%, var(--accent) 100%);
                    border-radius: var(--radius) var(--radius) 0 0;
                    height: ${barHeight}%;
                    min-height: ${hour.count > 0 ? '4px' : '0'};
                    transition: height 300ms ease;
                  "
                  title="${hour.count} visitantes às ${hour.hour}h"
                ></div>
                <div style="font-size: 0.625rem; color: var(--muted-foreground); font-family: var(--font-mono);">
                  ${hour.hour}h
                </div>
              </div>
            `;
          })}
        </div>
      <//>

      <!-- Live Counter Info -->
      <div style="margin-top: 1.5rem; padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); text-align: center;">
        <p style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground);">
          ⚡ Contador atualizado em tempo real via WebSocket
        </p>
      </div>
    </div>
  `;
}
