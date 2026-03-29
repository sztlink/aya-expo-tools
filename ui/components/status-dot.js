// StatusDot component — animated dot with label
import { html } from '../app.js';

/**
 * StatusDot component
 * @param {Object} props
 * @param {string} props.status - Status: 'ok', 'warn', 'error'
 * @param {string} props.label - Label text
 */
export default function StatusDot({ status, label }) {
  return html`
    <span class="status-dot" data-status=${status}>
      ${label}
    </span>
  `;
}
