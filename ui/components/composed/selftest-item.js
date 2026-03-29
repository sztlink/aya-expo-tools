// SelftestItem Component — Check item row for selftest page
import { html } from '../../app.js';
import { StatusDot } from '../base/index.js';

export default function SelftestItem({ 
  name, 
  status = 'info', 
  detail = null
}) {
  return html`
    <div class="selftest-item" style="
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);
    ">
      <${StatusDot} status=${status} pulse=${status === 'error'} />
      <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500; font-size: 0.875rem;">${name}</span>
        ${detail && html`
          <span style="font-size: 0.75rem; color: var(--muted-foreground); font-family: var(--font-mono);">
            ${detail}
          </span>
        `}
      </div>
    </div>
  `;
}
