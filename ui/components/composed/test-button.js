// Test Button Component — Button with inline test result display
import { html, useState } from '../../app.js';
import Button from '../base/button.js';
import StatusDot from '../base/status-dot.js';

export default function TestButton({ 
  label = 'Testar', 
  onTest = null, 
  successMessage = 'Teste bem-sucedido',
  failMessage = 'Teste falhou'
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // { ok: boolean, message: string }

  const handleTest = async () => {
    if (!onTest) return;
    
    setTesting(true);
    setResult(null);
    
    try {
      const response = await onTest();
      setResult({
        ok: response.ok !== false,
        message: response.message || (response.ok ? successMessage : failMessage)
      });
    } catch (err) {
      setResult({
        ok: false,
        message: `Erro: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <${Button}
        label=${label}
        variant="secondary"
        onClick=${handleTest}
        loading=${testing}
      />
      
      ${result && html`
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <${StatusDot} 
            status=${result.ok ? 'ok' : 'error'} 
            pulse=${false}
          />
          <small style="color: ${result.ok ? 'var(--secondary)' : 'var(--destructive)'}; font-size: 0.75rem;">
            ${result.message}
          </small>
        </div>
      `}
    </div>
  `;
}
