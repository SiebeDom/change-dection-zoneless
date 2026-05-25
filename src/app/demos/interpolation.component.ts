import { ChangeDetectionStrategy, Component, DoCheck, Input, signal } from '@angular/core';
import { Button } from 'primeng/button';

// ── Child that receives a typed @Input() so we can inspect the actual JS type ──
@Component({
  selector: 'app-typed-input',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-row">
      <span class="result-label">typeof value</span>
      <span class="result-value">{{ typeOf }}<span class="result-type">{{ typeOf === 'number' ? '✓ number' : '⚠ string' }}</span></span>
    </div>
    <div class="result-row">
      <span class="result-label">value === 42</span>
      <span class="result-value" [style.color]="value === 42 ? '#16a34a' : '#dc2626'">{{ value === 42 }}</span>
    </div>
    <div class="result-row">
      <span class="result-label">value + 1</span>
      <span class="result-value">{{ value + 1 }}</span>
    </div>
  `
})
export class TypedInputComponent {
  @Input() value: any;
  get typeOf() { return typeof this.value; }
}

// ── Demo that shows the disabled-button trap ───────────────────────────────────
@Component({
  selector: 'app-disabled-demo',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-row">
      <span class="result-label">interpolation <code>disabled="{{ '{{' }} false {{ '}}' }}"</code></span>
      <button disabled="{{ false }}" class="demo-btn broken">{{ false }} (still disabled!)</button>
    </div>
    <div class="result-row">
      <span class="result-label">property binding <code>[disabled]="false"</code></span>
      <button [disabled]="false" class="demo-btn fixed">false (enabled ✓)</button>
    </div>
  `,
  styles: [`.demo-btn { padding: 0.3rem 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.8rem; }
            .demo-btn.broken { background: #fef2f2; } .demo-btn.fixed { background: #f0fdf4; cursor: pointer; }`]
})
export class DisabledDemoComponent {}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-interpolation',
  imports: [TypedInputComponent, DisabledDemoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>String Interpolation vs Property Binding</h2>
      <p class="subtitle">
        <code>{{ '{{ }}' }}</code> always calls <code>.toString()</code> — the result is always a string.
        <code>[prop]="x"</code> passes the original JavaScript value directly.
      </p>

      <div class="two-col">
        <div class="demo-card">
          <div class="demo-card-header neutral"><i class="pi pi-code"></i> String interpolation</div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeInterp }}</pre>
            <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem">
              Passes the string <strong>"42"</strong> to the child, not the number 42.
            </p>
            <app-typed-input [value]="'42'" />
          </div>
        </div>

        <div class="demo-card">
          <div class="demo-card-header info"><i class="pi pi-link"></i> Property binding</div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeProp }}</pre>
            <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem">
              Passes the <strong>number</strong> 42. Type is preserved.
            </p>
            <app-typed-input [value]="42" />
          </div>
        </div>
      </div>

      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header broken"><i class="pi pi-exclamation-triangle"></i> The disabled-button trap</div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeDisabled }}</pre>
          <div class="warning-box">
            <code>disabled="{{ '{{' }} false {{ '}}' }}"</code> sets the HTML attribute to the string <code>"false"</code>
            — which is truthy. The button stays disabled. Property binding
            <code>[disabled]="false"</code> passes a boolean false and correctly enables the button.
          </div>
          <app-disabled-demo />
        </div>
      </div>

      <div class="demo-card">
        <div class="demo-card-header neutral"><i class="pi pi-book"></i> Compiler instructions</div>
        <div class="demo-card-body">
          <p style="font-size:0.83rem;color:#334155;margin-bottom:0.75rem">
            The Angular compiler turns your template into these instructions. Open
            <a href="https://jeanmeche.github.io/angular-compiler-output/" target="_blank" style="color:#3b82f6">angular-compiler-output</a>
            and paste a template to see them live.
          </p>
          <pre class="code-block">{{ codeCompiled }}</pre>
          <p style="font-size:0.8rem;color:#64748b;margin-top:0.5rem">
            <strong>ctx</strong> is the component class instance — what you call <code>this</code> inside the class.
            Angular passes it as the second argument of the template function.
            <strong>rf</strong> (RenderFlags) is a bitmask: <code>rf &amp; 1</code> = Create phase (first render only),
            <code>rf &amp; 2</code> = Update phase (every CD cycle).
          </p>
        </div>
      </div>
    </div>
  `
})
export class InterpolationComponent {
  readonly codeInterp = `<!-- Template -->
<app-child [value]="42">
<!-- Interpolation: NOT the same as property binding! -->
<app-child [value]="{{ 42 }}">  ← This is "42" (string)`;

  readonly codeProp = `<!-- Property binding preserves type -->
<app-child [value]="42">        ← This is 42 (number)
<app-child [value]="isActive">  ← boolean
<app-child [value]="user">      ← object reference`;

  readonly codeDisabled = `<!-- Interpolation — WRONG: "false" is a truthy string -->
<button disabled="{{ false }}">...</button>

<!-- Property binding — CORRECT: boolean false removes disabled -->
<button [disabled]="false">...</button>`;

  readonly codeCompiled = `// Compiled template function
function MyComponent_Template(rf, ctx) {
  if (rf & 1) {                    // RenderFlags.Create — runs once
    ɵɵtext(0);                     // create text node
    ɵɵelement(1, 'app-child');     // create child element
  }
  if (rf & 2) {                    // RenderFlags.Update — every CD cycle
    ɵɵtextInterpolate1('Hello ', ctx.name, '');  // string interpolation
    ɵɵproperty('value', ctx.count);              // property binding
  }
}`;
}
