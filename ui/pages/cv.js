// CV Tools page — Computer Vision tools (Story 4-3)
import { html } from '../app.js';
import Card from '../components/card.js';

export default function CV() {
  return html`
    <div>
      <h1>CV Tools</h1>
      <p style="color: var(--dimmed); margin-bottom: 2rem;">
        Camera feeds, marker detection, calibration, and debugging.
      </p>

      <div class="grid grid-2">
        <${Card} title="Camera Feeds" status="info">
          <p>CV tools content will be implemented in Story 4-3.</p>
        <//>

        <${Card} title="Marker Detection" status="info">
          <p>Marker detection and tracking visualization.</p>
        <//>
      </div>
    </div>
  `;
}
