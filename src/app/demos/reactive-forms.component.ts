import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DoCheck, ElementRef, inject, signal, ViewChild
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

// ── Broken: property updated in subscribe, no CD notification ─────────────────
@Component({
  selector: 'app-forms-broken',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box">
      <span class="component-box-label">Broken (zoneless)</span>
      <input #inp class="p-inputtext p-component" placeholder="Type here..." style="width:100%" />
      <div class="result-row" style="margin-top:0.5rem">
        <span class="result-label">Uppercase derived value:</span>
        <span class="result-value">{{ upperCased || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.5rem">
        <p-button label="Simulate HTTP (patchValue from setTimeout)" size="small" severity="secondary"
          (onClick)="simulateHttp()" />
      </div>
      <div class="error-box" style="margin-top:0.75rem">
        <strong>Zoneless:</strong> subscribe mutates <code>upperCased</code> — plain property.
        No signal, no markForCheck → no CD scheduled → display stays stale.
      </div>
    </div>
  `
})
export class FormsBrokenComponent implements DoCheck, AfterViewInit {
  @ViewChild('inp') inputRef!: ElementRef<HTMLInputElement>;
  private ctrl = new FormControl('');
  upperCased = '';
  checkCount = 0;

  constructor() {
    this.ctrl.valueChanges.subscribe(v => {
      this.upperCased = (v ?? '').toUpperCase();
      // plain property assignment — no CD notification
    });
  }

  ngAfterViewInit() {
    // Native addEventListener — not patched by Zone.js → no CD scheduled on input
    this.inputRef.nativeElement.addEventListener('input', (e: Event) => {
      this.ctrl.setValue((e.target as HTMLInputElement).value);
    });
  }

  ngDoCheck() { this.checkCount++; }

  simulateHttp() {
    setTimeout(() => {
      this.inputRef.nativeElement.value = 'from http response';
      this.ctrl.setValue('from http response');
      // setTimeout fires outside Angular scheduler → no CD scheduled
    }, 800);
  }
}

// ── Fixed with markForCheck ────────────────────────────────────────────────────
@Component({
  selector: 'app-forms-markforcheck',
  imports: [ReactiveFormsModule, Button, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box">
      <span class="component-box-label">Fixed — markForCheck</span>
      <input pInputText [formControl]="ctrl" placeholder="Type here..." style="width:100%" />
      <div class="result-row" style="margin-top:0.5rem">
        <span class="result-label">Uppercase derived value:</span>
        <span class="result-value">{{ upperCased || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.5rem">
        <p-button label="Simulate HTTP (patchValue from setTimeout)" size="small" severity="secondary"
          (onClick)="simulateHttp()" />
      </div>
      <div class="success-box" style="margin-top:0.75rem">
        <code>markForCheck()</code> after each mutation — schedules a microtask, works in both modes.
        Downside: manual wiring on every subscription.
      </div>
    </div>
  `
})
export class FormsMarkForCheckComponent implements DoCheck {
  private cdr = inject(ChangeDetectorRef);
  ctrl = new FormControl('');
  upperCased = '';
  checkCount = 0;

  constructor() {
    this.ctrl.valueChanges.subscribe(v => {
      this.upperCased = (v ?? '').toUpperCase();
      this.cdr.markForCheck();
    });
  }

  ngDoCheck() { this.checkCount++; }

  simulateHttp() {
    setTimeout(() => {
      this.ctrl.patchValue('from http response');
      this.upperCased = 'FROM HTTP RESPONSE';
      this.cdr.markForCheck();
    }, 800);
  }
}

// ── Fixed with toSignal (idiomatic zoneless) ───────────────────────────────────
@Component({
  selector: 'app-forms-tosignal',
  imports: [ReactiveFormsModule, Button, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box">
      <span class="component-box-label">Fixed — toSignal (recommended)</span>
      <input pInputText [formControl]="ctrl" placeholder="Type here..." style="width:100%" />
      <div class="result-row" style="margin-top:0.5rem">
        <span class="result-label">Uppercase derived value:</span>
        <span class="result-value">{{ upperCased() || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.5rem">
        <p-button label="Simulate HTTP (patchValue from setTimeout)" size="small" severity="secondary"
          (onClick)="simulateHttp()" />
      </div>
      <div class="success-box" style="margin-top:0.75rem">
        <code>toSignal()</code> converts the Observable to a signal.
        Signal updates auto-notify the scheduler. No subscribe, no markForCheck.
      </div>
    </div>
  `
})
export class FormsToSignalComponent implements DoCheck {
  ctrl = new FormControl('');
  checkCount = 0;

  readonly value = toSignal(this.ctrl.valueChanges, { initialValue: '' });
  readonly upperCased = () => (this.value() ?? '').toUpperCase();

  ngDoCheck() { this.checkCount++; }

  simulateHttp() {
    setTimeout(() => {
      this.ctrl.patchValue('from http response');
      // patchValue → valueChanges emits → toSignal signal updates → scheduler notified ✓
    }, 800);
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-reactive-forms',
  imports: [FormsBrokenComponent, FormsMarkForCheckComponent, FormsToSignalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Reactive Forms in Zoneless</h2>
      <p class="subtitle">
        <code>ReactiveFormsModule</code>'s <code>valueChanges</code> is a plain RxJS Subject.
        In Zone.js mode it works automatically. In zoneless you need to bridge it to the scheduler.
      </p>

      <div class="info-box">
        <strong>Why it breaks:</strong> <code>valueChanges.subscribe(v =&gt; this.x = v)</code> mutates a plain
        property. In zoneless, nothing schedules a CD cycle after that assignment.
        The Observable emitted correctly — Angular just never checked the template again.
      </div>

      <pre class="code-block" style="margin-bottom:1rem">{{ codeProblem }}</pre>

      <div class="three-col">
        <app-forms-broken />
        <app-forms-markforcheck />
        <app-forms-tosignal />
      </div>

      <div class="section-label" style="margin-top:1rem">Fix comparison</div>
      <pre class="code-block">{{ codeFixes }}</pre>
    </div>
  `
})
export class ReactiveFormsComponent {
  readonly codeProblem = `// BROKEN in zoneless — works in Zone.js (zone patches the input event)
this.ctrl.valueChanges.subscribe(v => {
  this.upperCased = v.toUpperCase(); // plain property — no CD scheduled
});

// Also broken when called from async context (setTimeout / HTTP):
setTimeout(() => {
  this.form.patchValue(serverData);
  this.displayName = serverData.name; // no markForCheck → stale view
}, 800);`;

  readonly codeFixes = `// Fix 1: explicit markForCheck (works in both Zone.js and zoneless)
this.ctrl.valueChanges.subscribe(v => {
  this.upperCased = v.toUpperCase();
  this.cdr.markForCheck(); // schedules microtask → next CD cycle re-renders
});

// Fix 2: toSignal — idiomatic zoneless (preferred)
readonly value     = toSignal(this.ctrl.valueChanges, { initialValue: '' });
readonly upperCased = computed(() => this.value().toUpperCase());
// No subscribe. No markForCheck. Signal notifies scheduler automatically.

// Fix 3: async pipe (has markForCheck built in — works in both modes)
// template: {{ ctrl.valueChanges | async }}`;
}
