// Setup Wizard — Assistente de Instalação em 10 Passos (Sprint 2 - v2.1)
// Guiado, profissional, em português, com testes inline
import { html, useState, useEffect } from '../app.js';
import Card from '../components/base/card.js';
import Badge from '../components/base/badge.js';
import Button from '../components/base/button.js';
import InputField from '../components/base/input-field.js';
import StatusDot from '../components/base/status-dot.js';
import { WizardProgress, TestButton, EquipmentCard } from '../components/composed/index.js';
import ZoneCanvas from '../components/composed/zone-canvas.js';

// ─── Configuração dos Passos ──────────────────────────────────
const STEPS = [
  { num: 1, title: 'Informações', key: 'expo' },
  { num: 2, title: 'Rede', key: 'network' },
  { num: 3, title: 'Projetores', key: 'projectors' },
  { num: 4, title: 'Câmeras', key: 'cameras' },
  { num: 5, title: 'TVs', key: 'tvs' },
  { num: 6, title: 'Áudio', key: 'audio' },
  { num: 7, title: 'Tomadas', key: 'smartplugs' },
  { num: 8, title: 'Visão Comp.', key: 'cv' },
  { num: 9, title: 'Portal AYA', key: 'portal' },
  { num: 10, title: 'Revisão', key: 'schedule' }
];

// ─── Componente Principal ──────────────────────────────────
export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
        console.error('[Setup] Erro ao carregar estado:', err);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  // Salva estado
  const saveState = async (updates = {}) => {
    const state = {
      currentStep: updates.currentStep !== undefined ? updates.currentStep : currentStep,
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
      console.error('[Setup] Erro ao salvar estado:', err);
    }
  };

  // Atualiza dados do step atual
  const updateStepData = (stepKey, newData) => {
    const updated = { ...data, [stepKey]: newData };
    setData(updated);
    saveState({ data: updated });
  };

  // Navegar entre steps
  const goToStep = (stepNum) => {
    setCurrentStep(stepNum);
    saveState({ currentStep: stepNum });
  };

  const handleNext = () => {
    const newCompleted = [...new Set([...completed, currentStep])];
    const newSkipped = skipped.filter(s => s !== currentStep);
    
    setCompleted(newCompleted);
    setSkipped(newSkipped);
    
    if (currentStep < STEPS.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveState({
        currentStep: nextStep,
        completed: newCompleted,
        skipped: newSkipped
      });
    }
  };

  const handleSkip = () => {
    const newSkipped = [...new Set([...skipped, currentStep])];
    const newCompleted = completed.filter(s => s !== currentStep);
    
    setSkipped(newSkipped);
    setCompleted(newCompleted);
    
    if (currentStep < STEPS.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveState({
        currentStep: nextStep,
        completed: newCompleted,
        skipped: newSkipped
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveState({ currentStep: prevStep });
    }
  };

  // Gera configuração final
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/setup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: { data, completed, skipped } })
      });
      
      const result = await res.json();
      
      if (result.ok) {
        alert(`✓ Configuração gerada com sucesso!\n\nArquivo: ${result.slug}.json\n\nO servidor será reiniciado automaticamente.`);
        setTimeout(() => {
          location.href = '/#/dashboard';
        }, 2000);
      } else {
        alert(`✗ Erro ao gerar configuração:\n\n${result.error}`);
      }
    } catch (err) {
      alert(`✗ Erro ao gerar configuração:\n\n${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return html`<div style="padding: 2rem; text-align: center;">Carregando...</div>`;
  }

  const currentStepKey = STEPS[currentStep - 1]?.key;

  return html`
    <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 1.5rem;">
        <h1 style="margin-bottom: 0.5rem;">Assistente de Instalação</h1>
        <p style="color: var(--muted-foreground);">
          Configure o AYA Expo Tools passo a passo
        </p>
      </div>

      <${WizardProgress}
        steps=${STEPS}
        currentStep=${currentStep}
        completed=${completed}
        skipped=${skipped}
        onStepClick=${goToStep}
      />

      <div class="wizard-content">
        ${currentStep === 1 && html`<${Step1} data=${data.expo || {}} onChange=${(d) => updateStepData('expo', d)} />`}
        ${currentStep === 2 && html`<${Step2} data=${data.network || {}} onChange=${(d) => updateStepData('network', d)} />`}
        ${currentStep === 3 && html`<${Step3} data=${data.projectors || []} onChange=${(d) => updateStepData('projectors', d)} />`}
        ${currentStep === 4 && html`<${Step4} data=${data.cameras || []} onChange=${(d) => updateStepData('cameras', d)} />`}
        ${currentStep === 5 && html`<${Step5} data=${data.tvs || []} onChange=${(d) => updateStepData('tvs', d)} />`}
        ${currentStep === 6 && html`<${Step6} data=${data.audio || {}} onChange=${(d) => updateStepData('audio', d)} />`}
        ${currentStep === 7 && html`<${Step7} data=${data.smartplugs || []} onChange=${(d) => updateStepData('smartplugs', d)} />`}
        ${currentStep === 8 && html`<${Step8} data=${data.cv || {}} onChange=${(d) => updateStepData('cv', d)} />`}
        ${currentStep === 9 && html`<${Step9} data=${data.portal || {}} onChange=${(d) => updateStepData('portal', d)} />`}
        ${currentStep === 10 && html`<${Step10} 
          data=${data.schedule || {}} 
          onChange=${(d) => updateStepData('schedule', d)}
          allData=${data}
          onGenerate=${handleGenerate}
          generating=${generating}
        />`}

        <!-- Navigation -->
        <div style="display: flex; justify-content: space-between; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
          <${Button}
            label="Anterior"
            variant="ghost"
            onClick=${handlePrevious}
            disabled=${currentStep === 1}
          />
          
          <div style="display: flex; gap: 0.75rem;">
            ${currentStep < STEPS.length && html`
              <${Button}
                label="Pular"
                variant="secondary"
                onClick=${handleSkip}
              />
            `}
            
            ${currentStep < STEPS.length && html`
              <${Button}
                label="Próximo"
                variant="primary"
                onClick=${handleNext}
              />
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 1: INFORMAÇÕES DA EXPOSIÇÃO
// ═══════════════════════════════════════════════════════════
function Step1({ data, onChange }) {
  const [state, setState] = useState({
    name: data.name || '',
    venue: data.venue || '',
    city: data.city || '',
    artist: data.artist || '',
    slug: data.slug || '',
    openDate: data.openDate || '',
    closeDate: data.closeDate || ''
  });

  // Auto-gerar slug a partir do nome
  useEffect(() => {
    if (state.name && !data.slug) {
      const autoSlug = state.name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setState(prev => ({ ...prev, slug: autoSlug }));
    }
  }, [state.name]);

  useEffect(() => {
    onChange(state);
  }, [state]);

  const updateField = (field, value) => {
    setState(prev => ({ ...prev, [field]: value }));
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Informações da Exposição</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Identifique a exposição. Esses dados aparecem nos relatórios e no painel principal.
        </p>
      </div>

      <${InputField}
        label="Nome da Exposição"
        value=${state.name}
        onChange=${(v) => updateField('name', v)}
        placeholder="Yoshitaka Amano — CCBB Rio"
        helpText="Nome completo como aparece no material de divulgação"
        required=${true}
      />

      <${InputField}
        label="Local"
        value=${state.venue}
        onChange=${(v) => updateField('venue', v)}
        placeholder="CCBB Rio de Janeiro"
        helpText="Nome do espaço ou venue"
      />

      <${InputField}
        label="Cidade"
        value=${state.city}
        onChange=${(v) => updateField('city', v)}
        placeholder="Rio de Janeiro"
      />

      <${InputField}
        label="Artista"
        value=${state.artist}
        onChange=${(v) => updateField('artist', v)}
        placeholder="Yoshitaka Amano"
        helpText="Nome do artista ou grupo. Opcional"
      />

      <${InputField}
        label="Slug"
        value=${state.slug}
        onChange=${(v) => updateField('slug', v)}
        placeholder="amano-ccbb-rio"
        helpText="Identificador curto sem espaços. Será o nome do arquivo de configuração"
        mono=${true}
        required=${true}
      />

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <${InputField}
          label="Data de Abertura"
          value=${state.openDate}
          onChange=${(v) => updateField('openDate', v)}
          type="date"
        />

        <${InputField}
          label="Data de Encerramento"
          value=${state.closeDate}
          onChange=${(v) => updateField('closeDate', v)}
          type="date"
        />
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 2: REDE
// ═══════════════════════════════════════════════════════════
function Step2({ data, onChange }) {
  const [mediaServer, setMediaServer] = useState(data.mediaServer || '');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    onChange({ mediaServer });
  }, [mediaServer]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/setup/test/network-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      
      if (result.ok && result.devices) {
        setDevices(result.devices);
      } else {
        alert('Nenhum dispositivo encontrado na rede.');
      }
    } catch (err) {
      alert(`Erro no scan: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Rede</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Vamos descobrir os equipamentos na rede local. Conecte todos os equipamentos (projetores, câmeras, TVs) ao switch antes de escanear.
        </p>
      </div>

      <${InputField}
        label="IP do Media Server"
        value=${mediaServer}
        onChange=${setMediaServer}
        placeholder="192.168.0.10"
        helpText="IP desta máquina na rede. Se não souber, deixe em branco — o scan vai detectar"
        mono=${true}
      />

      <div>
        <${Button}
          label=${scanning ? 'Escaneando...' : 'Escanear Rede'}
          variant="primary"
          onClick=${handleScan}
          disabled=${scanning}
        />
      </div>

      ${devices.length > 0 && html`
        <${Card} title="Dispositivos Encontrados">
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${devices.map(device => html`
              <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                <span class="mono">${device.ip}</span>
                <${Badge} variant="muted">${device.mac}</${Badge}>
              </div>
            `)}
          </div>
        </${Card}>
      `}

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>Todos os equipamentos precisam estar ligados e no mesmo switch/rede</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 3: PROJETORES
// ═══════════════════════════════════════════════════════════
function Step3({ data, onChange }) {
  const [projectors, setProjectors] = useState(data || []);

  useEffect(() => {
    onChange(projectors);
  }, [projectors]);

  const addProjector = () => {
    setProjectors([...projectors, {
      id: `proj-${Date.now()}`,
      name: '',
      ip: '',
      port: '4352',
      password: '',
      status: 'untested'
    }]);
  };

  const updateProjector = (index, field, value) => {
    const updated = [...projectors];
    updated[index] = { ...updated[index], [field]: value };
    setProjectors(updated);
  };

  const removeProjector = (index) => {
    setProjectors(projectors.filter((_, i) => i !== index));
  };

  const testProjector = (index) => {
    return async () => {
      const proj = projectors[index];
      const res = await fetch('/api/setup/test/projector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: proj.ip, port: proj.port, password: proj.password })
      });
      const result = await res.json();
      
      // Update status
      const updated = [...projectors];
      updated[index].status = result.ok ? 'ok' : 'error';
      setProjectors(updated);
      
      return result;
    };
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Projetores</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure os projetores controlados por PJLink. Cada projetor precisa de IP fixo e PJLink habilitado nas configurações de rede.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${projectors.map((proj, index) => html`
          <${EquipmentCard}
            name=${proj.name || `Projetor ${index + 1}`}
            ip=${proj.ip}
            status=${proj.status}
            onRemove=${() => removeProjector(index)}
            onTest=${testProjector(index)}
            testLabel="Testar Conexão"
            successMessage="Conectado via PJLink"
            failMessage="Não conectou. Verifique: 1) projetor ligado? 2) PJLink habilitado? 3) IP correto?"
          >
            <${InputField}
              label="Nome"
              value=${proj.name}
              onChange=${(v) => updateProjector(index, 'name', v)}
              placeholder="Projetor Sala 1"
            />

            <${InputField}
              label="IP"
              value=${proj.ip}
              onChange=${(v) => updateProjector(index, 'ip', v)}
              placeholder="192.168.0.20"
              helpText="IP fixo do projetor. Encontrado no menu Rede do projetor ou no scan anterior"
              mono=${true}
            />

            <${InputField}
              label="Porta"
              value=${proj.port}
              onChange=${(v) => updateProjector(index, 'port', v)}
              placeholder="4352"
              helpText="Porta PJLink. Padrão 4352. Só mude se o projetor estiver configurado diferente"
              mono=${true}
            />

            <${InputField}
              label="Senha PJLink"
              value=${proj.password}
              onChange=${(v) => updateProjector(index, 'password', v)}
              type="password"
              placeholder=""
              helpText="Senha PJLink do projetor. Se não tiver, deixe em branco"
            />
          </${EquipmentCard}>
        `)}
      </div>

      <${Button}
        label="Adicionar Projetor"
        variant="secondary"
        onClick=${addProjector}
      />

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>O projetor precisa estar ligado e com PJLink habilitado no menu de rede</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 4: CÂMERAS
// ═══════════════════════════════════════════════════════════
function Step4({ data, onChange }) {
  const [cameras, setCameras] = useState(data || []);

  useEffect(() => {
    onChange(cameras);
  }, [cameras]);

  const addCamera = () => {
    setCameras([...cameras, {
      id: `cam-${Date.now()}`,
      name: '',
      ip: '',
      username: 'admin',
      password: '',
      channel: '1',
      rtsp: '',
      status: 'untested'
    }]);
  };

  const updateCamera = (index, field, value) => {
    const updated = [...cameras];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-build RTSP URL
    const cam = updated[index];
    if (cam.ip && cam.username && cam.password && cam.channel) {
      updated[index].rtsp = `rtsp://${cam.username}:${cam.password}@${cam.ip}:554/cam/realmonitor?channel=${cam.channel}&subtype=0`;
    }
    
    setCameras(updated);
  };

  const removeCamera = (index) => {
    setCameras(cameras.filter((_, i) => i !== index));
  };

  const testCamera = (index) => {
    return async () => {
      const cam = cameras[index];
      const res = await fetch('/api/setup/test/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp: cam.rtsp })
      });
      const result = await res.json();
      
      // Update status
      const updated = [...cameras];
      updated[index].status = result.ok ? 'ok' : 'error';
      setCameras(updated);
      
      return result;
    };
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Câmeras</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure as câmeras IP para timelapse e visão computacional. Cada câmera precisa de URL RTSP e credenciais.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${cameras.map((cam, index) => html`
          <${EquipmentCard}
            name=${cam.name || `Câmera ${index + 1}`}
            ip=${cam.ip}
            status=${cam.status}
            onRemove=${() => removeCamera(index)}
            onTest=${testCamera(index)}
            testLabel="Capturar Snapshot"
            successMessage="Snapshot capturado com sucesso"
            failMessage="Câmera não respondeu. Tente: 1) Verifique IP e senha 2) A câmera está ligada? 3) O formato RTSP pode ser diferente — peça ao instalador"
          >
            <${InputField}
              label="ID"
              value=${cam.id}
              onChange=${(v) => updateCamera(index, 'id', v)}
              placeholder="cam-1"
              helpText="Identificador único. Use cam-1, cam-2, cam-entrada, etc"
              mono=${true}
            />

            <${InputField}
              label="IP"
              value=${cam.ip}
              onChange=${(v) => updateCamera(index, 'ip', v)}
              placeholder="192.168.0.107"
              mono=${true}
            />

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <${InputField}
                label="Usuário"
                value=${cam.username}
                onChange=${(v) => updateCamera(index, 'username', v)}
                placeholder="admin"
                helpText="Usuário de acesso. Geralmente 'admin'"
              />

              <${InputField}
                label="Senha"
                value=${cam.password}
                onChange=${(v) => updateCamera(index, 'password', v)}
                type="password"
                helpText="Senha da câmera. Consulte quem instalou as câmeras"
              />
            </div>

            <${InputField}
              label="Canal"
              value=${cam.channel}
              onChange=${(v) => updateCamera(index, 'channel', v)}
              placeholder="1"
              helpText="Canal de vídeo. Câmeras simples usam canal 1"
              mono=${true}
            />

            <div style="background: var(--muted); padding: 0.75rem; border-radius: var(--radius); font-family: var(--font-mono); font-size: 0.75rem; overflow-x: auto;">
              ${cam.rtsp || 'URL RTSP será gerada automaticamente'}
            </div>
          </${EquipmentCard}>
        `)}
      </div>

      <${Button}
        label="Adicionar Câmera"
        variant="secondary"
        onClick=${addCamera}
      />

      ${cameras.some(c => c.status === 'ok') && html`
        <${Card} title="Zonas de Detecção">
          <p style="color: var(--muted-foreground); font-size: 0.875rem; margin-bottom: 1rem;">
            Desenhe polígonos sobre o snapshot para definir zonas de contagem de visitantes.
            Clique para adicionar pontos, duplo-clique para fechar a zona.
          </p>
          ${cameras.filter(c => c.status === 'ok').map((cam, i) => html`
            <div style="margin-bottom: 1.5rem;">
              <h4 style="margin-bottom: 0.5rem;">${cam.name || cam.id}</h4>
              <${ZoneCanvas}
                snapshotData=${cam.snapshotData}
                zones=${cam.zones || []}
                onZonesChange=${(newZones) => updateCamera(cameras.indexOf(cam), 'zones', newZones)}
              />
            </div>
          `)}
        </${Card}>
      `}

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>A URL RTSP varia por fabricante. Intelbras: /cam/realmonitor. Hikvision: /Streaming/Channels/101</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 5: TVS
// ═══════════════════════════════════════════════════════════
function Step5({ data, onChange }) {
  const [tvs, setTvs] = useState(data || []);

  useEffect(() => {
    onChange(tvs);
  }, [tvs]);

  const addTV = () => {
    setTvs([...tvs, {
      id: `tv-${Date.now()}`,
      name: '',
      ip: '',
      mac: '',
      status: 'untested'
    }]);
  };

  const updateTV = (index, field, value) => {
    const updated = [...tvs];
    updated[index] = { ...updated[index], [field]: value };
    setTvs(updated);
  };

  const removeTV = (index) => {
    setTvs(tvs.filter((_, i) => i !== index));
  };

  const testTV = (index) => {
    return async () => {
      const tv = tvs[index];
      const res = await fetch('/api/setup/test/tv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: tv.ip, mac: tv.mac })
      });
      const result = await res.json();
      
      // Update status
      const updated = [...tvs];
      updated[index].status = result.ok ? 'ok' : 'error';
      setTvs(updated);
      
      return result;
    };
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">TVs</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure as TVs controladas por Google Cast. As TVs precisam estar na mesma rede com Cast habilitado.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${tvs.map((tv, index) => html`
          <${EquipmentCard}
            name=${tv.name || `TV ${index + 1}`}
            ip=${tv.ip}
            status=${tv.status}
            onRemove=${() => removeTV(index)}
            onTest=${testTV(index)}
            testLabel="Testar Conexão"
            successMessage="TV respondendo"
            failMessage="TV não respondeu"
          >
            <${InputField}
              label="Nome"
              value=${tv.name}
              onChange=${(v) => updateTV(index, 'name', v)}
              placeholder="TV Sala 1"
            />

            <${InputField}
              label="IP"
              value=${tv.ip}
              onChange=${(v) => updateTV(index, 'ip', v)}
              placeholder="192.168.0.201"
              helpText="IP da TV. Encontrado em Configurações > Rede na TV"
              mono=${true}
            />

            <${InputField}
              label="MAC"
              value=${tv.mac}
              onChange=${(v) => updateTV(index, 'mac', v)}
              placeholder="AA:BB:CC:DD:EE:FF"
              helpText="Endereço MAC para ligar a TV remotamente (Wake-on-LAN). Encontrado em Configurações > Rede > Sobre"
              mono=${true}
            />
          </${EquipmentCard}>
        `)}
      </div>

      <${Button}
        label="Adicionar TV"
        variant="secondary"
        onClick=${addTV}
      />

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>TVs Hisense funcionam melhor com cabo Ethernet. Wi-Fi pode ser instável para Cast</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 6: ÁUDIO
// ═══════════════════════════════════════════════════════════
function Step6({ data, onChange }) {
  const [volume, setVolume] = useState(data.volume || 70);
  const [device, setDevice] = useState(data.device || 'default');

  useEffect(() => {
    onChange({ volume, device });
  }, [volume, device]);

  const testAudio = async () => {
    const res = await fetch('/api/setup/test/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume, device })
    });
    return await res.json();
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Áudio</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure a saída de áudio. O sistema controla o volume principal do Windows.
        </p>
      </div>

      <div>
        <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">
          Volume Master: <strong>${volume}%</strong>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value=${volume}
          onInput=${(e) => setVolume(parseInt(e.target.value))}
          style="width: 100%; accent-color: var(--primary);"
        />
      </div>

      <${TestButton}
        label="Testar Áudio"
        onTest=${testAudio}
        successMessage="Áudio testado"
        failMessage="Erro ao testar áudio"
      />

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>Conecte os cabos de áudio antes deste passo</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 7: TOMADAS INTELIGENTES
// ═══════════════════════════════════════════════════════════
function Step7({ data, onChange }) {
  const [tuyaAccessId, setTuyaAccessId] = useState(data.tuyaAccessId || '');
  const [tuyaAccessSecret, setTuyaAccessSecret] = useState(data.tuyaAccessSecret || '');
  const [plugs, setPlugs] = useState(data.plugs || []);

  useEffect(() => {
    onChange({ tuyaAccessId, tuyaAccessSecret, plugs });
  }, [tuyaAccessId, tuyaAccessSecret, plugs]);

  const addPlug = () => {
    setPlugs([...plugs, {
      id: `plug-${Date.now()}`,
      name: '',
      deviceId: '',
      status: 'untested'
    }]);
  };

  const updatePlug = (index, field, value) => {
    const updated = [...plugs];
    updated[index] = { ...updated[index], [field]: value };
    setPlugs(updated);
  };

  const removePlug = (index) => {
    setPlugs(plugs.filter((_, i) => i !== index));
  };

  const testPlug = (index) => {
    return async () => {
      const plug = plugs[index];
      const res = await fetch('/api/setup/test/smartplug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: plug.deviceId })
      });
      const result = await res.json();
      
      // Update status
      const updated = [...plugs];
      updated[index].status = result.ok ? 'ok' : 'error';
      setPlugs(updated);
      
      return result;
    };
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Tomadas Inteligentes</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure tomadas inteligentes Tuya para ligar/desligar equipamentos por energia. Se não tiver tomadas inteligentes, pule este passo.
        </p>
      </div>

      <${InputField}
        label="Tuya Access ID"
        value=${tuyaAccessId}
        onChange=${setTuyaAccessId}
        placeholder=""
        helpText="Encontrado em iot.tuya.com > Cloud > Authorization"
        mono=${true}
      />

      <${InputField}
        label="Tuya Access Secret"
        value=${tuyaAccessSecret}
        onChange=${setTuyaAccessSecret}
        type="password"
        placeholder=""
        helpText="Junto do Access ID no console Tuya"
        mono=${true}
      />

      ${plugs.length > 0 && html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${plugs.map((plug, index) => html`
            <${EquipmentCard}
              name=${plug.name || `Tomada ${index + 1}`}
              status=${plug.status}
              onRemove=${() => removePlug(index)}
              onTest=${testPlug(index)}
              testLabel="Testar Liga/Desliga"
              successMessage="Tomada respondeu"
              failMessage="Tomada não respondeu"
            >
              <${InputField}
                label="Nome"
                value=${plug.name}
                onChange=${(v) => updatePlug(index, 'name', v)}
                placeholder="Plug TV Sala 1"
              />

              <${InputField}
                label="Device ID"
                value=${plug.deviceId}
                onChange=${(v) => updatePlug(index, 'deviceId', v)}
                placeholder=""
                helpText="No app Tuya Smart > dispositivo > editar > Device ID"
                mono=${true}
              />
            </${EquipmentCard}>
          `)}
        </div>
      `}

      <${Button}
        label="Adicionar Tomada"
        variant="secondary"
        onClick=${addPlug}
        disabled=${!tuyaAccessId || !tuyaAccessSecret}
      />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 8: VISÃO COMPUTACIONAL
// ═══════════════════════════════════════════════════════════
function Step8({ data, onChange }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [selectedCameras, setSelectedCameras] = useState(data.cameras || []);

  useEffect(() => {
    onChange({ enabled, cameras: selectedCameras, gpuInfo });
  }, [enabled, selectedCameras, gpuInfo]);

  useEffect(() => {
    // Auto-detect GPU
    const detectGPU = async () => {
      try {
        const res = await fetch('/api/setup/test/cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const result = await res.json();
        if (result.ok && result.gpu) {
          setGpuInfo(result.gpu);
        }
      } catch (err) {
        console.error('[CV] GPU detection failed:', err);
      }
    };

    if (enabled) {
      detectGPU();
    }
  }, [enabled]);

  const toggleCamera = (cameraId) => {
    if (selectedCameras.includes(cameraId)) {
      setSelectedCameras(selectedCameras.filter(id => id !== cameraId));
    } else {
      setSelectedCameras([...selectedCameras, cameraId]);
    }
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Visão Computacional</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure a detecção de pessoas por visão computacional. Usa GPU NVIDIA para detectar visitantes automaticamente. Se não tiver GPU, pule este passo.
        </p>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <input
          type="checkbox"
          checked=${enabled}
          onChange=${(e) => setEnabled(e.target.checked)}
          style="width: 20px; height: 20px; accent-color: var(--primary);"
        />
        <label style="font-size: 0.875rem;">Habilitar Visão Computacional</label>
      </div>

      ${enabled && gpuInfo && html`
        <${Card} status="ok">
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <strong>GPU Detectada</strong>
            <div style="font-family: var(--font-mono); font-size: 0.875rem; color: var(--muted-foreground);">
              <div>${gpuInfo.name}</div>
              <div>VRAM: ${gpuInfo.vram}</div>
              <div>Modelo recomendado: ${gpuInfo.recommendedModel}</div>
            </div>
          </div>
        </${Card}>
      `}

      ${enabled && !gpuInfo && html`
        <${Card} status="warn">
          <p style="font-size: 0.875rem; color: var(--muted-foreground);">
            Nenhuma GPU NVIDIA detectada. Detecção por CV não estará disponível.
          </p>
        </${Card}>
      `}

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>Quanto mais VRAM, mais câmeras e mais precisão. Mínimo recomendado: 4GB</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 9: PORTAL AYA
// ═══════════════════════════════════════════════════════════
function Step9({ data, onChange }) {
  const [enabled, setEnabled] = useState(data.enabled !== false);
  const [projetoId, setProjetoId] = useState(data.projetoId || '');

  useEffect(() => {
    onChange({ enabled, projetoId });
  }, [enabled, projetoId]);

  const testInternet = async () => {
    const res = await fetch('/api/setup/test/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return await res.json();
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Conexão Remota (Portal AYA)</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Configure conexão com o Portal AYA para monitoramento remoto. O sistema funciona 100% offline — o Portal é opcional.
        </p>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <input
          type="checkbox"
          checked=${enabled}
          onChange=${(e) => setEnabled(e.target.checked)}
          style="width: 20px; height: 20px; accent-color: var(--primary);"
        />
        <label style="font-size: 0.875rem;">Habilitar Portal</label>
      </div>

      ${enabled && html`
        <${InputField}
          label="Slug do Projeto"
          value=${projetoId}
          onChange=${setProjetoId}
          placeholder=""
          helpText="Slug do projeto no Portal AYA (mesmo que o slug da exposição)"
          mono=${true}
        />
      `}

      ${enabled && html`
        <${TestButton}
          label="Testar Internet"
          onTest=${testInternet}
          successMessage="Internet disponível"
          failMessage="Sem conexão com a internet"
        />
      `}

      <${Card} status="info">
        <div style="display: flex; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
          <span>💡</span>
          <p>Todos os dados são salvos localmente. O Portal serve apenas para acompanhamento remoto</p>
        </div>
      </${Card}>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// STEP 10: HORÁRIOS E REVISÃO
// ═══════════════════════════════════════════════════════════
function Step10({ data, onChange, allData, onGenerate, generating }) {
  const [schedule, setSchedule] = useState(data.days || {
    mon: null,
    tue: { open: '09:00', close: '20:00' },
    wed: { open: '09:00', close: '20:00' },
    thu: { open: '09:00', close: '20:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '20:00' },
    sun: { open: '09:00', close: '20:00' }
  });

  useEffect(() => {
    onChange({ days: schedule });
  }, [schedule]);

  const dayLabels = {
    mon: 'Segunda',
    tue: 'Terça',
    wed: 'Quarta',
    thu: 'Quinta',
    fri: 'Sexta',
    sat: 'Sábado',
    sun: 'Domingo'
  };

  const toggleDay = (day) => {
    if (schedule[day]) {
      setSchedule({ ...schedule, [day]: null });
    } else {
      setSchedule({ ...schedule, [day]: { open: '09:00', close: '20:00' } });
    }
  };

  const updateTime = (day, field, value) => {
    setSchedule({
      ...schedule,
      [day]: { ...schedule[day], [field]: value }
    });
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <div>
        <h2 style="margin-bottom: 0.5rem;">Horários e Revisão</h2>
        <p style="color: var(--muted-foreground); font-size: 0.875rem;">
          Defina os horários de abertura e fechamento para cada dia da semana. O sistema liga e desliga tudo automaticamente.
        </p>
      </div>

      <!-- Schedule Grid -->
      <${Card} title="Horários de Funcionamento">
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${Object.keys(dayLabels).map(day => html`
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border);">
              <div style="min-width: 100px;">
                <input
                  type="checkbox"
                  checked=${!!schedule[day]}
                  onChange=${() => toggleDay(day)}
                  style="width: 16px; height: 16px; accent-color: var(--primary); margin-right: 0.5rem;"
                />
                <label style="font-size: 0.875rem;">${dayLabels[day]}</label>
              </div>

              ${schedule[day] ? html`
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input
                    type="time"
                    value=${schedule[day].open}
                    onChange=${(e) => updateTime(day, 'open', e.target.value)}
                    class="input input-mono"
                    style="width: 120px; padding: 0.5rem;"
                  />
                  <span style="color: var(--muted-foreground);">até</span>
                  <input
                    type="time"
                    value=${schedule[day].close}
                    onChange=${(e) => updateTime(day, 'close', e.target.value)}
                    class="input input-mono"
                    style="width: 120px; padding: 0.5rem;"
                  />
                </div>
              ` : html`
                <span style="color: var(--muted-foreground); font-size: 0.875rem;">Fechado</span>
              `}
            </div>
          `)}
        </div>
      </${Card}>

      <!-- Review Section -->
      <${Card} title="Revisão da Configuração">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Exposição</strong>
            <p style="margin-top: 0.25rem;">${allData.expo?.name || '—'}</p>
            <p style="font-size: 0.75rem; color: var(--muted-foreground);">${allData.expo?.venue || '—'}</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Projetores</strong>
            <p style="margin-top: 0.25rem;">${(allData.projectors || []).length} configurados</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Câmeras</strong>
            <p style="margin-top: 0.25rem;">${(allData.cameras || []).length} configuradas</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">TVs</strong>
            <p style="margin-top: 0.25rem;">${(allData.tvs || []).length} configuradas</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Áudio</strong>
            <p style="margin-top: 0.25rem;">Volume ${allData.audio?.volume || 70}%</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Tomadas</strong>
            <p style="margin-top: 0.25rem;">${(allData.smartplugs?.plugs || []).length} configuradas</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">CV</strong>
            <p style="margin-top: 0.25rem;">${allData.cv?.enabled ? 'Habilitada' : 'Desabilitada'}</p>
          </div>

          <div>
            <strong style="font-size: 0.875rem; color: var(--muted-foreground);">Portal</strong>
            <p style="margin-top: 0.25rem;">${allData.portal?.enabled ? 'Habilitado' : 'Desabilitado'}</p>
          </div>
        </div>
      </${Card}>

      <!-- Generate Button -->
      <div style="display: flex; justify-content: center; margin-top: 1rem;">
        <${Button}
          label=${generating ? 'Gerando...' : 'Gerar Configuração'}
          variant="primary"
          onClick=${onGenerate}
          disabled=${generating || !allData.expo?.slug}
          style="min-height: 56px; font-size: 1rem; padding: 0 2rem;"
        />
      </div>

      ${!allData.expo?.slug && html`
        <p style="text-align: center; color: var(--destructive); font-size: 0.875rem;">
          Preencha o nome e slug da exposição (Passo 1) antes de gerar
        </p>
      `}
    </div>
  `;
}
