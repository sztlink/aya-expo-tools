// Setup page — 10-step installation wizard (Sprint 5)
import { html, useState, useEffect, authFetch } from '../app.js';
import Card from '../components/card.js';
import StatusDot from '../components/status-dot.js';

// ─── Wizard Steps ──────────────────────────────────────────
const STEPS = [
  { num: 1, title: 'Expo Info', key: 'expo' },
  { num: 2, title: 'Network', key: 'network' },
  { num: 3, title: 'Projectors', key: 'projectors' },
  { num: 4, title: 'Cameras', key: 'cameras' },
  { num: 5, title: 'TVs', key: 'tvs' },
  { num: 6, title: 'Audio', key: 'audio' },
  { num: 7, title: 'Smart Plugs', key: 'smartplugs' },
  { num: 8, title: 'Computer Vision', key: 'cv' },
  { num: 9, title: 'Portal', key: 'portal' },
  { num: 10, title: 'Schedule & Review', key: 'schedule' }
];

export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Load persisted state
  useEffect(() => {
    const loadState = async () => {
      try {
        const res = await fetch('/api/setup/state');
        const result = await res.json();
        if (result.ok && result.state) {
          setCurrentStep(result.state.currentStep || 1);
          setCompleted(result.state.completed || []);
          setSkipped(result.state.skipped || []);
          setData(result.state.data || {});
        }
      } catch (err) {
        console.error('Failed to load setup state:', err);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  // Save state on changes
  const saveState = async (updates = {}) => {
    const state = {
      currentStep: updates.currentStep || currentStep,
      completed: updates.completed || completed,
      skipped: updates.skipped || skipped,
      data: updates.data || data
    };

    try {
      await fetch('/api/setup/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (err) {
      console.error('Failed to save setup state:', err);
    }
  };

  // Navigation handlers
  const handleNext = async (stepData) => {
    const newData = { ...data, [STEPS[currentStep - 1].key]: stepData };
    const newCompleted = [...completed, currentStep];
    const newSkipped = skipped.filter(s => s !== currentStep);
    
    setData(newData);
    setCompleted(newCompleted);
    setSkipped(newSkipped);
    
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      await saveState({
        currentStep: currentStep + 1,
        completed: newCompleted,
        skipped: newSkipped,
        data: newData
      });
    }
  };

  const handleSkip = async () => {
    const newSkipped = [...skipped, currentStep];
    const newCompleted = completed.filter(s => s !== currentStep);
    
    setSkipped(newSkipped);
    setCompleted(newCompleted);
    
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      await saveState({
        currentStep: currentStep + 1,
        completed: newCompleted,
        skipped: newSkipped
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      saveState({ currentStep: currentStep - 1 });
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
    saveState({ currentStep: step });
  };

  if (loading) {
    return html`
      <div>
        <h1>Setup Wizard</h1>
        <p style="color: var(--dimmed);">Loading...</p>
      </div>
    `;
  }

  // Render current step
  const stepProps = {
    data: data[STEPS[currentStep - 1].key] || {},
    onNext: handleNext,
    onSkip: handleSkip,
    onPrevious: currentStep > 1 ? handlePrevious : null
  };

  let StepComponent = null;
  switch (currentStep) {
    case 1: StepComponent = Step1ExpoInfo; break;
    case 2: StepComponent = Step2Network; break;
    case 3: StepComponent = Step3Projectors; break;
    case 4: StepComponent = Step4Cameras; break;
    case 5: StepComponent = Step5TVs; break;
    case 6: StepComponent = Step6Audio; break;
    case 7: StepComponent = Step7SmartPlugs; break;
    case 8: StepComponent = Step8CV; break;
    case 9: StepComponent = Step9Portal; break;
    case 10: StepComponent = html`<${Step10ScheduleReview} ...${stepProps} allData=${data} />`; break;
  }

  return html`
    <div>
      <h1>Installation Wizard</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        Configure your exhibition step by step. All progress is saved automatically.
      </p>

      <!-- Progress indicator -->
      <div class="wizard-progress" style="margin-bottom: 2rem;">
        ${STEPS.map(step => {
          const isCompleted = completed.includes(step.num);
          const isSkipped = skipped.includes(step.num);
          const isCurrent = step.num === currentStep;
          
          const status = isCompleted ? 'ok' : isSkipped ? 'warn' : isCurrent ? 'info' : 'default';
          
          return html`
            <div 
              class="wizard-step"
              data-status=${status}
              onClick=${() => goToStep(step.num)}
              style="cursor: pointer;"
            >
              <div class="step-number">${step.num}</div>
              <div class="step-title">${step.title}</div>
            </div>
          `;
        })}
      </div>

      <!-- Current step -->
      ${StepComponent && html`<${StepComponent} ...${stepProps} />`}
    </div>
  `;
}

// ─── Step 1: Expo Info ─────────────────────────────────────
function Step1ExpoInfo({ data, onNext, onSkip }) {
  const [form, setForm] = useState({
    name: data.name || '',
    venue: data.venue || '',
    city: data.city || '',
    artist: data.artist || '',
    slug: data.slug || '',
    openDate: data.openDate || '',
    closeDate: data.closeDate || ''
  });

  const handleSubmit = () => {
    if (!form.slug) {
      alert('Slug is required');
      return;
    }
    onNext(form);
  };

  // Auto-generate slug from name
  const handleNameChange = (name) => {
    setForm({ 
      ...form, 
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    });
  };

  return html`
    <${Card} title="Step 1: Exhibition Info">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label>Exhibition Name *</label>
          <input 
            type="text" 
            value=${form.name}
            onInput=${e => handleNameChange(e.target.value)}
            placeholder="Yoshitaka Amano — CCBB Rio"
            style="width: 100%;"
          />
        </div>

        <div>
          <label>Venue</label>
          <input 
            type="text" 
            value=${form.venue}
            onInput=${e => setForm({ ...form, venue: e.target.value })}
            placeholder="CCBB Rio de Janeiro"
            style="width: 100%;"
          />
        </div>

        <div>
          <label>City</label>
          <input 
            type="text" 
            value=${form.city}
            onInput=${e => setForm({ ...form, city: e.target.value })}
            placeholder="Rio de Janeiro"
            style="width: 100%;"
          />
        </div>

        <div>
          <label>Artist</label>
          <input 
            type="text" 
            value=${form.artist}
            onInput=${e => setForm({ ...form, artist: e.target.value })}
            placeholder="Artist name"
            style="width: 100%;"
          />
        </div>

        <div>
          <label>Slug (config filename) *</label>
          <input 
            type="text" 
            value=${form.slug}
            onInput=${e => setForm({ ...form, slug: e.target.value })}
            placeholder="amano-rio"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed);">Will be saved as config/${form.slug}.json</small>
        </div>

        <div class="grid grid-2">
          <div>
            <label>Open Date</label>
            <input 
              type="date" 
              value=${form.openDate}
              onInput=${e => setForm({ ...form, openDate: e.target.value })}
              style="width: 100%;"
            />
          </div>
          <div>
            <label>Close Date</label>
            <input 
              type="date" 
              value=${form.closeDate}
              onInput=${e => setForm({ ...form, closeDate: e.target.value })}
              style="width: 100%;"
            />
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button class="btn btn-primary" onClick=${handleSubmit}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 2: Network Scan ──────────────────────────────────
function Step2Network({ data, onNext, onSkip, onPrevious }) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState(data.devices || []);
  const [mediaServer, setMediaServer] = useState(data.mediaServer || '');

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/setup/test/network-scan', { method: 'POST' });
      const result = await res.json();
      if (result.ok) {
        setDevices(result.devices);
      } else {
        alert(`Scan failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = () => {
    onNext({ devices, mediaServer });
  };

  return html`
    <${Card} title="Step 2: Network Scan">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label>Media Server IP (optional)</label>
          <input 
            type="text" 
            value=${mediaServer}
            onInput=${e => setMediaServer(e.target.value)}
            placeholder="192.168.0.10"
            style="width: 100%;"
          />
        </div>

        <button 
          class="btn btn-primary" 
          onClick=${handleScan}
          disabled=${scanning}
        >
          ${scanning ? 'Scanning...' : 'Scan Network'}
        </button>

        ${devices.length > 0 && html`
          <div style="margin-top: 1rem;">
            <h4>Discovered Devices (${devices.length})</h4>
            <div style="max-height: 300px; overflow-y: auto; margin-top: 0.5rem;">
              ${devices.map(d => html`
                <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                  <strong>${d.ip}</strong> — ${d.mac} (${d.type})
                </div>
              `)}
            </div>
          </div>
        `}

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${handleSubmit}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 3: Projectors ────────────────────────────────────
function Step3Projectors({ data, onNext, onSkip, onPrevious }) {
  const [projectors, setProjectors] = useState(data.projectors || []);
  const [testResults, setTestResults] = useState({});

  const addProjector = () => {
    setProjectors([...projectors, { id: `proj-${Date.now()}`, name: '', ip: '', model: '', input: 'HDMI1' }]);
  };

  const removeProjector = (idx) => {
    setProjectors(projectors.filter((_, i) => i !== idx));
  };

  const updateProjector = (idx, field, value) => {
    const updated = [...projectors];
    updated[idx][field] = value;
    setProjectors(updated);
  };

  const testProjector = async (idx) => {
    const proj = projectors[idx];
    if (!proj.ip) {
      alert('IP address required');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/projector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: proj.ip })
      });
      const result = await res.json();
      setTestResults({ ...testResults, [idx]: result.ok ? 'ok' : 'error' });
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
    }
  };

  return html`
    <${Card} title="Step 3: Projectors">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${projectors.map((proj, idx) => html`
          <div key=${proj.id} style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px;">
            <div class="grid grid-2" style="gap: 0.5rem;">
              <div>
                <label>Name</label>
                <input 
                  type="text" 
                  value=${proj.name}
                  onInput=${e => updateProjector(idx, 'name', e.target.value)}
                  placeholder="Projetor 1"
                  style="width: 100%;"
                />
              </div>
              <div>
                <label>IP Address</label>
                <input 
                  type="text" 
                  value=${proj.ip}
                  onInput=${e => updateProjector(idx, 'ip', e.target.value)}
                  placeholder="10.0.1.20"
                  style="width: 100%;"
                />
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testProjector(idx)}>
                Test PJLink
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeProjector(idx)}>
                Remove
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addProjector}>+ Add Projector</button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ projectors })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 4: Cameras ───────────────────────────────────────
function Step4Cameras({ data, onNext, onSkip, onPrevious }) {
  const [cameras, setCameras] = useState(data.cameras || []);
  const [testResults, setTestResults] = useState({});
  const [snapshots, setSnapshots] = useState({});
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [zones, setZones] = useState({});

  const addCamera = () => {
    setCameras([...cameras, { 
      id: `cam-${Date.now()}`, 
      name: '', 
      ip: '', 
      rtsp: '', 
      zones: [] 
    }]);
  };

  const removeCamera = (idx) => {
    setCameras(cameras.filter((_, i) => i !== idx));
  };

  const updateCamera = (idx, field, value) => {
    const updated = [...cameras];
    updated[idx][field] = value;
    setCameras(updated);
  };

  const testCamera = async (idx) => {
    const cam = cameras[idx];
    if (!cam.rtsp) {
      alert('RTSP URL required');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp: cam.rtsp })
      });
      const result = await res.json();
      
      if (result.ok && result.image) {
        setSnapshots({ ...snapshots, [idx]: result.image });
        setTestResults({ ...testResults, [idx]: 'ok' });
      } else {
        setTestResults({ ...testResults, [idx]: 'error' });
        alert(result.message || 'Camera test failed');
      }
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
      alert(`Test failed: ${err.message}`);
    }
  };

  const handleSubmit = () => {
    // Merge zones into cameras
    const camerasWithZones = cameras.map((cam, idx) => ({
      ...cam,
      zones: zones[idx] || []
    }));
    onNext({ cameras: camerasWithZones });
  };

  return html`
    <${Card} title="Step 4: Cameras">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${cameras.map((cam, idx) => html`
          <div key=${cam.id} style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px;">
            <div class="grid grid-2" style="gap: 0.5rem;">
              <div>
                <label>Name</label>
                <input 
                  type="text" 
                  value=${cam.name}
                  onInput=${e => updateCamera(idx, 'name', e.target.value)}
                  placeholder="Camera 1"
                  style="width: 100%;"
                />
              </div>
              <div>
                <label>IP Address</label>
                <input 
                  type="text" 
                  value=${cam.ip}
                  onInput=${e => updateCamera(idx, 'ip', e.target.value)}
                  placeholder="10.0.1.30"
                  style="width: 100%;"
                />
              </div>
            </div>

            <div style="margin-top: 0.5rem;">
              <label>RTSP URL</label>
              <input 
                type="text" 
                value=${cam.rtsp}
                onInput=${e => updateCamera(idx, 'rtsp', e.target.value)}
                placeholder="rtsp://admin:password@10.0.1.30:554/stream"
                style="width: 100%;"
              />
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testCamera(idx)}>
                Test & Capture
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeCamera(idx)}>
                Remove
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
            </div>

            ${snapshots[idx] && html`
              <div style="margin-top: 1rem;">
                <img src=${snapshots[idx]} style="max-width: 100%; border-radius: 4px;" />
                <button 
                  class="btn btn-sm" 
                  style="margin-top: 0.5rem;"
                  onClick=${() => setSelectedCamera(idx)}
                >
                  Draw Zones
                </button>
              </div>
            `}
          </div>
        `)}

        <button class="btn" onClick=${addCamera}>+ Add Camera</button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${handleSubmit}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 5: TVs ───────────────────────────────────────────
function Step5TVs({ data, onNext, onSkip, onPrevious }) {
  const [tvs, setTVs] = useState(data.tvs || []);
  const [testResults, setTestResults] = useState({});

  const addTV = () => {
    setTVs([...tvs, { id: `tv-${Date.now()}`, name: '', ip: '', mac: '' }]);
  };

  const removeTV = (idx) => {
    setTVs(tvs.filter((_, i) => i !== idx));
  };

  const updateTV = (idx, field, value) => {
    const updated = [...tvs];
    updated[idx][field] = value;
    setTVs(updated);
  };

  const testTV = async (idx) => {
    const tv = tvs[idx];
    if (!tv.ip) {
      alert('IP address required');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/tv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: tv.ip })
      });
      const result = await res.json();
      setTestResults({ ...testResults, [idx]: result.ok ? 'ok' : 'error' });
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
    }
  };

  return html`
    <${Card} title="Step 5: TVs">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${tvs.map((tv, idx) => html`
          <div key=${tv.id} style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px;">
            <div class="grid grid-2" style="gap: 0.5rem;">
              <div>
                <label>Name</label>
                <input 
                  type="text" 
                  value=${tv.name}
                  onInput=${e => updateTV(idx, 'name', e.target.value)}
                  placeholder="TV 1"
                  style="width: 100%;"
                />
              </div>
              <div>
                <label>IP Address</label>
                <input 
                  type="text" 
                  value=${tv.ip}
                  onInput=${e => updateTV(idx, 'ip', e.target.value)}
                  placeholder="10.0.1.40"
                  style="width: 100%;"
                />
              </div>
            </div>

            <div style="margin-top: 0.5rem;">
              <label>MAC Address (for WOL)</label>
              <input 
                type="text" 
                value=${tv.mac}
                onInput=${e => updateTV(idx, 'mac', e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                style="width: 100%;"
              />
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testTV(idx)}>
                Test Connection
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeTV(idx)}>
                Remove
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addTV}>+ Add TV</button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ tvs })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 6: Audio ─────────────────────────────────────────
function Step6Audio({ data, onNext, onSkip, onPrevious }) {
  const [volume, setVolume] = useState(data.volume || 70);
  const [device, setDevice] = useState(data.device || 'default');
  const [testStatus, setTestStatus] = useState(null);

  const testAudio = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/setup/test/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, volume })
      });
      const result = await res.json();
      setTestStatus(result.ok ? 'ok' : 'error');
    } catch (err) {
      setTestStatus('error');
    }
  };

  return html`
    <${Card} title="Step 6: Audio Configuration">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label>Audio Device</label>
          <input 
            type="text" 
            value=${device}
            onInput=${e => setDevice(e.target.value)}
            placeholder="default"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed);">Leave as 'default' to use system default</small>
        </div>

        <div>
          <label>Volume: ${volume}%</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value=${volume}
            onInput=${e => setVolume(parseInt(e.target.value))}
            style="width: 100%;"
          />
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn" onClick=${testAudio}>Test Audio</button>
          ${testStatus && html`<${StatusDot} status=${testStatus} />`}
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ device, volume })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 7: Smart Plugs ───────────────────────────────────
function Step7SmartPlugs({ data, onNext, onSkip, onPrevious }) {
  const [plugs, setPlugs] = useState(data.smartplugs || []);
  const [testResults, setTestResults] = useState({});

  const addPlug = () => {
    setPlugs([...plugs, { id: `plug-${Date.now()}`, name: '', deviceId: '', ip: '' }]);
  };

  const removePlug = (idx) => {
    setPlugs(plugs.filter((_, i) => i !== idx));
  };

  const updatePlug = (idx, field, value) => {
    const updated = [...plugs];
    updated[idx][field] = value;
    setPlugs(updated);
  };

  const testPlug = async (idx) => {
    const plug = plugs[idx];
    if (!plug.deviceId) {
      alert('Device ID required');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/smartplug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: plug.deviceId })
      });
      const result = await res.json();
      setTestResults({ ...testResults, [idx]: result.ok ? 'ok' : 'error' });
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
    }
  };

  return html`
    <${Card} title="Step 7: Smart Plugs (Tuya)">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${plugs.map((plug, idx) => html`
          <div key=${plug.id} style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px;">
            <div class="grid grid-2" style="gap: 0.5rem;">
              <div>
                <label>Name</label>
                <input 
                  type="text" 
                  value=${plug.name}
                  onInput=${e => updatePlug(idx, 'name', e.target.value)}
                  placeholder="Smart Plug 1"
                  style="width: 100%;"
                />
              </div>
              <div>
                <label>Device ID</label>
                <input 
                  type="text" 
                  value=${plug.deviceId}
                  onInput=${e => updatePlug(idx, 'deviceId', e.target.value)}
                  placeholder="bf..."
                  style="width: 100%;"
                />
              </div>
            </div>

            <div style="margin-top: 0.5rem;">
              <label>IP Address (optional)</label>
              <input 
                type="text" 
                value=${plug.ip}
                onInput=${e => updatePlug(idx, 'ip', e.target.value)}
                placeholder="10.0.1.50"
                style="width: 100%;"
              />
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testPlug(idx)}>
                Test Connection
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removePlug(idx)}>
                Remove
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addPlug}>+ Add Smart Plug</button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ smartplugs: plugs })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 8: Computer Vision ───────────────────────────────
function Step8CV({ data, onNext, onSkip, onPrevious }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [testStatus, setTestStatus] = useState(null);

  const testCV = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/setup/test/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const result = await res.json();
      setTestStatus(result.ok ? 'ok' : 'error');
    } catch (err) {
      setTestStatus('error');
    }
  };

  return html`
    <${Card} title="Step 8: Computer Vision">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label>
            <input 
              type="checkbox" 
              checked=${enabled}
              onChange=${e => setEnabled(e.target.checked)}
            />
            Enable Computer Vision
          </label>
          <small style="display: block; color: var(--dimmed); margin-top: 0.25rem;">
            Enables visitor counting and ReID tracking
          </small>
        </div>

        ${enabled && html`
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn" onClick=${testCV}>Test CV Detection</button>
            ${testStatus && html`<${StatusDot} status=${testStatus} />`}
          </div>
        `}

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ enabled })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 9: Portal Sync ───────────────────────────────────
function Step9Portal({ data, onNext, onSkip, onPrevious }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [projetoId, setProjetoId] = useState(data.projetoId || '');
  const [testStatus, setTestStatus] = useState(null);

  const testPortal = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/setup/test/portal', { method: 'POST' });
      const result = await res.json();
      setTestStatus(result.ok ? 'ok' : 'error');
    } catch (err) {
      setTestStatus('error');
    }
  };

  return html`
    <${Card} title="Step 9: Portal Sync">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label>
            <input 
              type="checkbox" 
              checked=${enabled}
              onChange=${e => setEnabled(e.target.checked)}
            />
            Enable Portal Sync
          </label>
          <small style="display: block; color: var(--dimmed); margin-top: 0.25rem;">
            Sync data to AYA Portal
          </small>
        </div>

        ${enabled && html`
          <div>
            <label>Project ID (optional)</label>
            <input 
              type="text" 
              value=${projetoId}
              onInput=${e => setProjetoId(e.target.value)}
              placeholder="123"
              style="width: 100%;"
            />
          </div>
        `}

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn" onClick=${testPortal}>Test Internet Connection</button>
          ${testStatus && html`<${StatusDot} status=${testStatus} />`}
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ enabled, projetoId })}>Next</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Skip</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Step 10: Schedule & Review ────────────────────────────
function Step10ScheduleReview({ data, allData, onNext, onSkip, onPrevious }) {
  const [schedule, setSchedule] = useState(data.days || {
    mon: null,
    tue: { open: '09:00', close: '20:00' },
    wed: { open: '09:00', close: '20:00' },
    thu: { open: '09:00', close: '20:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '20:00' },
    sun: { open: '09:00', close: '20:00' }
  });
  const [generating, setGenerating] = useState(false);

  const dayNames = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday'
  };

  const updateDay = (day, field, value) => {
    const current = schedule[day] || { open: '09:00', close: '20:00' };
    setSchedule({ ...schedule, [day]: { ...current, [field]: value } });
  };

  const toggleDay = (day) => {
    if (schedule[day]) {
      setSchedule({ ...schedule, [day]: null });
    } else {
      setSchedule({ ...schedule, [day]: { open: '09:00', close: '20:00' } });
    }
  };

  const handleGenerate = async () => {
    if (!allData.expo?.slug) {
      alert('Missing required field: slug (Step 1)');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/setup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            data: { ...allData, schedule: { days: schedule } }
          }
        })
      });
      
      const result = await res.json();
      
      if (result.ok) {
        alert(`Configuration generated successfully!\n\nSaved to: config/${result.slug}.json\n\nRestart the server with:\nnode index.js --config=${result.slug}`);
        // Redirect to dashboard
        location.hash = '/dashboard';
      } else {
        alert(`Failed to generate config: ${result.error}`);
      }
    } catch (err) {
      alert(`Failed to generate config: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return html`
    <div>
      <${Card} title="Step 10: Schedule">
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${Object.entries(dayNames).map(([key, name]) => html`
            <div key=${key} style="display: flex; gap: 1rem; align-items: center;">
              <label style="min-width: 100px;">
                <input 
                  type="checkbox" 
                  checked=${schedule[key] !== null}
                  onChange=${() => toggleDay(key)}
                />
                ${name}
              </label>
              
              ${schedule[key] && html`
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input 
                    type="time" 
                    value=${schedule[key].open}
                    onInput=${e => updateDay(key, 'open', e.target.value)}
                  />
                  <span>to</span>
                  <input 
                    type="time" 
                    value=${schedule[key].close}
                    onInput=${e => updateDay(key, 'close', e.target.value)}
                  />
                </div>
              `}
            </div>
          `)}
        </div>
      <//>

      <${Card} title="Configuration Review" style="margin-top: 2rem;">
        <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.9rem;">
          <div><strong>Exhibition:</strong> ${allData.expo?.name || 'Not set'}</div>
          <div><strong>Slug:</strong> ${allData.expo?.slug || 'Not set'}</div>
          <div><strong>Projectors:</strong> ${allData.projectors?.length || 0}</div>
          <div><strong>Cameras:</strong> ${allData.cameras?.length || 0}</div>
          <div><strong>TVs:</strong> ${allData.tvs?.length || 0}</div>
          <div><strong>Smart Plugs:</strong> ${allData.smartplugs?.length || 0}</div>
          <div><strong>CV Enabled:</strong> ${allData.cv?.enabled !== false ? 'Yes' : 'No'}</div>
          <div><strong>Portal Enabled:</strong> ${allData.portal?.enabled !== false ? 'Yes' : 'No'}</div>
        </div>
      <//>

      <div style="display: flex; gap: 0.5rem; margin-top: 2rem;">
        ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Previous</button>`}
        <button 
          class="btn btn-primary" 
          style="flex: 1; padding: 1rem; font-size: 1.1em;"
          onClick=${handleGenerate}
          disabled=${generating}
        >
          ${generating ? 'Generating...' : '✓ Generate Configuration'}
        </button>
      </div>
    </div>
  `;
}
