// Setup page — Assistente de Instalação com 10 passos (Sprint 5)
import { html, useState, useEffect, authFetch } from '../app.js';
import Card from '../components/card.js';
import StatusDot from '../components/status-dot.js';

// ─── Passos do Assistente ──────────────────────────────────
const STEPS = [
  { num: 1, title: 'Informações da Exposição', key: 'expo' },
  { num: 2, title: 'Rede', key: 'network' },
  { num: 3, title: 'Projetores', key: 'projectors' },
  { num: 4, title: 'Câmeras', key: 'cameras' },
  { num: 5, title: 'TVs', key: 'tvs' },
  { num: 6, title: 'Áudio', key: 'audio' },
  { num: 7, title: 'Tomadas Inteligentes', key: 'smartplugs' },
  { num: 8, title: 'Visão Computacional', key: 'cv' },
  { num: 9, title: 'Portal AYA', key: 'portal' },
  { num: 10, title: 'Horários e Revisão', key: 'schedule' }
];

export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Carrega estado persistido
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
        console.error('Falha ao carregar estado do assistente:', err);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  // Salva estado quando há mudanças
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
      console.error('Falha ao salvar estado do assistente:', err);
    }
  };

  // Handlers de navegação
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
        <h1>Assistente de Instalação</h1>
        <p style="color: var(--dimmed);">Carregando...</p>
      </div>
    `;
  }

  // Renderiza passo atual
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
      <h1>Assistente de Instalação</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        Configure sua exposição passo a passo. Todo o progresso é salvo automaticamente.
      </p>

      <!-- Indicador de progresso -->
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

      <!-- Passo atual -->
      ${StepComponent && html`<${StepComponent} ...${stepProps} />`}
    </div>
  `;
}

// ─── Passo 1: Informações da Exposição ────────────────────
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
      alert('O campo Slug é obrigatório');
      return;
    }
    onNext(form);
  };

  // Auto-gera slug a partir do nome
  const handleNameChange = (name) => {
    setForm({ 
      ...form, 
      name,
      slug: name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    });
  };

  return html`
    <${Card} title="Passo 1: Informações da Exposição">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Identifique a exposição. Esses dados aparecem nos relatórios e no dashboard.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Nome da Exposição *
          </label>
          <input 
            type="text" 
            value=${form.name}
            onInput=${e => handleNameChange(e.target.value)}
            placeholder="Yoshitaka Amano — CCBB Rio"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Nome completo como aparece no material de divulgação
          </small>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Local
          </label>
          <input 
            type="text" 
            value=${form.venue}
            onInput=${e => setForm({ ...form, venue: e.target.value })}
            placeholder="CCBB Rio de Janeiro"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Nome do espaço/venue onde acontece a exposição
          </small>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Cidade
          </label>
          <input 
            type="text" 
            value=${form.city}
            onInput=${e => setForm({ ...form, city: e.target.value })}
            placeholder="Rio de Janeiro"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Cidade onde acontece a montagem
          </small>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Artista
          </label>
          <input 
            type="text" 
            value=${form.artist}
            onInput=${e => setForm({ ...form, artist: e.target.value })}
            placeholder="Yoshitaka Amano"
            style="width: 100%;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Nome do artista ou grupo. Campo opcional
          </small>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Slug (identificador) *
          </label>
          <input 
            type="text" 
            value=${form.slug}
            onInput=${e => setForm({ ...form, slug: e.target.value })}
            placeholder="amano-rio"
            style="width: 100%; font-family: monospace;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Identificador curto, sem espaços ou acentos. Usado como nome do arquivo de configuração (config/${form.slug || 'exemplo'}.json)
          </small>
        </div>

        <div class="grid grid-2" style="gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
              Data de Abertura
            </label>
            <input 
              type="date" 
              value=${form.openDate}
              onInput=${e => setForm({ ...form, openDate: e.target.value })}
              style="width: 100%;"
            />
            <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
              Data de abertura da exposição ao público
            </small>
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
              Data de Encerramento
            </label>
            <input 
              type="date" 
              value=${form.closeDate}
              onInput=${e => setForm({ ...form, closeDate: e.target.value })}
              style="width: 100%;"
            />
            <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
              Data de encerramento da exposição
            </small>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button class="btn btn-primary" onClick=${handleSubmit}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 2: Rede ─────────────────────────────────────────
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
        alert(`Scan concluído! Encontrados ${result.devices.length} dispositivos na rede.`);
      } else {
        alert(`Falha no scan: ${result.error}`);
      }
    } catch (err) {
      alert(`Erro ao escanear rede: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = () => {
    onNext({ devices, mediaServer });
  };

  return html`
    <${Card} title="Passo 2: Rede">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Vamos descobrir os equipamentos conectados na rede local. Certifique-se de que o media server 
        está conectado ao mesmo switch/rede que os projetores, câmeras e TVs.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            IP do Media Server (opcional)
          </label>
          <input 
            type="text" 
            value=${mediaServer}
            onInput=${e => setMediaServer(e.target.value)}
            placeholder="192.168.0.10"
            style="width: 100%; font-family: monospace;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            O IP desta máquina na rede local. Geralmente 192.168.0.x ou 10.0.0.x. 
            Se não souber, deixe em branco — o scan vai detectar automaticamente.
          </small>
        </div>

        <button 
          class="btn btn-primary" 
          onClick=${handleScan}
          disabled=${scanning}
          style="align-self: flex-start;"
        >
          ${scanning ? 'Escaneando rede...' : '🔍 Escanear Rede'}
        </button>

        ${devices.length > 0 && html`
          <div style="margin-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem;">Dispositivos Encontrados (${devices.length})</h4>
            <div style="max-height: 300px; overflow-y: auto; margin-top: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px;">
              ${devices.map(d => html`
                <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.9rem;">
                  <div style="display: flex; justify-content: space-between;">
                    <strong style="color: var(--primary);">${d.ip}</strong>
                    <span style="color: var(--dimmed);">${d.type || 'Desconhecido'}</span>
                  </div>
                  <small style="color: var(--dimmed);">MAC: ${d.mac}</small>
                </div>
              `)}
            </div>
          </div>
        `}

        <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            Conecte todos os equipamentos antes de escanear. Projetores, câmeras e TVs precisam estar 
            ligados e na mesma rede para serem detectados. O scan pode levar alguns minutos.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${handleSubmit}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 3: Projetores ───────────────────────────────────
function Step3Projectors({ data, onNext, onSkip, onPrevious }) {
  const [projectors, setProjectors] = useState(data.projectors || []);
  const [testResults, setTestResults] = useState({});

  const addProjector = () => {
    setProjectors([...projectors, { 
      id: `proj-${Date.now()}`, 
      name: '', 
      ip: '', 
      port: 4352,
      password: '',
      model: '', 
      input: 'HDMI1' 
    }]);
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
      alert('IP do projetor é obrigatório');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/projector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: proj.ip, port: proj.port, password: proj.password })
      });
      const result = await res.json();
      
      if (result.ok) {
        setTestResults({ ...testResults, [idx]: 'ok' });
        if (result.model) {
          updateProjector(idx, 'model', result.model);
        }
        alert(`✓ Conexão bem-sucedida!\n\n${result.model ? `Modelo: ${result.model}\n` : ''}${result.lampHours ? `Horas de lâmpada: ${result.lampHours}h` : ''}`);
      } else {
        setTestResults({ ...testResults, [idx]: 'error' });
        alert(`✗ Falha na conexão: ${result.error || 'Verifique se o projetor está ligado e com PJLink habilitado'}`);
      }
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
      alert(`Erro ao testar projetor: ${err.message}`);
    }
  };

  return html`
    <${Card} title="Passo 3: Projetores">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure os projetores controlados por PJLink. Cada projetor precisa de um IP fixo na rede local 
        e a porta PJLink (padrão: 4352) aberta.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${projectors.map((proj, idx) => html`
          <div key=${proj.id} style="border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 4px; background: var(--bg-elevated);">
            <h4 style="margin: 0 0 1rem 0;">Projetor ${idx + 1}</h4>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  Nome/Apelido
                </label>
                <input 
                  type="text" 
                  value=${proj.name}
                  onInput=${e => updateProjector(idx, 'name', e.target.value)}
                  placeholder="Projetor Sala 1"
                  style="width: 100%;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  Apelido para identificar (ex: 'Projetor Sala 1', 'PJ Entrada')
                </small>
              </div>

              <div class="grid grid-2" style="gap: 1rem;">
                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    IP *
                  </label>
                  <input 
                    type="text" 
                    value=${proj.ip}
                    onInput=${e => updateProjector(idx, 'ip', e.target.value)}
                    placeholder="192.168.0.20"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Endereço IP do projetor na rede local. Encontrado no menu de rede do projetor ou no scan anterior.
                  </small>
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    Porta PJLink
                  </label>
                  <input 
                    type="number" 
                    value=${proj.port}
                    onInput=${e => updateProjector(idx, 'port', parseInt(e.target.value))}
                    placeholder="4352"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Porta PJLink. O padrão é 4352. Só mude se o projetor tiver outra configurada.
                  </small>
                </div>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  Senha PJLink (opcional)
                </label>
                <input 
                  type="password" 
                  value=${proj.password}
                  onInput=${e => updateProjector(idx, 'password', e.target.value)}
                  placeholder="(deixe em branco se não houver)"
                  style="width: 100%; font-family: monospace;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  Alguns projetores exigem senha PJLink. Se não souber, deixe em branco e tente o teste primeiro.
                </small>
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testProjector(idx)}>
                🔌 Testar Conexão
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeProjector(idx)}>
                🗑️ Remover
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
              ${testResults[idx] === 'testing' && html`
                <small style="color: var(--dimmed);">Testando...</small>
              `}
            </div>

            <div style="padding: 0.75rem; background: var(--bg); border-radius: 4px; margin-top: 1rem; border-left: 3px solid var(--info);">
              <small style="color: var(--dimmed);">
                💡 O projetor precisa estar ligado e com PJLink habilitado nas configurações de rede. 
                O teste retorna o modelo e horas de lâmpada se a conexão for bem-sucedida.
              </small>
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addProjector} style="align-self: flex-start;">
          ➕ Adicionar Projetor
        </button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ projectors })}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 4: Câmeras ──────────────────────────────────────
function Step4Cameras({ data, onNext, onSkip, onPrevious }) {
  const [cameras, setCameras] = useState(data.cameras || []);
  const [testResults, setTestResults] = useState({});
  const [snapshots, setSnapshots] = useState({});

  const addCamera = () => {
    setCameras([...cameras, { 
      id: `cam-${Date.now()}`, 
      name: '', 
      ip: '',
      user: 'admin',
      password: '',
      channel: 1,
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
    
    // Auto-constrói URL RTSP quando campos necessários mudam
    if (['ip', 'user', 'password', 'channel'].includes(field)) {
      const cam = { ...updated[idx], [field]: value };
      if (cam.ip && cam.user && cam.password) {
        updated[idx].rtsp = `rtsp://${cam.user}:${cam.password}@${cam.ip}:554/cam/realmonitor?channel=${cam.channel}&subtype=0`;
      }
    }
    
    setCameras(updated);
  };

  const testCamera = async (idx) => {
    const cam = cameras[idx];
    if (!cam.rtsp) {
      alert('Configure IP, usuário e senha primeiro. A URL RTSP será gerada automaticamente.');
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
        alert('✓ Snapshot capturado com sucesso! A imagem aparecerá abaixo.');
      } else {
        setTestResults({ ...testResults, [idx]: 'error' });
        alert(`✗ Falha ao capturar snapshot: ${result.message || 'Verifique as credenciais e URL RTSP'}`);
      }
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
      alert(`Erro ao testar câmera: ${err.message}`);
    }
  };

  const handleSubmit = () => {
    onNext({ cameras });
  };

  return html`
    <${Card} title="Passo 4: Câmeras">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure as câmeras IP para timelapse e visão computacional. Cada câmera precisa de uma URL RTSP 
        e credenciais de acesso.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${cameras.map((cam, idx) => html`
          <div key=${cam.id} style="border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 4px; background: var(--bg-elevated);">
            <h4 style="margin: 0 0 1rem 0;">Câmera ${idx + 1}</h4>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div class="grid grid-2" style="gap: 1rem;">
                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    Nome/ID *
                  </label>
                  <input 
                    type="text" 
                    value=${cam.name}
                    onInput=${e => updateCamera(idx, 'name', e.target.value)}
                    placeholder="cam-1"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Identificador único (ex: 'cam-1', 'cam-entrada')
                  </small>
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    IP *
                  </label>
                  <input 
                    type="text" 
                    value=${cam.ip}
                    onInput=${e => updateCamera(idx, 'ip', e.target.value)}
                    placeholder="192.168.0.107"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    IP da câmera na rede (encontrado no scan ou menu da câmera)
                  </small>
                </div>
              </div>

              <div class="grid grid-3" style="gap: 1rem;">
                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    Usuário
                  </label>
                  <input 
                    type="text" 
                    value=${cam.user}
                    onInput=${e => updateCamera(idx, 'user', e.target.value)}
                    placeholder="admin"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Geralmente 'admin'
                  </small>
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    Senha *
                  </label>
                  <input 
                    type="password" 
                    value=${cam.password}
                    onInput=${e => updateCamera(idx, 'password', e.target.value)}
                    placeholder="••••••"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Senha configurada na câmera
                  </small>
                </div>

                <div>
                  <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                    Canal
                  </label>
                  <input 
                    type="number" 
                    value=${cam.channel}
                    onInput=${e => updateCamera(idx, 'channel', parseInt(e.target.value))}
                    placeholder="1"
                    style="width: 100%; font-family: monospace;"
                  />
                  <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                    Geralmente 1
                  </small>
                </div>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  URL RTSP (gerada automaticamente)
                </label>
                <input 
                  type="text" 
                  value=${cam.rtsp}
                  onInput=${e => updateCamera(idx, 'rtsp', e.target.value)}
                  placeholder="rtsp://admin:senha@192.168.0.107:554/cam/realmonitor?channel=1&subtype=0"
                  style="width: 100%; font-family: monospace; font-size: 0.85rem;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  A URL é montada automaticamente quando você preenche os campos acima. 
                  Formato Intelbras: /cam/realmonitor. Hikvision: /Streaming/Channels/101
                </small>
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testCamera(idx)}>
                📸 Capturar Snapshot
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeCamera(idx)}>
                🗑️ Remover
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
              ${testResults[idx] === 'testing' && html`
                <small style="color: var(--dimmed);">Capturando...</small>
              `}
            </div>

            ${snapshots[idx] && html`
              <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                <p style="margin: 0 0 0.5rem 0; font-weight: 500;">Preview da câmera:</p>
                <img 
                  src=${snapshots[idx]} 
                  style="max-width: 100%; border-radius: 4px; border: 1px solid var(--border-color);" 
                  alt="Snapshot da câmera"
                />
              </div>
            `}

            <div style="padding: 0.75rem; background: var(--bg); border-radius: 4px; margin-top: 1rem; border-left: 3px solid var(--info);">
              <small style="color: var(--dimmed);">
                💡 A URL RTSP varia por fabricante. Intelbras: /cam/realmonitor?channel=1&subtype=0. 
                Hikvision: /Streaming/Channels/101. Se não souber, preencha os campos e tente o teste — 
                o sistema vai tentar os formatos mais comuns.
              </small>
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addCamera} style="align-self: flex-start;">
          ➕ Adicionar Câmera
        </button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${handleSubmit}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 5: TVs ──────────────────────────────────────────
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
      alert('IP da TV é obrigatório');
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
      
      if (result.ok) {
        setTestResults({ ...testResults, [idx]: 'ok' });
        alert('✓ Conexão Google Cast bem-sucedida! A TV responde na porta 8009.');
      } else {
        setTestResults({ ...testResults, [idx]: 'error' });
        alert(`✗ Falha na conexão: ${result.error || 'Verifique se a TV está ligada e com Cast habilitado'}`);
      }
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
      alert(`Erro ao testar TV: ${err.message}`);
    }
  };

  return html`
    <${Card} title="Passo 5: TVs">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure as TVs controladas por Google Cast (Chromecast). As TVs precisam estar na mesma rede 
        Wi-Fi/Ethernet e com o Cast habilitado.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${tvs.map((tv, idx) => html`
          <div key=${tv.id} style="border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 4px; background: var(--bg-elevated);">
            <h4 style="margin: 0 0 1rem 0;">TV ${idx + 1}</h4>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  Nome/Apelido
                </label>
                <input 
                  type="text" 
                  value=${tv.name}
                  onInput=${e => updateTV(idx, 'name', e.target.value)}
                  placeholder="TV Sala 1"
                  style="width: 100%;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  Apelido para identificar (ex: 'TV Sala 1', 'TV Corredor')
                </small>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  IP *
                </label>
                <input 
                  type="text" 
                  value=${tv.ip}
                  onInput=${e => updateTV(idx, 'ip', e.target.value)}
                  placeholder="192.168.0.50"
                  style="width: 100%; font-family: monospace;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  IP da TV na rede. Encontrado nas configurações de rede da TV ou no scan anterior.
                </small>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  MAC Address (para Wake-on-LAN)
                </label>
                <input 
                  type="text" 
                  value=${tv.mac}
                  onInput=${e => updateTV(idx, 'mac', e.target.value)}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  style="width: 100%; font-family: monospace;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  Endereço MAC para ligar a TV remotamente. Encontrado nas configurações de rede da TV. Formato: AA:BB:CC:DD:EE:FF
                </small>
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testTV(idx)}>
                📺 Testar Conexão
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removeTV(idx)}>
                🗑️ Remover
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
              ${testResults[idx] === 'testing' && html`
                <small style="color: var(--dimmed);">Testando...</small>
              `}
            </div>

            <div style="padding: 0.75rem; background: var(--bg); border-radius: 4px; margin-top: 1rem; border-left: 3px solid var(--info);">
              <small style="color: var(--dimmed);">
                💡 TVs Hisense precisam estar com Ethernet conectada (Wi-Fi é instável para Cast). 
                O Cast funciona pela porta 8009. O MAC é necessário para Wake-on-LAN (ligar a TV remotamente).
              </small>
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addTV} style="align-self: flex-start;">
          ➕ Adicionar TV
        </button>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ tvs })}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 6: Áudio ────────────────────────────────────────
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
      
      if (result.ok) {
        setTestStatus('ok');
        alert('✓ Teste de áudio bem-sucedido! Você deve ter ouvido um bip ou ajuste de volume.');
      } else {
        setTestStatus('error');
        alert(`✗ Falha no teste de áudio: ${result.error || 'Verifique as conexões de áudio'}`);
      }
    } catch (err) {
      setTestStatus('error');
      alert(`Erro ao testar áudio: ${err.message}`);
    }
  };

  return html`
    <${Card} title="Passo 6: Áudio">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure a saída de áudio do media server. O sistema controla o volume master do Windows.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
            Dispositivo de Áudio
          </label>
          <input 
            type="text" 
            value=${device}
            onInput=${e => setDevice(e.target.value)}
            placeholder="default"
            style="width: 100%; font-family: monospace;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Deixe como 'default' para usar o dispositivo padrão do sistema. 
            Só mude se precisar forçar uma saída específica.
          </small>
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
            Volume: ${volume}%
          </label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value=${volume}
            onInput=${e => setVolume(parseInt(e.target.value))}
            style="width: 100%;"
          />
          <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
            Volume master do sistema (0-100%). Recomendado: 70-80% para exposições.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn" onClick=${testAudio}>
            🔊 Testar Áudio
          </button>
          ${testStatus && html`<${StatusDot} status=${testStatus} />`}
          ${testStatus === 'testing' && html`
            <small style="color: var(--dimmed);">Testando...</small>
          `}
        </div>

        <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            Conecte os cabos de áudio antes deste passo. O sistema controla o volume principal do Windows — 
            não volumes individuais de aplicativos. Certifique-se de que os alto-falantes estão ligados.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ device, volume })}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 7: Tomadas Inteligentes ────────────────────────
function Step7SmartPlugs({ data, onNext, onSkip, onPrevious }) {
  const [plugs, setPlugs] = useState(data.plugs || []);
  const [tuyaAccessId, setTuyaAccessId] = useState(data.tuyaAccessId || '');
  const [tuyaAccessSecret, setTuyaAccessSecret] = useState(data.tuyaAccessSecret || '');
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
      alert('Device ID da tomada é obrigatório');
      return;
    }
    if (!tuyaAccessId || !tuyaAccessSecret) {
      alert('Configure as credenciais Tuya primeiro (Access ID e Secret)');
      return;
    }

    setTestResults({ ...testResults, [idx]: 'testing' });
    try {
      const res = await fetch('/api/setup/test/smartplug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceId: plug.deviceId,
          accessId: tuyaAccessId,
          accessSecret: tuyaAccessSecret
        })
      });
      const result = await res.json();
      
      if (result.ok) {
        setTestResults({ ...testResults, [idx]: 'ok' });
        alert('✓ Teste bem-sucedido! A tomada foi ligada e desligada.');
      } else {
        setTestResults({ ...testResults, [idx]: 'error' });
        alert(`✗ Falha no teste: ${result.error || 'Verifique as credenciais Tuya e Device ID'}`);
      }
    } catch (err) {
      setTestResults({ ...testResults, [idx]: 'error' });
      alert(`Erro ao testar tomada: ${err.message}`);
    }
  };

  const handleSubmit = () => {
    onNext({ plugs, tuyaAccessId, tuyaAccessSecret });
  };

  return html`
    <${Card} title="Passo 7: Tomadas Inteligentes">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure as tomadas inteligentes Tuya. São usadas para ligar/desligar TVs e outros equipamentos 
        por energia. Requer credenciais da Tuya Cloud.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--warn);">
          <h4 style="margin: 0 0 1rem 0;">Credenciais Tuya Cloud</h4>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                Tuya Access ID
              </label>
              <input 
                type="text" 
                value=${tuyaAccessId}
                onInput=${e => setTuyaAccessId(e.target.value)}
                placeholder="accessId123..."
                style="width: 100%; font-family: monospace;"
              />
              <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                Encontrado no console Tuya IoT Platform (iot.tuya.com) → Cloud → Authorization
              </small>
            </div>

            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                Tuya Access Secret
              </label>
              <input 
                type="password" 
                value=${tuyaAccessSecret}
                onInput=${e => setTuyaAccessSecret(e.target.value)}
                placeholder="••••••••"
                style="width: 100%; font-family: monospace;"
              />
              <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                Junto do Access ID no console Tuya. Mantenha em segredo!
              </small>
            </div>
          </div>
        </div>

        ${plugs.map((plug, idx) => html`
          <div key=${plug.id} style="border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 4px; background: var(--bg-elevated);">
            <h4 style="margin: 0 0 1rem 0;">Tomada ${idx + 1}</h4>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  Nome/Apelido
                </label>
                <input 
                  type="text" 
                  value=${plug.name}
                  onInput=${e => updatePlug(idx, 'name', e.target.value)}
                  placeholder="Plug TV Sala 1"
                  style="width: 100%;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  Apelido para identificar (ex: 'Plug TV Sala 1', 'Plug Projetor')
                </small>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  Device ID *
                </label>
                <input 
                  type="text" 
                  value=${plug.deviceId}
                  onInput=${e => updatePlug(idx, 'deviceId', e.target.value)}
                  placeholder="bf1234567890abcdef"
                  style="width: 100%; font-family: monospace;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  ID do dispositivo Tuya. Encontrado no app Tuya Smart → dispositivo → ícone de editar → Device ID
                </small>
              </div>

              <div>
                <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
                  IP (opcional)
                </label>
                <input 
                  type="text" 
                  value=${plug.ip}
                  onInput=${e => updatePlug(idx, 'ip', e.target.value)}
                  placeholder="192.168.0.60"
                  style="width: 100%; font-family: monospace;"
                />
                <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
                  IP da tomada na rede (opcional, ajuda no diagnóstico)
                </small>
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
              <button class="btn btn-sm" onClick=${() => testPlug(idx)}>
                🔌 Testar Liga/Desliga
              </button>
              <button class="btn btn-sm btn-danger" onClick=${() => removePlug(idx)}>
                🗑️ Remover
              </button>
              ${testResults[idx] && html`
                <${StatusDot} status=${testResults[idx]} />
              `}
              ${testResults[idx] === 'testing' && html`
                <small style="color: var(--dimmed);">Testando...</small>
              `}
            </div>
          </div>
        `)}

        <button class="btn" onClick=${addPlug} style="align-self: flex-start;">
          ➕ Adicionar Tomada
        </button>

        <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            Se não tiver tomadas inteligentes, pule este passo. O sistema funciona sem elas. 
            As tomadas Tuya são úteis para ligar/desligar TVs que não respondem a Wake-on-LAN.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${handleSubmit}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 8: Visão Computacional ─────────────────────────
function Step8CV({ data, onNext, onSkip, onPrevious }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [testStatus, setTestStatus] = useState(null);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [detectingGPU, setDetectingGPU] = useState(false);

  const detectGPU = async () => {
    setDetectingGPU(true);
    try {
      const res = await fetch('/api/setup/test/gpu', { method: 'POST' });
      const result = await res.json();
      
      if (result.ok && result.gpu) {
        setGpuInfo(result.gpu);
        alert(`✓ GPU detectada!\n\nModelo: ${result.gpu.name}\nVRAM: ${result.gpu.vram}GB\nModelo YOLO recomendado: ${result.gpu.recommendedModel}`);
      } else {
        alert('⚠️ Nenhuma GPU NVIDIA detectada. A visão computacional requer GPU NVIDIA para funcionar.');
        setGpuInfo(null);
      }
    } catch (err) {
      alert(`Erro ao detectar GPU: ${err.message}`);
    } finally {
      setDetectingGPU(false);
    }
  };

  const testCV = async () => {
    if (!enabled) {
      alert('Habilite a visão computacional primeiro');
      return;
    }

    setTestStatus('testing');
    try {
      const res = await fetch('/api/setup/test/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const result = await res.json();
      
      if (result.ok) {
        setTestStatus('ok');
        alert('✓ Teste de visão computacional bem-sucedido! O sistema está pronto para detectar pessoas.');
      } else {
        setTestStatus('error');
        alert(`✗ Falha no teste: ${result.error || 'Verifique se a GPU está disponível'}`);
      }
    } catch (err) {
      setTestStatus('error');
      alert(`Erro ao testar CV: ${err.message}`);
    }
  };

  return html`
    <${Card} title="Passo 8: Visão Computacional">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure a detecção de pessoas por visão computacional. O sistema usa YOLO para detectar visitantes 
        e gerar dados de público. Precisa de GPU NVIDIA.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input 
              type="checkbox" 
              checked=${enabled}
              onChange=${e => setEnabled(e.target.checked)}
            />
            <span style="font-weight: 500;">Habilitar Visão Computacional</span>
          </label>
          <small style="display: block; color: var(--dimmed); margin-top: 0.5rem; margin-left: 1.5rem;">
            Ativa a contagem de visitantes e rastreamento ReID (identificação de pessoas únicas)
          </small>
        </div>

        ${enabled && html`
          <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px;">
            <h4 style="margin: 0 0 1rem 0;">Detecção de Hardware</h4>
            
            <button 
              class="btn" 
              onClick=${detectGPU}
              disabled=${detectingGPU}
              style="margin-bottom: 1rem;"
            >
              ${detectingGPU ? 'Detectando...' : '🔍 Detectar GPU'}
            </button>

            ${gpuInfo && html`
              <div style="padding: 1rem; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--success);">
                <div style="display: flex; flex-direction: column; gap: 0.5rem; font-family: monospace; font-size: 0.9rem;">
                  <div><strong>GPU:</strong> ${gpuInfo.name}</div>
                  <div><strong>VRAM:</strong> ${gpuInfo.vram}GB</div>
                  <div><strong>Modelo YOLO recomendado:</strong> ${gpuInfo.recommendedModel}</div>
                </div>
              </div>
            `}

            ${!gpuInfo && !detectingGPU && html`
              <div style="padding: 0.75rem; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--warn);">
                <small style="color: var(--dimmed);">
                  ⚠️ Nenhuma GPU detectada ainda. Clique em "Detectar GPU" para verificar o hardware disponível.
                </small>
              </div>
            `}
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn" onClick=${testCV}>
              🎯 Testar Detecção
            </button>
            ${testStatus && html`<${StatusDot} status=${testStatus} />`}
            ${testStatus === 'testing' && html`
              <small style="color: var(--dimmed);">Testando...</small>
            `}
          </div>
        `}

        <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            Se a máquina não tiver GPU NVIDIA, desabilite este passo. A detecção usa a GPU — 
            quanto mais VRAM, mais câmeras simultâneas e mais precisão. Mínimo recomendado: 4GB VRAM.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ enabled, gpu: gpuInfo })}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 9: Conexão com Portal AYA ──────────────────────
function Step9Portal({ data, onNext, onSkip, onPrevious }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [projetoSlug, setProjetoSlug] = useState(data.projetoSlug || '');
  const [testStatus, setTestStatus] = useState(null);

  const testPortal = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/setup/test/portal', { method: 'POST' });
      const result = await res.json();
      
      if (result.ok) {
        setTestStatus('ok');
        alert(`✓ Conexão com internet bem-sucedida!\n\nLatência: ${result.latency}ms\nPortal AYA alcançável: ${result.portalReachable ? 'Sim' : 'Não'}`);
      } else {
        setTestStatus('error');
        alert(`✗ Sem conexão com internet: ${result.error || 'Verifique o cabo de rede ou 4G'}`);
      }
    } catch (err) {
      setTestStatus('error');
      alert(`Erro ao testar conexão: ${err.message}`);
    }
  };

  return html`
    <${Card} title="Passo 9: Conexão com Portal AYA">
      <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
        Configure a conexão com o Portal AYA para monitoramento remoto. Necessita de internet (4G, Wi-Fi ou cabo). 
        Se não tiver internet no local, pule este passo — o sistema funciona 100% offline.
      </p>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input 
              type="checkbox" 
              checked=${enabled}
              onChange=${e => setEnabled(e.target.checked)}
            />
            <span style="font-weight: 500;">Habilitar Sincronização com Portal AYA</span>
          </label>
          <small style="display: block; color: var(--dimmed); margin-top: 0.5rem; margin-left: 1.5rem;">
            Envia dados de status e público para o Portal AYA. Requer internet estável.
          </small>
        </div>

        ${enabled && html`
          <div>
            <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
              Slug do Projeto
            </label>
            <input 
              type="text" 
              value=${projetoSlug}
              onInput=${e => setProjetoSlug(e.target.value)}
              placeholder="amano-rio"
              style="width: 100%; font-family: monospace;"
            />
            <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
              Mesmo slug da exposição (Passo 1). Será usado para identificar esta expo no Portal AYA.
            </small>
          </div>
        `}

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn" onClick=${testPortal}>
            🌐 Testar Conexão
          </button>
          ${testStatus && html`<${StatusDot} status=${testStatus} />`}
          ${testStatus === 'testing' && html`
            <small style="color: var(--dimmed);">Testando...</small>
          `}
        </div>

        <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            O Portal AYA é opcional. Todos os dados são salvos localmente (SQLite). 
            O Portal serve apenas para monitoramento remoto pela equipe e visualização de métricas em tempo real.
            Se não tiver internet no local, o sistema continua funcionando normalmente.
          </small>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          ${onPrevious && html`<button class="btn" onClick=${onPrevious}>Anterior</button>`}
          <button class="btn btn-primary" onClick=${() => onNext({ enabled, projetoSlug })}>Próximo</button>
          <button class="btn btn-secondary" onClick=${onSkip}>Pular</button>
        </div>
      </div>
    <//>
  `;
}

// ─── Passo 10: Horários e Revisão ─────────────────────────
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
  const [timezone, setTimezone] = useState(data.timezone || 'America/Sao_Paulo');
  const [generating, setGenerating] = useState(false);

  const dayNames = {
    mon: 'Segunda-feira',
    tue: 'Terça-feira',
    wed: 'Quarta-feira',
    thu: 'Quinta-feira',
    fri: 'Sexta-feira',
    sat: 'Sábado',
    sun: 'Domingo'
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
      alert('❌ Campo obrigatório faltando: Slug da exposição (Passo 1).\n\nVolte ao Passo 1 e preencha o slug.');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/setup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            data: { ...allData, schedule: { days: schedule, timezone } }
          }
        })
      });
      
      const result = await res.json();
      
      if (result.ok) {
        alert(`✅ Configuração gerada com sucesso!\n\nArquivo salvo em: config/${result.slug}.json\n\nReinicie o servidor com:\nnode index.js --config=${result.slug}\n\nVocê será redirecionado para o dashboard.`);
        // Redireciona para o dashboard
        setTimeout(() => {
          location.hash = '/dashboard';
        }, 1000);
      } else {
        alert(`❌ Falha ao gerar configuração: ${result.error}`);
      }
    } catch (err) {
      alert(`❌ Erro ao gerar configuração: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return html`
    <div>
      <${Card} title="Passo 10: Horários de Funcionamento">
        <p style="color: var(--dimmed); margin-bottom: 1.5rem;">
          Defina os horários de abertura e fechamento da exposição para cada dia da semana. 
          O sistema vai ligar e desligar automaticamente todos os equipamentos nos horários configurados.
        </p>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">
              Fuso Horário
            </label>
            <select 
              value=${timezone}
              onChange=${e => setTimezone(e.target.value)}
              style="width: 100%;"
            >
              <option value="America/Sao_Paulo">América/São Paulo (BRT/BRST)</option>
              <option value="America/Manaus">América/Manaus (AMT)</option>
              <option value="America/Recife">América/Recife (BRT)</option>
              <option value="America/Fortaleza">América/Fortaleza (BRT)</option>
            </select>
            <small style="color: var(--dimmed); display: block; margin-top: 0.25rem;">
              Fuso horário local da exposição
            </small>
          </div>

          ${Object.entries(dayNames).map(([key, name]) => html`
            <div key=${key} style="display: flex; gap: 1rem; align-items: center; padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px;">
              <label style="min-width: 140px; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input 
                  type="checkbox" 
                  checked=${schedule[key] !== null}
                  onChange=${() => toggleDay(key)}
                />
                <span style="font-weight: 500;">${name}</span>
              </label>
              
              ${schedule[key] ? html`
                <div style="display: flex; gap: 0.5rem; align-items: center; flex: 1;">
                  <input 
                    type="time" 
                    value=${schedule[key].open}
                    onInput=${e => updateDay(key, 'open', e.target.value)}
                    style="font-family: monospace;"
                  />
                  <span style="color: var(--dimmed);">até</span>
                  <input 
                    type="time" 
                    value=${schedule[key].close}
                    onInput=${e => updateDay(key, 'close', e.target.value)}
                    style="font-family: monospace;"
                  />
                </div>
              ` : html`
                <span style="color: var(--dimmed); font-style: italic;">Fechado</span>
              `}
            </div>
          `)}
        </div>

        <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info);">
          <strong style="display: block; margin-bottom: 0.5rem;">💡 Dica</strong>
          <small style="color: var(--dimmed);">
            Segunda-feira geralmente é dia de manutenção (fechado). Os horários incluem margem de segurança — 
            configure 15 minutos antes da abertura ao público para dar tempo dos equipamentos ligarem e estabilizarem.
          </small>
        </div>
      <//>

      <${Card} title="Revisão da Configuração" style="margin-top: 2rem;">
        <p style="color: var(--dimmed); margin-bottom: 1rem;">
          Revise todas as configurações antes de gerar o arquivo final.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; font-size: 0.95rem;">
          <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px;">
            <strong style="display: block; margin-bottom: 0.5rem; color: var(--primary);">📋 Exposição</strong>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; color: var(--dimmed);">
              <div><strong>Nome:</strong> ${allData.expo?.name || '(não configurado)'}</div>
              <div><strong>Slug:</strong> ${allData.expo?.slug || '(não configurado)'}</div>
              <div><strong>Local:</strong> ${allData.expo?.venue || '—'}</div>
              <div><strong>Cidade:</strong> ${allData.expo?.city || '—'}</div>
            </div>
          </div>

          <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px;">
            <strong style="display: block; margin-bottom: 0.5rem; color: var(--primary);">🎛️ Equipamentos</strong>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; color: var(--dimmed);">
              <div><strong>Projetores:</strong> ${allData.projectors?.projectors?.length || 0}</div>
              <div><strong>Câmeras:</strong> ${allData.cameras?.cameras?.length || 0}</div>
              <div><strong>TVs:</strong> ${allData.tvs?.tvs?.length || 0}</div>
              <div><strong>Tomadas:</strong> ${allData.smartplugs?.plugs?.length || 0}</div>
            </div>
          </div>

          <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px;">
            <strong style="display: block; margin-bottom: 0.5rem; color: var(--primary);">⚙️ Recursos</strong>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; color: var(--dimmed);">
              <div><strong>Visão Computacional:</strong> ${allData.cv?.enabled !== false ? '✓ Ativada' : '✗ Desativada'}</div>
              <div><strong>Portal AYA:</strong> ${allData.portal?.enabled !== false ? '✓ Ativado' : '✗ Desativado'}</div>
              <div><strong>Áudio:</strong> ${allData.audio?.volume ? `${allData.audio.volume}%` : '—'}</div>
            </div>
          </div>

          <div style="padding: 1rem; background: var(--bg-elevated); border-radius: 4px;">
            <strong style="display: block; margin-bottom: 0.5rem; color: var(--primary);">🕐 Horários</strong>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; color: var(--dimmed); font-size: 0.85rem;">
              ${Object.entries(dayNames).map(([key, name]) => html`
                <div>
                  <strong>${name.substr(0, 3)}:</strong> 
                  ${schedule[key] ? `${schedule[key].open} - ${schedule[key].close}` : 'Fechado'}
                </div>
              `)}
            </div>
          </div>
        </div>
      <//>

      <div style="display: flex; gap: 0.5rem; margin-top: 2rem; align-items: stretch;">
        ${onPrevious && html`
          <button class="btn" onClick=${onPrevious} style="padding: 1rem;">
            ← Anterior
          </button>
        `}
        <button 
          class="btn btn-primary" 
          style="flex: 1; padding: 1.25rem; font-size: 1.1em; font-weight: 600;"
          onClick=${handleGenerate}
          disabled=${generating}
        >
          ${generating ? '⏳ Gerando configuração...' : '✓ Gerar Configuração Final'}
        </button>
      </div>

      ${generating && html`
        <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-elevated); border-radius: 4px; border-left: 3px solid var(--info); text-align: center;">
          <small style="color: var(--dimmed);">
            Aguarde... Gerando arquivo de configuração e salvando no diretório config/
          </small>
        </div>
      `}
    </div>
  `;
}
