// Toast Component — Auto-dismissing notification popup
import { html, useEffect } from '../../app.js';

export default function Toast({ 
  message, 
  variant = 'info', 
  onClose = null, 
  duration = 5000 
}) {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);
  
  const variantClass = `toast-${variant}`;
  
  return html`
    <div class="toast ${variantClass}">
      ${message}
    </div>
  `;
}
