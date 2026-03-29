// InputField Component — Labeled input with help text and error states
import { html } from '../../app.js';

export default function InputField({ 
  label, 
  value = '', 
  onChange = null, 
  placeholder = '', 
  helpText = null, 
  type = 'text', 
  mono = false, 
  required = false, 
  error = null,
  className = ''
}) {
  const inputClass = `input ${mono ? 'input-mono' : ''} ${error ? 'input-error' : ''} ${className}`;
  
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value, e);
    }
  };
  
  return html`
    <div class="input-field">
      ${label && html`
        <label class="input-label">
          ${label}
          ${required && html`<span style="color: var(--destructive);"> *</span>`}
        </label>
      `}
      <input 
        type=${type}
        class=${inputClass}
        value=${value}
        onInput=${handleChange}
        placeholder=${placeholder}
        required=${required}
      />
      ${helpText && !error && html`
        <small style="display: block; margin-top: 0.25rem; color: var(--muted-foreground); font-size: 0.75rem;">
          ${helpText}
        </small>
      `}
      ${error && html`
        <small style="display: block; margin-top: 0.25rem; color: var(--destructive); font-size: 0.75rem;">
          ${error}
        </small>
      `}
    </div>
  `;
}
