// Modal Component — Overlay dialog with backdrop close
import { html, useEffect } from '../../app.js';

export default function Modal({ 
  title, 
  open = false, 
  onClose = null, 
  children 
}) {
  useEffect(() => {
    if (open) {
      const handleEscape = (e) => {
        if (e.key === 'Escape' && onClose) {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);
  
  if (!open) return null;
  
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };
  
  return html`
    <div class="modal-overlay" onClick=${handleOverlayClick}>
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          ${onClose && html`
            <button class="modal-close" onClick=${onClose}>
              ×
            </button>
          `}
        </div>
        <div class="modal-body">
          ${children}
        </div>
      </div>
    </div>
  `;
}
