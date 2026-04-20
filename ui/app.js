// AYA Expo Tools — Main App (Preact with htm)
import { html, render, useState, useEffect, useRef, useCallback, Component } from './lib/preact-standalone.module.js';

// Pages (lazy loaded)
let Dashboard, CV, SelfTest, Setup, Archive, Splash;

// WebSocket client with auto-reconnect
class WSClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.listeners = new Map();
    this.connected = false;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.connected = true;
        this.reconnectDelay = 1000;
        this.emit('connection', { connected: true });
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in', this.reconnectDelay, 'ms');
        this.connected = false;
        this.emit('connection', { connected: false });
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        this.ws?.close();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type || 'message', data);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[WS] Listener error:', err);
      }
    });
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Not connected, message not sent:', data);
    }
  }
}

// Initialize WebSocket client
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${location.host}/ws`;
export const ws = new WSClient(wsUrl);

// ─── Auth Token Helper (Story 4-5) ─────────────────────────
function getToken() {
  const meta = document.querySelector('meta[name="aya-token"]');
  return meta ? meta.getAttribute('content') : null;
}

// Authenticated fetch wrapper
export async function authFetch(url, options = {}) {
  const token = getToken();
  if (token) {
    options.headers = {
      ...options.headers,
      'X-AYA-Token': token
    };
  }
  return fetch(url, options);
}

// Router
function getRoute() {
  const hash = location.hash.slice(1) || '/dashboard';
  return hash.split('?')[0];
}

function navigateTo(path) {
  location.hash = path;
}

// Navigation component
function Nav({ currentRoute, wsConnected, onAboutClick }) {
  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { href: '/cv.html', label: 'CV' },
    { href: '/config.html', label: 'Configuração' },
    { href: '/server.html', label: 'Servidor' },
    { path: '/setup', label: 'Setup' },
  ];

  return html`
    <nav class="nav">
      <div class="nav-left" style="display: flex; align-items: center; gap: 1rem;">
        <!-- SZT Mark -->
        <a href="#/dashboard" style="display: flex; align-items: center; text-decoration: none;">
          <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nav-szt-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color: var(--primary); stop-opacity: 1" />
                <stop offset="100%" style="stop-color: var(--accent); stop-opacity: 1" />
              </linearGradient>
            </defs>
            <polygon 
              points="50,10 90,90 10,90" 
              fill="url(#nav-szt-gradient)"
              stroke="var(--primary)"
              stroke-width="2"
            />
          </svg>
        </a>
        <a href="#/dashboard" class="nav-logo" style="font-weight: 600; font-size: 1rem; color: var(--foreground); text-decoration: none;">
          AYA Expo Tools
        </a>
      </div>
      
      <div class="nav-items" style="display: flex; gap: 0.5rem; flex: 1;">
        ${links.map(link => html`
          <a 
            href="${link.href || '#' + link.path}"
            class="nav-item"
            data-active=${link.path ? currentRoute === link.path : false}
          >
            ${link.label}
          </a>
        `)}
      </div>
      
      <div class="nav-right" style="display: flex; align-items: center; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${wsConnected ? 'var(--secondary)' : 'var(--destructive)'};
            box-shadow: 0 0 8px ${wsConnected ? 'var(--secondary)' : 'var(--destructive)'};
          "></span>
          <span style="font-size: 0.75rem; color: var(--muted-foreground);">
            ${wsConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        <button 
          onClick=${onAboutClick}
          style="
            background: none;
            border: none;
            color: var(--muted-foreground);
            cursor: pointer;
            font-size: 0.875rem;
            padding: 0.5rem;
            transition: color var(--transition-fast);
          "
          onMouseOver=${(e) => e.target.style.color = 'var(--foreground)'}
          onMouseOut=${(e) => e.target.style.color = 'var(--muted-foreground)'}
        >
          Sobre
        </button>
      </div>
    </nav>
  `;
}

// Main App component
function App() {
  const [route, setRoute] = useState(getRoute());
  const [wsConnected, setWsConnected] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    // Show splash for 2 seconds on initial load
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    // Router: listen to hash changes
    const handleRouteChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleRouteChange);

    // WebSocket: listen to connection status
    const handleConnection = ({ connected }) => setWsConnected(connected);
    ws.on('connection', handleConnection);

    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      ws.off('connection', handleConnection);
    };
  }, []);

  // Lazy load page components
  useEffect(() => {
    const loadPages = async () => {
      try {
        if (!Dashboard) {
          const [dash, cv, selftest, setup, archive, splash] = await Promise.all([
            import('./pages/dashboard.js'),
            import('./pages/cv.js'),
            import('./pages/selftest.js'),
            import('./pages/setup.js'),
            import('./pages/archive.js'),
            import('./pages/splash.js')
          ]);
          Dashboard = dash.default;
          CV = cv.default;
          SelfTest = selftest.default;
          Setup = setup.default;
          Archive = archive.default;
          Splash = splash.default;
          // Force re-render after loading
          setRoute(getRoute());
        }
      } catch (err) {
        console.error('[App] Failed to load pages:', err);
        // Show error in UI instead of infinite loading
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.innerHTML = '<div style="color:#ff2d78;padding:2em"><h2>Erro ao carregar páginas</h2><pre>' + err.message + '</pre></div>';
        }
      }
    };
    loadPages();
  }, []);

  // Render splash screen during startup
  if (showSplash && Splash) {
    return html`<${Splash} />`;
  }

  // Redirect broken SPA routes to working standalone pages
  if (route === '/cv') { location.href = '/cv.html'; return null; }
  if (route === '/selftest') { location.href = '/config.html'; return null; }
  if (route === '/archive') { location.href = '/server.html'; return null; }

  // Render current page
  let PageComponent = null;
  if (route === '/dashboard') PageComponent = Dashboard;
  else if (route === '/setup') PageComponent = Setup;

  return html`
    <div>
      <${Nav} 
        currentRoute=${route} 
        wsConnected=${wsConnected}
        onAboutClick=${() => setShowAbout(true)}
      />
      <main>
        ${PageComponent 
          ? html`<${PageComponent} />` 
          : html`<div class="loading">Carregando...</div>`
        }
      </main>
      
      ${showAbout && html`
        <div class="modal-overlay" onClick=${() => setShowAbout(false)}>
          <div class="modal" onClick=${(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2 class="modal-title">Sobre</h2>
              <button class="modal-close" onClick=${() => setShowAbout(false)}>×</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <!-- SZT Mark -->
              <div style="text-align: center;">
                <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="about-szt-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color: var(--primary); stop-opacity: 1" />
                      <stop offset="100%" style="stop-color: var(--accent); stop-opacity: 1" />
                    </linearGradient>
                  </defs>
                  <polygon 
                    points="50,10 90,90 10,90" 
                    fill="url(#about-szt-gradient)"
                    stroke="var(--primary)"
                    stroke-width="2"
                  />
                </svg>
              </div>
              
              <div style="text-align: center;">
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 600;">AYA Expo Tools</h3>
                <p style="margin: 0; color: var(--muted-foreground); font-size: 0.875rem;">
                  Versão 2.1.0
                </p>
              </div>
              
              <div style="
                padding: 1rem;
                background: var(--background);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                font-size: 0.875rem;
                line-height: 1.6;
              ">
                <p style="margin: 0 0 1rem 0;">
                  Sistema de controle e monitoramento para exposições interativas do AYA Studio.
                </p>
                <p style="margin: 0; color: var(--muted-foreground);">
                  Desenvolvido com Design System ZeroFlux.<br/>
                  © 2026 Felipe Sztutman · szt.link
                </p>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

// Render app
render(html`<${App} />`, document.getElementById('app'));

// Export for use in components
export { html, useState, useEffect, useRef, useCallback, Component };
