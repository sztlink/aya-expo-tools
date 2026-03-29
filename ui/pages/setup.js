// Setup page — System configuration (Story 4-5)
import { html } from '../app.js';
import Card from '../components/card.js';

export default function Setup() {
  return html`
    <div>
      <h1>Setup</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        Configure cameras, markers, zones, and system parameters.
      </p>

      <div class="grid grid-2">
        <${Card} title="Configuration" status="info">
          <p>Setup content will be implemented in Story 4-5.</p>
        <//>

        <${Card} title="Calibration" status="info">
          <p>Camera calibration, marker configuration, and zone setup.</p>
        <//>
      </div>
    </div>
  `;
}
