// AYA Expo Tools — Main App (Preact with htm)
import { html, render, useState, useEffect } from './lib/preact-standalone.module.js';

// Pages (lazy loaded)
let Dashboard, CV, SelfTest, Setup, Archive;

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

// Router
function getRoute() {
  const hash = location.hash.slice(1) || '/dashboard';
  return hash.split('?')[0];
}

function navigateTo(path) {
  location.hash = path;
}

// Navigation component
function Nav({ currentRoute, wsConnected }) {
  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/cv', label: 'CV Tools' },
    { path: '/selftest', label: 'Self-Test' },
    { path: '/setup', label: 'Setup' },
    { path: '/archive', label: 'Archive' }
  ];

  return html`
    <nav>
      <a href="#/dashboard" class="logo">AYA Expo Tools</a>
      <div class="nav-links">
        ${links.map(link => html`
          <a 
            href="${'#' + link.path}"
            class=${currentRoute === link.path ? 'active' : ''}
          >
            ${link.label}
          </a>
        `)}
      </div>
      <div class="ws-indicator" data-connected=${wsConnected}>
        ${wsConnected ? 'Connected' : 'Disconnected'}
      </div>
    </nav>
  `;
}

// Main App component
function App() {
  const [route, setRoute] = useState(getRoute());
  const [wsConnected, setWsConnected] = useState(false);

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
          const [dash, cv, selftest, setup, archive] = await Promise.all([
            import('./pages/dashboard.js'),
            import('./pages/cv.js'),
            import('./pages/selftest.js'),
            import('./pages/setup.js'),
            import('./pages/archive.js')
          ]);
          Dashboard = dash.default;
          CV = cv.default;
          SelfTest = selftest.default;
          Setup = setup.default;
          Archive = archive.default;
          // Force re-render after loading
          setRoute(getRoute());
        }
      } catch (err) {
        console.error('[App] Failed to load pages:', err);
      }
    };
    loadPages();
  }, []);

  // Render current page
  let PageComponent = null;
  if (route === '/dashboard') PageComponent = Dashboard;
  else if (route === '/cv') PageComponent = CV;
  else if (route === '/selftest') PageComponent = SelfTest;
  else if (route === '/setup') PageComponent = Setup;
  else if (route === '/archive') PageComponent = Archive;

  return html`
    <${Nav} currentRoute=${route} wsConnected=${wsConnected} />
    <main>
      ${PageComponent 
        ? html`<${PageComponent} />` 
        : html`<div class="loading">Loading</div>`
      }
    </main>
  `;
}

// Render app
render(html`<${App} />`, document.getElementById('app'));

// Export for use in components
export { html, useState, useEffect };
