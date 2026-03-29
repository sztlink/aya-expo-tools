// StatusDot Component — Status indicator with optional pulse animation
import { html } from '../../app.js';

export default function StatusDot({ 
  status = 'info', 
  label = null, 
  pulse = false 
}) {
  return html`
    <span class="status-dot" data-status=${status} data-pulse=${pulse}>
      ${label}
    </span>
  `;
}
