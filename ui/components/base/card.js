// Card Component — Base component with status indicator
import { html } from '../../app.js';

export default function Card({ 
  title, 
  status = null, 
  subtitle = null, 
  children, 
  className = '' 
}) {
  const statusClass = status ? `data-status="${status}"` : '';
  
  return html`
    <div class="card ${className}" data-status=${status}>
      ${title && html`
        <div class="card-header">
          <div>
            <h3 class="card-title">${title}</h3>
            ${subtitle && html`<p class="card-subtitle">${subtitle}</p>`}
          </div>
        </div>
      `}
      <div class="card-body">
        ${children}
      </div>
    </div>
  `;
}
