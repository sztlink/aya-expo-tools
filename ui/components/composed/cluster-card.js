// ClusterCard Component — Cluster status card for dashboard grid
import { html } from '../../app.js';
import { Card, StatusDot } from '../base/index.js';

export default function ClusterCard({ 
  name, 
  status = 'info', 
  metrics = [], 
  icon = null,
  onClick = null
}) {
  const handleClick = () => {
    if (onClick) onClick();
  };

  return html`
    <div 
      class="cluster-card" 
      onClick=${handleClick}
      style="cursor: ${onClick ? 'pointer' : 'default'}"
    >
      <${Card} status=${status}>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${icon && html`<span style="font-size: 1.5rem;">${icon}</span>`}
              <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0;">${name}</h3>
            </div>
            <${StatusDot} status=${status} pulse=${true} />
          </div>
          
          ${metrics.length > 0 && html`
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${metrics.map(metric => html`
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;">
                  <span style="color: var(--muted-foreground);">${metric.label}</span>
                  <span style="font-family: var(--font-mono); font-weight: 600; color: var(--foreground);">${metric.value}</span>
                </div>
              `)}
            </div>
          `}
        </div>
      <//>
    </div>
  `;
}
