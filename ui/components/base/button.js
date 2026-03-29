// Button Component — Primary action button with variants
import { html } from '../../app.js';

export default function Button({ 
  label = null,
  variant = 'primary', 
  onClick = null, 
  disabled = false, 
  loading = false,
  className = '',
  children = null
}) {
  const variantClass = `btn-${variant}`;
  
  const handleClick = (e) => {
    if (!disabled && !loading && onClick) {
      onClick(e);
    }
  };
  
  return html`
    <button 
      class="btn ${variantClass} ${className}"
      onClick=${handleClick}
      disabled=${disabled || loading}
    >
      ${loading ? '...' : (children || label)}
    </button>
  `;
}
