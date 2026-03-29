import { html, useState, useEffect, useRef, useCallback } from '../../app.js';
import { Button } from '../base/index.js';

const ZONE_COLORS = ['#00d9ff', '#ec4899', '#22c55e', '#f97316', '#a855f7'];

export default function ZoneCanvas({ snapshotUrl, snapshotData, zones = [], onZonesChange, width = 640, height = 480 }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [activePoints, setActivePoints] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [mousePos, setMousePos] = useState(null);

  const imgSrc = snapshotData ? `data:image/jpeg;base64,${snapshotData}` : snapshotUrl;

  // Load snapshot image
  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.src = imgSrc;
  }, [imgSrc]);

  // Redraw on state change
  useEffect(() => { draw(); }, [zones, activePoints, selectedZone, mousePos]);

  // Keyboard: ESC cancels drawing
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setActivePoints([]); setDrawing(false); setShowNameInput(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toNorm = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return { x: x / canvas.width, y: y / canvas.height };
  };

  const toCanvas = (nx, ny) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return { x: nx * canvas.width, y: ny * canvas.height };
  };

  const getCentroid = (points) => {
    const n = points.length;
    if (n === 0) return { x: 0, y: 0 };
    const sx = points.reduce((s, p) => s + p.x, 0) / n;
    const sy = points.reduce((s, p) => s + p.y, 0) / n;
    return { x: sx, y: sy };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Snapshot
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#737373';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Capture um snapshot primeiro', canvas.width / 2, canvas.height / 2);
    }

    // Completed zones
    zones.forEach((zone, i) => {
      const color = ZONE_COLORS[i % ZONE_COLORS.length];
      const pts = zone.points.map(p => toCanvas(p.x, p.y));
      if (pts.length < 3) return;

      // Fill
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = color + '1a'; // 10% opacity
      ctx.fill();

      // Border
      ctx.strokeStyle = selectedZone === i ? '#ffffff' : color;
      ctx.lineWidth = selectedZone === i ? 3 : 2;
      ctx.stroke();

      // Points
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      // Label
      const c = getCentroid(pts);
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(zone.name, c.x + 1, c.y + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(zone.name, c.x, c.y);
    });

    // Active polygon being drawn
    if (activePoints.length > 0) {
      const pts = activePoints.map(p => toCanvas(p.x, p.y));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));

      // Preview line to mouse
      if (mousePos) {
        ctx.lineTo(mousePos.x, mousePos.y);
      }

      ctx.strokeStyle = '#00d9ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Points
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00d9ff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }, [zones, activePoints, selectedZone, mousePos]);

  const handleClick = (e) => {
    if (showNameInput) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!drawing) {
      // Check if clicking on existing zone
      for (let i = zones.length - 1; i >= 0; i--) {
        const pts = zones[i].points.map(p => toCanvas(p.x, p.y));
        if (isPointInPolygon(x, y, pts)) {
          setSelectedZone(i);
          return;
        }
      }
      setSelectedZone(null);
      return;
    }

    const norm = toNorm(x, y);
    setActivePoints([...activePoints, norm]);
  };

  const handleDblClick = (e) => {
    if (!drawing || activePoints.length < 3) return;
    e.preventDefault();
    setDrawing(false);
    setShowNameInput(true);
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const finishZone = () => {
    if (!newZoneName.trim()) return;
    const zone = {
      id: `zone-${Date.now()}`,
      name: newZoneName.trim(),
      points: activePoints
    };
    onZonesChange([...zones, zone]);
    setActivePoints([]);
    setNewZoneName('');
    setShowNameInput(false);
  };

  const removeZone = () => {
    if (selectedZone === null) return;
    const updated = zones.filter((_, i) => i !== selectedZone);
    onZonesChange(updated);
    setSelectedZone(null);
  };

  const startDrawing = () => {
    setDrawing(true);
    setActivePoints([]);
    setSelectedZone(null);
  };

  return html`
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <canvas
        ref=${canvasRef}
        width=${width}
        height=${height}
        onClick=${handleClick}
        onDblClick=${handleDblClick}
        onMouseMove=${handleMouseMove}
        style="border: 1px solid var(--border); border-radius: var(--radius); cursor: ${drawing ? 'crosshair' : 'default'}; max-width: 100%;"
      />

      ${showNameInput && html`
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input
            type="text"
            class="input"
            placeholder="Nome da zona (ex: Entrada, Sala Imersiva)"
            value=${newZoneName}
            onInput=${(e) => setNewZoneName(e.target.value)}
            onKeyDown=${(e) => e.key === 'Enter' && finishZone()}
            style="flex: 1;"
            autofocus
          />
          <${Button} label="Confirmar" variant="primary" onClick=${finishZone} />
          <${Button} label="Cancelar" variant="ghost" onClick=${() => { setShowNameInput(false); setActivePoints([]); }} />
        </div>
      `}

      <div style="display: flex; gap: 0.5rem;">
        <${Button}
          label=${drawing ? 'Desenhando... (clique para pontos, duplo-clique para fechar)' : 'Nova Zona'}
          variant=${drawing ? 'secondary' : 'primary'}
          onClick=${() => drawing ? null : startDrawing()}
          disabled=${!imgRef.current}
        />
        ${selectedZone !== null && html`
          <${Button} label="Remover Zona Selecionada" variant="destructive" onClick=${removeZone} />
        `}
      </div>

      ${zones.length > 0 && html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${zones.map((z, i) => html`
            <span
              class="badge badge-${['info','accent','success','warning','primary'][i % 5]}"
              style="cursor: pointer; ${selectedZone === i ? 'outline: 2px solid var(--foreground);' : ''}"
              onClick=${() => setSelectedZone(selectedZone === i ? null : i)}
            >
              ${z.name} (${z.points.length} pontos)
            </span>
          `)}
        </div>
      `}

      <p style="color: var(--muted-foreground); font-size: 0.75rem;">
        ${drawing
          ? 'Clique no snapshot para adicionar pontos. Duplo-clique para fechar o poligono. ESC para cancelar.'
          : zones.length > 0
            ? `${zones.length} zona(s) definida(s). Clique em "Nova Zona" para adicionar mais, ou clique numa zona para selecionar.`
            : 'Clique em "Nova Zona" para comecar a desenhar poligonos de deteccao sobre o snapshot.'
        }
      </p>
    </div>
  `;
}

function isPointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}
