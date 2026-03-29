// Archive Page — Data archiving for Ihon post-expo
import { html, useState, useEffect } from '../app.js';
import { authFetch } from '../app.js';
import { Card, Button, Badge, StatusDot } from '../components/base/index.js';

export default function Archive() {
  const [dataSummary, setDataSummary] = useState({
    totalSize: '0 GB',
    timelapse: '0 GB',
    logs: '0 MB',
    cv: '0 GB'
  });
  const [drives, setDrives] = useState([]);
  const [archiving, setArchiving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reportUrl, setReportUrl] = useState(null);

  useEffect(() => {
    loadArchiveData();
  }, []);

  const loadArchiveData = async () => {
    try {
      const res = await authFetch('/api/archive/status');
      if (res.ok) {
        const data = await res.json();
        setDataSummary(data.summary);
        setDrives(data.drives);
        setReportUrl(data.reportUrl);
      }
    } catch (err) {
      console.error('[Archive] Failed to load data:', err);
    }
  };

  const startArchive = async () => {
    const selectedDrive = drives.find(d => d.selected);
    if (!selectedDrive) {
      alert('Selecione um drive para arquivar');
      return;
    }

    if (!confirm(`Tem certeza que deseja arquivar todos os dados para ${selectedDrive.name}?`)) {
      return;
    }

    setArchiving(true);
    setProgress(0);

    try {
      const res = await authFetch('/api/archive/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive: selectedDrive.path })
      });

      if (res.ok) {
        // Poll for progress
        const interval = setInterval(async () => {
          const progressRes = await authFetch('/api/archive/progress');
          if (progressRes.ok) {
            const data = await progressRes.json();
            setProgress(data.progress);
            
            if (data.progress >= 100) {
              clearInterval(interval);
              setArchiving(false);
              alert('Arquivamento concluído com sucesso!');
              loadArchiveData();
            }
          }
        }, 1000);
      }
    } catch (err) {
      console.error('[Archive] Failed to start archive:', err);
      alert('Erro ao iniciar arquivamento');
      setArchiving(false);
    }
  };

  const selectDrive = (drivePath) => {
    setDrives(drives.map(d => ({
      ...d,
      selected: d.path === drivePath
    })));
  };

  return html`
    <div style="padding: 2rem; max-width: 1000px; margin: 0 auto;">
      <!-- Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 700;">Arquivamento de Dados</h1>
        <p style="color: var(--muted-foreground); margin: 0; font-size: 0.875rem;">
          Transferência de dados da exposição para armazenamento externo
        </p>
      </div>

      <!-- Data Summary -->
      <${Card} title="📊 Resumo dos Dados" status="info" style="margin-bottom: 1.5rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              Total
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.75rem; font-weight: 700; color: var(--foreground);">
              ${dataSummary.totalSize}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              Timelapse
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.75rem; font-weight: 700; color: var(--muted-foreground);">
              ${dataSummary.timelapse}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              Logs
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.75rem; font-weight: 700; color: var(--muted-foreground);">
              ${dataSummary.logs}
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
              CV Data
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.75rem; font-weight: 700; color: var(--muted-foreground);">
              ${dataSummary.cv}
            </div>
          </div>
        </div>
      <//>

      <!-- Drives -->
      <${Card} title="💾 Drives Externos" status=${drives.length === 0 ? 'warn' : 'ok'} style="margin-bottom: 1.5rem;">
        ${drives.length === 0 && html`
          <div style="text-align: center; padding: 2rem; color: var(--muted-foreground);">
            <div style="font-size: 2rem; margin-bottom: 1rem;">🔌</div>
            <p style="margin: 0; font-size: 0.875rem;">
              Nenhum drive externo detectado.<br/>
              Conecte o SSD externo antes de arquivar.
            </p>
          </div>
        `}
        ${drives.length > 0 && html`
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${drives.map(drive => html`
              <div 
                onClick=${() => selectDrive(drive.path)}
                style="
                  padding: 1rem;
                  border: 2px solid ${drive.selected ? 'var(--primary)' : 'var(--border)'};
                  border-radius: var(--radius);
                  background: ${drive.selected ? 'rgba(168, 85, 247, 0.1)' : 'var(--background)'};
                  cursor: pointer;
                  transition: all var(--transition-fast);
                "
              >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <${StatusDot} status=${drive.status} />
                    <span style="font-weight: 600; font-size: 1rem;">${drive.name}</span>
                  </div>
                  ${drive.selected && html`<${Badge} label="SELECIONADO" variant="primary" />`}
                </div>
                <div style="display: flex; gap: 1.5rem; font-size: 0.875rem; font-family: var(--font-mono); color: var(--muted-foreground);">
                  <span>Livre: ${drive.freeSpace}</span>
                  <span>Total: ${drive.totalSpace}</span>
                  <span>${drive.path}</span>
                </div>
              </div>
            `)}
          </div>
        `}
      <//>

      <!-- Archive Button -->
      <div style="margin-bottom: 1.5rem;">
        <${Button}
          label=${archiving ? 'Arquivando...' : '📦 Arquivar para SSD'}
          variant="primary"
          onClick=${startArchive}
          disabled=${archiving || drives.length === 0 || !drives.some(d => d.selected)}
          loading=${archiving}
          style="width: 100%; font-size: 1rem; padding: 1rem 2rem;"
        />
        
        ${archiving && html`
          <div style="margin-top: 1rem;">
            <div style="height: 8px; background: var(--muted); border-radius: 999px; overflow: hidden;">
              <div style="
                height: 100%;
                background: linear-gradient(90deg, var(--primary), var(--accent));
                width: ${progress}%;
                transition: width 300ms ease;
              "></div>
            </div>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; font-family: var(--font-mono); color: var(--muted-foreground);">
              ${progress}% concluído
            </div>
          </div>
        `}
      </div>

      <!-- Report -->
      ${reportUrl && html`
        <${Card} title="📄 Relatório Final" status="ok">
          <div style="text-align: center; padding: 1rem;">
            <p style="margin: 0 0 1rem 0; color: var(--muted-foreground); font-size: 0.875rem;">
              O relatório final da exposição está disponível para download
            </p>
            <${Button}
              label="📥 Baixar Relatório"
              variant="secondary"
              onClick=${() => window.open(reportUrl, '_blank')}
            />
          </div>
        <//>
      `}

      <!-- Help Text -->
      <div style="
        margin-top: 2rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--card);
        font-size: 0.875rem;
        color: var(--muted-foreground);
        line-height: 1.6;
      ">
        <strong style="color: var(--foreground);">ℹ️ Instruções:</strong><br/>
        1. Conecte o SSD externo à porta USB 3.0<br/>
        2. Aguarde o drive ser detectado automaticamente<br/>
        3. Selecione o drive desejado clicando nele<br/>
        4. Clique em "Arquivar para SSD" para iniciar a transferência<br/>
        5. Não desconecte o drive até o processo terminar
      </div>
    </div>
  `;
}
