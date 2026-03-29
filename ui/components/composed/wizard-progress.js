// Wizard Progress Component — Horizontal step indicator
import { html } from '../../app.js';

export default function WizardProgress({ 
  steps = [], 
  currentStep = 1, 
  completed = [], 
  skipped = [],
  onStepClick = null
}) {
  const getStepState = (stepNum) => {
    if (stepNum === currentStep) return 'active';
    if (completed.includes(stepNum)) return 'completed';
    if (skipped.includes(stepNum)) return 'skipped';
    return 'default';
  };

  return html`
    <div class="wizard-progress">
      ${steps.map(step => {
        const state = getStepState(step.num);
        const canClick = onStepClick && (state !== 'default' || step.num === currentStep);
        
        return html`
          <div 
            class="wizard-step"
            data-state=${state}
            onClick=${canClick ? () => onStepClick(step.num) : null}
            style="cursor: ${canClick ? 'pointer' : 'default'}"
          >
            <div class="wizard-step-number">
              ${state === 'completed' ? '✓' : step.num}
            </div>
            <div class="wizard-step-title">${step.title}</div>
          </div>
        `;
      })}
    </div>
  `;
}
