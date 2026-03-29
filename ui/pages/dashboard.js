// Dashboard page — Main overview (Story 4-2)
import { html } from '../app.js';
import Card from '../components/card.js';
import StatusDot from '../components/status-dot.js';

export default function Dashboard() {
  return html`
    <div>
      <h1>Dashboard</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        System overview and exhibition health monitoring.
      </p>

      <div class="grid grid-2">
        <${Card} title="System Status" status="ok">
          <${StatusDot} status="ok" label="All systems operational" />
        <//>

        <${Card} title="Quick Stats" status="info">
          <p>Dashboard content will be implemented in Story 4-2.</p>
        <//>
      </div>
    </div>
  `;
}
