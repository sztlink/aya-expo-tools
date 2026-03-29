// CV Tools page — Computer Vision tools (Story 4-3)
import { html, useState, useEffect, ws, authFetch } from '../app.js';
import Card from '../components/card.js';
import SimpleChart from '../components/simple-chart.js';
import Badge from '../components/badge.js';

export default function CV() {
  const [summary, setSummary] = useState(null);
  const [reidStats, setReidStats] = useState(null);
  const [counterHistory, setCounterHistory] = useState([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, reidRes, historyRes] = await Promise.all([
          authFetch('/api/cv/daily/today/summary').catch(() => ({ json: () => ({ ok: false }) })),
          authFetch('/api/reid/stats').catch(() => ({ json: () => ({ ok: false }) })),
          authFetch('/api/cv/counter/history').catch(() => ({ json: () => ({ ok: false }) }))
        ]);
        
        const summaryData = await summaryRes.json();
        const reidData = await reidRes.json();
        const historyData = await historyRes.json();
        
        if (summaryData.ok) setSummary(summaryData.data);
        if (reidData.ok) setReidStats(reidData.data);
        if (historyData.ok) {
          setCounterHistory(historyData.data);
          // Set initial live count from latest history
          if (historyData.data && historyData.data.length > 0) {
            const latest = historyData.data[historyData.data.length - 1];
            setLiveCount(latest.total || 0);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch CV data:', err);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Listen to WebSocket updates
  useEffect(() => {
    const handleCvUpdate = (data) => {
      if (data.count !== undefined) {
        setLiveCount(data.count);
      }
    };

    ws.on('cv-update', handleCvUpdate);

    return () => {
      ws.off('cv-update', handleCvUpdate);
    };
  }, []);

  if (loading) {
    return html`
      <div>
        <h1>CV Tools</h1>
        <p style="color: var(--dimmed);">Loading...</p>
      </div>
    `;
  }

  // Transform counter history to chart data (hourly)
  const chartData = counterHistory.slice(0, 24).map((item, i) => ({
    label: item.hour || `${i}h`,
    value: item.total || 0
  }));

  // Calculate zone breakdown from summary
  const zones = summary?.zones || [];
  const totalVisitors = summary?.uniqueVisitors || liveCount;
  const staffFiltered = reidStats?.staffFiltered || 0;

  return html`
    <div>
      <h1>CV Tools</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        Computer vision metrics, visitor tracking, and re-identification.
      </p>

      <!-- Main Stats -->
      <div class="grid grid-3" style="margin-bottom: 2rem;">
        <${Card} title="Unique Visitors Today" status="ok">
          <div style="font-size: 3rem; font-weight: 700; color: var(--cyan);">
            ${totalVisitors}
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--dimmed);">
            Live count: ${liveCount}
          </div>
        <//>

        <${Card} title="Active Identities" status="info">
          <div style="font-size: 3rem; font-weight: 700; color: var(--purple);">
            ${reidStats?.activeIdentities || 0}
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--dimmed);">
            Re-ID tracking
          </div>
        <//>

        <${Card} title="Staff Filtered" status="info">
          <div style="font-size: 3rem; font-weight: 700; color: var(--orange);">
            ${staffFiltered}
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--dimmed);">
            Not counted as visitors
          </div>
        <//>
      </div>

      <!-- Hourly Flow Chart -->
      <${Card} title="Hourly Visitor Flow" status="info" style="margin-bottom: 2rem;">
        ${chartData.length > 0 
          ? html`<${SimpleChart} data=${chartData} height=${200} color="#00d9ff" />`
          : html`<p style="color: var(--dimmed); text-align: center; padding: 2rem;">No data available</p>`
        }
      <//>

      <!-- Zone Breakdown -->
      ${zones.length > 0 && html`
        <h2 style="margin-bottom: 1rem;">Zone Breakdown</h2>
        <div class="grid grid-2">
          ${zones.map(zone => html`
            <${Card} 
              title=${zone.name || zone.id} 
              status="info"
              badge=${{ label: `${zone.visitors || 0} visitors`, variant: 'info' }}
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 1.5rem; font-weight: 600;">
                    ${zone.visitors || 0}
                  </div>
                  <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.25rem;">
                    visitors
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 1.5rem; font-weight: 600; color: var(--purple);">
                    ${zone.avgDwellTime ? `${Math.round(zone.avgDwellTime)}s` : '—'}
                  </div>
                  <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.25rem;">
                    avg dwell time
                  </div>
                </div>
              </div>
            <//>
          `)}
        </div>
      `}

      <!-- ReID Details -->
      ${reidStats && html`
        <h2 style="margin-top: 2rem; margin-bottom: 1rem;">Re-Identification Stats</h2>
        <div class="grid grid-2">
          <${Card} title="Total Tracked" status="ok">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div>
                <strong>Unique Visitors:</strong> ${reidStats.uniqueVisitors || 0}
              </div>
              <div>
                <strong>Active IDs:</strong> ${reidStats.activeIdentities || 0}
              </div>
              <div>
                <strong>Staff Filtered:</strong> ${reidStats.staffFiltered || 0}
              </div>
            </div>
          <//>

          <${Card} title="Detection Quality" status="info">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div>
                <strong>Avg Confidence:</strong> ${reidStats.avgConfidence ? `${Math.round(reidStats.avgConfidence * 100)}%` : '—'}
              </div>
              <div>
                <strong>Re-identifications:</strong> ${reidStats.reidentifications || 0}
              </div>
              <div>
                <strong>Lost Tracks:</strong> ${reidStats.lostTracks || 0}
              </div>
            </div>
          <//>
        </div>
      `}
    </div>
  `;
}
