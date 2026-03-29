// Equipment Card Component — Card for configuring and testing a single piece of equipment
import { html } from '../../app.js';
import Card from '../base/card.js';
import Badge from '../base/badge.js';
import Button from '../base/button.js';
import StatusDot from '../base/status-dot.js';
import TestButton from './test-button.js';

export default function EquipmentCard({ 
  name = '', 
  ip = '',
  status = 'untested', // 'untested' | 'ok' | 'error'
  onRemove = null,
  onTest = null,
  testLabel = 'Testar Conexão',
  successMessage = 'Conectado',
  failMessage = 'Falha na conexão',
  children = null
}) {
  const getStatusVariant = (status) => {
    if (status === 'ok') return 'success';
    if (status === 'error') return 'destructive';
    return 'muted';
  };

  return html`
    <${Card} className="equipment-card">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Header: name, IP, status -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
            <strong style="font-size: 1rem;">${name || 'Equipamento'}</strong>
            ${ip && html`
              <${Badge} variant="muted" className="mono">
                ${ip}
              </${Badge}>
            `}
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${status !== 'untested' && html`
              <${StatusDot} 
                status=${status === 'ok' ? 'ok' : 'error'}
                pulse=${false}
              />
            `}
            
            ${onRemove && html`
              <${Button}
                label="Remover"
                variant="ghost"
                onClick=${onRemove}
                className="btn-sm"
                style="min-height: 32px; padding: 0.25rem 0.75rem;"
              />
            `}
          </div>
        </div>

        <!-- Custom fields (passed as children) -->
        ${children && html`
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${children}
          </div>
        `}

        <!-- Test button -->
        ${onTest && html`
          <${TestButton}
            label=${testLabel}
            onTest=${onTest}
            successMessage=${successMessage}
            failMessage=${failMessage}
          />
        `}
      </div>
    </${Card}>
  `;
}
