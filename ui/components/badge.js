// Badge component — colored pill label
import { html } from '../app.js';

/**
 * Badge component
 * @param {Object} props
 * @param {string} props.label - Badge text
 * @param {string} [props.variant] - Style variant: 'ok', 'warn', 'error', 'info' (default: 'info')
 */
export default function Badge({ label, variant = 'info' }) {
  return html`
    <span class=${'badge badge-' + variant}>
      ${label}
    </span>
  `;
}
