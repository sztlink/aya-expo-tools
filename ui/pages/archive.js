// Archive page — Historical data and logs (Story 4-6)
import { html } from '../app.js';
import Card from '../components/card.js';

export default function Archive() {
  return html`
    <div>
      <h1>Archive</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        View historical events, logs, and system reports.
      </p>

      <div class="grid grid-2">
        <${Card} title="Event History" status="info">
          <p>Archive content will be implemented in Story 4-6.</p>
        <//>

        <${Card} title="Reports" status="info">
          <p>Browse past self-test reports and system logs.</p>
        <//>
      </div>
    </div>
  `;
}
