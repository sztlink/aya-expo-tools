/**
 * AYA Expo Tools — Archive Page (Story 6)
 *
 * Archive exhibition data to external SSD with progress tracking.
 * Shows data size breakdown, available drives, and final report access.
 */

import { html, Component } from '../app.js';
import Card from '../components/card.js';

export default class Archive extends Component {
  constructor() {
    super();
    this.state = {
      dataSize: 0,
      breakdown: {},
      drives: [],
      loading: true,
      archiving: false,
      progress: null,
      archiveComplete: false,
      archivePath: null,
      selectedDrive: null,
      slug: null
    };
  }

  componentDidMount() {
    this.loadStatus();
    // Try to get slug from config
    fetch('/api/config')
      .then(r => r.json())
      .then(config => {
        const slug = config.exhibition?.name
          ?.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'exhibition';
        this.setState({ slug });
      })
      .catch(() => this.setState({ slug: 'exhibition' }));
  }

  async loadStatus() {
    try {
      const res = await fetch('/api/archive/status');
      const data = await res.json();
      this.setState({
        dataSize: data.dataSize,
        breakdown: data.breakdown,
        drives: data.drives,
        loading: false,
        selectedDrive: data.drives[0]?.letter || null
      });
    } catch (err) {
      console.error('Failed to load archive status:', err);
      this.setState({ loading: false });
    }
  }

  async startArchive() {
    const { selectedDrive, slug } = this.state;
    
    if (!selectedDrive || !slug) {
      alert('Please select a drive and enter a folder name');
      return;
    }

    this.setState({ archiving: true, progress: { step: 'init', percent: 0, message: 'Starting...' } });

    try {
      const res = await fetch('/api/archive/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive: selectedDrive, slug })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.step === 'complete') {
            this.setState({
              archiving: false,
              archiveComplete: true,
              archivePath: data.result.path,
              progress: { step: 'done', percent: 100, message: 'Archive complete!' }
            });
          } else if (data.step === 'error') {
            this.setState({
              archiving: false,
              progress: { step: 'error', percent: 0, message: `Error: ${data.error}` }
            });
            alert(`Archive failed: ${data.error}`);
          } else {
            this.setState({ progress: data });
          }
        }
      }

    } catch (err) {
      console.error('Archive failed:', err);
      this.setState({
        archiving: false,
        progress: { step: 'error', percent: 0, message: `Error: ${err.message}` }
      });
      alert(`Archive failed: ${err.message}`);
    }
  }

  render() {
    const { loading, dataSize, breakdown, drives, archiving, progress, archiveComplete, archivePath, selectedDrive, slug } = this.state;

    if (loading) {
      return html`
        <div>
          <h1>Archive</h1>
          <p style="color: var(--dimmed);">Loading archive status...</p>
        </div>
      `;
    }

    return html`
      <div>
        <h1>Archive Exhibition Data</h1>
        <p style="color: var(--dimmed); margin-bottom: 2rem;">
          Copy all exhibition data to external SSD for safekeeping.
        </p>

        <div class="grid grid-2">
          <!-- Data Size Card -->
          <${Card} title="Data to Archive" status="info">
            <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent); margin-bottom: 1rem;">
              ${dataSize.toFixed(2)} MB
            </div>
            <div style="color: var(--dimmed); font-size: 0.9rem;">
              <div style="margin-bottom: 0.5rem;">
                <strong>Timelapse:</strong> ${breakdown.timelapse?.toFixed(2) || 0} MB
              </div>
              <div style="margin-bottom: 0.5rem;">
                <strong>Logs:</strong> ${breakdown.logs?.toFixed(2) || 0} MB
              </div>
              <div style="margin-bottom: 0.5rem;">
                <strong>CV Data:</strong> ${breakdown.cv?.toFixed(2) || 0} MB
              </div>
              <div>
                <strong>Config:</strong> ${breakdown.config?.toFixed(2) || 0} MB
              </div>
            </div>
          <//>

          <!-- Available Drives Card -->
          <${Card} title="Available Drives" status=${drives.length > 0 ? 'ok' : 'error'}>
            ${drives.length === 0 ? html`
              <p style="color: var(--dimmed);">No external drives detected.</p>
              <p style="color: var(--dimmed); font-size: 0.85rem; margin-top: 1rem;">
                Connect an external SSD or USB drive and refresh the page.
              </p>
            ` : html`
              <div style="margin-bottom: 1rem;">
                ${drives.map(drive => html`
                  <div style="padding: 0.75rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${drive.letter}:</strong> ${drive.label}
                      </div>
                      <div style="color: var(--dimmed); font-size: 0.85rem;">
                        ${drive.freeGB.toFixed(2)} GB free
                      </div>
                    </div>
                  </div>
                `)}
              </div>
            `}
          <//>
        </div>

        <!-- Archive Controls -->
        ${drives.length > 0 ? html`
          <${Card} title="Archive Settings" style="margin-top: 2rem;">
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; color: var(--dimmed); font-size: 0.9rem;">
                Target Drive
              </label>
              <select
                value=${selectedDrive}
                onchange=${(e) => this.setState({ selectedDrive: e.target.value })}
                style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 1rem;"
                disabled=${archiving}
              >
                ${drives.map(drive => html`
                  <option value=${drive.letter}>${drive.letter}: ${drive.label} (${drive.freeGB.toFixed(2)} GB free)</option>
                `)}
              </select>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; color: var(--dimmed); font-size: 0.9rem;">
                Folder Name
              </label>
              <input
                type="text"
                value=${slug || ''}
                oninput=${(e) => this.setState({ slug: e.target.value })}
                placeholder="e.g., beleza-astral-2025"
                style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 1rem;"
                disabled=${archiving}
              />
              <div style="color: var(--dimmed); font-size: 0.8rem; margin-top: 0.5rem;">
                Data will be saved to: ${selectedDrive}:/${slug || 'exhibition'}/
              </div>
            </div>

            ${archiving ? html`
              <div style="margin-bottom: 1.5rem;">
                <div style="margin-bottom: 0.5rem; color: var(--dimmed); font-size: 0.9rem;">
                  ${progress?.message || 'Processing...'}
                </div>
                <div style="width: 100%; height: 8px; background: var(--card-bg); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; background: var(--accent); width: ${progress?.percent || 0}%; transition: width 0.3s;"></div>
                </div>
              </div>
            ` : ''}

            <button
              onclick=${() => this.startArchive()}
              disabled=${archiving || !selectedDrive || !slug}
              style="padding: 0.75rem 2rem; background: var(--accent); color: var(--bg); border: none; border-radius: 4px; font-size: 1rem; font-weight: 600; cursor: pointer; opacity: ${archiving || !selectedDrive || !slug ? '0.5' : '1'};"
            >
              ${archiving ? 'Archiving...' : 'Start Archive'}
            </button>

            ${archiveComplete ? html`
              <div style="margin-top: 1.5rem; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px;">
                <div style="color: var(--accent); font-weight: 600; margin-bottom: 0.5rem;">
                  ✓ Archive Complete
                </div>
                <div style="color: var(--dimmed); font-size: 0.9rem; margin-bottom: 1rem;">
                  Data saved to: <strong>${archivePath}</strong>
                </div>
                <a
                  href="/api/archive/report"
                  target="_blank"
                  style="display: inline-block; padding: 0.5rem 1.5rem; background: var(--card-bg); color: var(--accent); border: 1px solid var(--accent); border-radius: 4px; text-decoration: none; font-size: 0.9rem;"
                >
                  View Final Report →
                </a>
              </div>
            ` : ''}
          <//>
        ` : ''}
      </div>
    `;
  }
}
