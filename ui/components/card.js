// Card component — container with colored border based on status
import { html } from '../app.js';

/**
 * Card component
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string} [props.status] - Status: 'ok', 'warn', 'error' (changes top border color)
 * @param {any} props.children - Card content
 * @param {Object} [props.badge] - Optional badge: { label, variant }
 */
export default function Card({ title, status, badge, children }) {
  return html`
    <div class="card" data-status=${status || ''}>
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        ${badge && html`
          <span class=${'badge badge-' + (badge.variant || 'info')}>
            ${badge.label}
          </span>
        `}
      </div>
      <div class="card-body">
        ${children}
      </div>
    </div>
  `;
}
