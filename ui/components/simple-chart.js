// SimpleChart component — SVG bar chart
import { html } from '../app.js';

/**
 * SimpleChart component — renders a simple bar chart
 * @param {Object} props
 * @param {Array<{label: string, value: number}>} props.data - Chart data
 * @param {number} [props.height] - Chart height in pixels (default: 200)
 * @param {string} [props.color] - Bar color (default: cyan)
 */
export default function SimpleChart({ data = [], height = 200, color = '#00d9ff' }) {
  if (!data.length) {
    return html`
      <div class="simple-chart">
        <div style="display: flex; align-items: center; justify-content: center; height: ${height}px; color: #565f89;">
          No data
        </div>
      </div>
    `;
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = 100 / data.length;
  const padding = 10;

  return html`
    <div class="simple-chart">
      <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none">
        ${data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * (height - padding * 2) : 0;
          const x = index * barWidth + barWidth * 0.1;
          const y = height - barHeight - padding;
          const width = barWidth * 0.8;

          return html`
            <rect
              x=${x}
              y=${y}
              width=${width}
              height=${barHeight}
              fill=${color}
              opacity="0.8"
              rx="2"
            >
              <title>${item.label}: ${item.value}</title>
            </rect>
          `;
        })}
      </svg>
      <div style="display: flex; justify-content: space-around; margin-top: 0.5rem; font-size: 11px; color: #565f89;">
        ${data.map(item => html`
          <div style="text-align: center; flex: 1;">
            <div>${item.label}</div>
            <div style="color: ${color}; font-weight: 600;">${item.value}</div>
          </div>
        `)}
      </div>
    </div>
  `;
}
