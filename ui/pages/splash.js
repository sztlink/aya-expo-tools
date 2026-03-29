// Splash Page — Startup screen shown during Node.js initialization
import { html } from '../app.js';

export default function Splash() {
  return html`
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--background);
    ">
      <!-- SZT.link Mark (triangle with gradient) -->
      <div style="margin-bottom: 2rem; animation: pulse 2s ease-in-out infinite;">
        <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="szt-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color: var(--primary); stop-opacity: 1" />
              <stop offset="100%" style="stop-color: var(--accent); stop-opacity: 1" />
            </linearGradient>
          </defs>
          <polygon 
            points="50,10 90,90 10,90" 
            fill="url(#szt-gradient)"
            stroke="var(--primary)"
            stroke-width="2"
          />
        </svg>
      </div>

      <!-- App Name -->
      <h1 style="
        font-family: var(--font-sans);
        font-size: 1.5rem;
        font-weight: 300;
        color: var(--foreground);
        margin: 0 0 1rem 0;
        letter-spacing: 0.1em;
      ">
        AYA EXPO TOOLS
      </h1>

      <!-- Loading Bar -->
      <div style="width: 200px; height: 4px; background: var(--muted); border-radius: 999px; overflow: hidden;">
        <div style="
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--accent));
          animation: loading 1.5s ease-in-out infinite;
        "></div>
      </div>

      <style>
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      </style>
    </div>
  `;
}
