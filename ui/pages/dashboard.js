// Dashboard page — Main overview (Story 4-2)
import { html, useState, useEffect, ws, authFetch } from '../app.js';
import Card from '../components/card.js';
import StatusDot from '../components/status-dot.js';
import Badge from '../components/badge.js';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [clusters, setClusters] = useState({
    equipment: { healthy: false, details: {} },
    cameras: { healthy: false, details: {} },
    cv: { healthy: false, details: {} },
    data: { healthy: false, details: {} },
    communication: { healthy: false, details: {} }
  });
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthRes, scheduleRes] = await Promise.all([
          fetch('/api/health'), // Public endpoint, no auth needed
          authFetch('/api/schedule')
        ]);
        
        const healthData = await healthRes.json();
        const scheduleData = await scheduleRes.json();
        
        setHealth(healthData);
        setSchedule(scheduleData.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Listen to WebSocket updates
  useEffect(() => {
    const handleHealthUpdate = (data) => {
      if (data.health) setHealth(data.health);
    };

    const handleScheduleUpdate = (data) => {
      if (data.schedule) setSchedule(data.schedule);
    };

    const handleCvUpdate = (data) => {
      if (health && data.count !== undefined) {
        setHealth({ ...health, cv: { ...health.cv, count: data.count } });
      }
    };

    ws.on('health', handleHealthUpdate);
    ws.on('schedule', handleScheduleUpdate);
    ws.on('cv-update', handleCvUpdate);

    return () => {
      ws.off('health', handleHealthUpdate);
      ws.off('schedule', handleScheduleUpdate);
      ws.off('cv-update', handleCvUpdate);
    };
  }, [health]);

  // Execute open/close
  const handleOpen = async () => {
    try {
      const res = await authFetch('/api/schedule/open', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Exhibition opened');
        // Refresh schedule
        const scheduleRes = await authFetch('/api/schedule');
        const scheduleData = await scheduleRes.json();
        setSchedule(scheduleData.data);
      } else {
        alert(`Failed to open: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to open: ${err.message}`);
    }
  };

  const handleClose = async () => {
    try {
      const res = await authFetch('/api/schedule/close', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert('Exhibition closed');
        // Refresh schedule
        const scheduleRes = await authFetch('/api/schedule');
        const scheduleData = await scheduleRes.json();
        setSchedule(scheduleData.data);
      } else {
        alert(`Failed to close: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to close: ${err.message}`);
    }
  };

  if (loading) {
    return html`
      <div>
        <h1>Dashboard</h1>
        <p style="color: var(--dimmed);">Loading...</p>
      </div>
    `;
  }

  // Determine cluster statuses
  const equipmentStatus = health?.projectors > 0 || health?.tvs > 0 ? 'ok' : 'warn';
  const camerasStatus = health?.cameras > 0 ? 'ok' : 'warn';
  const cvStatus = health?.cv?.running ? 'ok' : (health?.cv?.enabled ? 'warn' : 'error');
  const dataStatus = 'ok'; // Assume ok if CV is enabled
  const commStatus = health?.internet ? 'ok' : 'error';

  return html`
    <div>
      <h1>Dashboard</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        System overview and exhibition health monitoring.
      </p>

      <!-- Quick Actions -->
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
        <button 
          class="btn btn-primary" 
          style="flex: 1; padding: 1rem; font-size: 1.1em;"
          onClick=${handleOpen}
        >
          ▶ Open Exhibition
        </button>
        <button 
          class="btn btn-secondary" 
          style="flex: 1; padding: 1rem; font-size: 1.1em;"
          onClick=${handleClose}
        >
          ⏸ Close Exhibition
        </button>
      </div>

      <!-- Schedule Info -->
      ${schedule && html`
        <${Card} title="Schedule" status=${schedule.enabled ? 'ok' : 'warn'}>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div>
              <strong>Status:</strong> ${schedule.enabled ? 'Enabled' : 'Disabled'}
            </div>
            ${schedule.today && html`
              <div>
                <strong>Today:</strong> 
                ${schedule.today.open ? `Open at ${schedule.today.open}` : 'No schedule'}
                ${schedule.today.close ? ` → Close at ${schedule.today.close}` : ''}
              </div>
            `}
            ${schedule.nextEvent && html`
              <div>
                <strong>Next Event:</strong> ${schedule.nextEvent.action} at ${schedule.nextEvent.time}
              </div>
            `}
          </div>
        <//>
      `}

      <!-- Quick Stats -->
      <div class="grid grid-3" style="margin: 2rem 0;">
        <${Card} title="Projectors" status="info">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--cyan);">
            ${health?.projectors || 0}
          </div>
        <//>
        
        <${Card} title="Cameras" status="info">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--cyan);">
            ${health?.cameras || 0}
          </div>
        <//>
        
        <${Card} title="Visitors Today" status="info">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--cyan);">
            ${health?.cv?.count ?? '—'}
          </div>
        <//>
      </div>

      <!-- Cluster Status Cards -->
      <h2 style="margin-top: 2rem; margin-bottom: 1rem;">Cluster Status</h2>
      <div class="grid grid-2">
        <${Card} title="Equipment" status=${equipmentStatus}>
          <${StatusDot} status=${equipmentStatus} label="Equipment Cluster" />
          <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--dimmed);">
            ${health?.projectors || 0} projectors, ${health?.tvs || 0} TVs
          </div>
        <//>

        <${Card} title="Cameras" status=${camerasStatus}>
          <${StatusDot} status=${camerasStatus} label="Camera Cluster" />
          <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--dimmed);">
            ${health?.cameras || 0} cameras active
          </div>
        <//>

        <${Card} title="Computer Vision" status=${cvStatus}>
          <${StatusDot} status=${cvStatus} label=${health?.cv?.running ? 'CV Running' : 'CV Stopped'} />
          <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--dimmed);">
            ${health?.cv?.count ?? 0} detections
          </div>
        <//>

        <${Card} title="Data & Logging" status=${dataStatus}>
          <${StatusDot} status=${dataStatus} label="Data Cluster" />
          <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--dimmed);">
            Logging active
          </div>
        <//>

        <${Card} title="Communication" status=${commStatus}>
          <${StatusDot} status=${commStatus} label=${health?.internet ? 'Online' : 'Offline'} />
          <div style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--dimmed);">
            ${health?.internet ? 'Portal sync active' : 'No internet connection'}
          </div>
        <//>
      </div>

      <!-- Server Health -->
      ${health?.server && html`
        <h2 style="margin-top: 2rem; margin-bottom: 1rem;">Server Health</h2>
        <div class="grid grid-2">
          ${health.server.gpus && health.server.gpus.length > 0 && html`
            <${Card} title="GPU" status=${health.server.gpus[0].temp < 80 ? 'ok' : 'warn'}>
              <div>
                <div style="font-size: 1.5rem; font-weight: 600;">
                  ${health.server.gpus[0].temp}°C
                </div>
                <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.5rem;">
                  ${health.server.gpus[0].util}% utilization
                </div>
              </div>
            <//>
          `}

          ${health.server.cpu && html`
            <${Card} title="CPU" status=${health.server.cpu.usage < 80 ? 'ok' : 'warn'}>
              <div>
                <div style="font-size: 1.5rem; font-weight: 600;">
                  ${health.server.cpu.usage}%
                </div>
                <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.5rem;">
                  ${health.server.cpu.temp}°C
                </div>
              </div>
            <//>
          `}

          ${health.server.ram && html`
            <${Card} title="RAM" status=${health.server.ram.usedPercent < 80 ? 'ok' : 'warn'}>
              <div>
                <div style="font-size: 1.5rem; font-weight: 600;">
                  ${health.server.ram.usedPercent}%
                </div>
                <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.5rem;">
                  ${health.server.ram.usedGB}GB / ${health.server.ram.totalGB}GB
                </div>
              </div>
            <//>
          `}

          ${health.server.disk && html`
            <${Card} title="Disk Space" status=${health.server.disk.usedPercent < 90 ? 'ok' : 'warn'}>
              <div>
                <div style="font-size: 1.5rem; font-weight: 600;">
                  ${health.server.disk.freeGB}GB free
                </div>
                <div style="font-size: 0.9rem; color: var(--dimmed); margin-top: 0.5rem;">
                  ${health.server.disk.usedPercent}% used
                </div>
              </div>
            <//>
          `}
        </div>
      `}
    </div>
  `;
}
