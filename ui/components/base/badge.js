// Badge Component — Pill-shaped status/label indicator
import { html } from '../../app.js';

export default function Badge({ 
  label, 
  variant = 'muted', 
  className = '' 
}) {
  const variantClass = `badge-${variant}`;
  
  return html`
    <span class="badge ${variantClass} ${className}">
      ${label}
    </span>
  `;
}
