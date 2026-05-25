import {
  ChangeDetectionStrategy, Component,
  DoCheck, OnDestroy, signal, ViewChild
} from '@angular/core';
import { Button } from 'primeng/button';
import { OnpushChildComponent } from './onpush-child.component';

// ── Signal-only cell — lives in its own LView so its signal never forces the
//    plain-counter parent to re-render in zoneless mode ─────────────────────────
@Component({
  selector: 'app-signal-cell',
  imports: [],
  template: `
    <div class="result-row">
      <span class="result-label">Signal counter (setInterval)</span>
      <span class="result-value">{{ counter() }}</span>
    </div>
    <div class="result-row">
      <span class="result-label">CD visits (signal cell)</span>
      <span class="render-badge">{{ checkCount }}</span>
    </div>
  `
})
export class SignalCellComponent implements DoCheck, OnDestroy {
  counter = signal(0);
  checkCount = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  start() { this.interval = setInterval(() => this.counter.update(c => c + 1), 1000); }
  stop()  { if (this.interval) { clearInterval(this.interval); this.interval = null; } }
  ngDoCheck()  { this.checkCount++; }
  ngOnDestroy(){ this.stop(); }
}

// ── Default-strategy component — plain counter only, no signals in template ───
@Component({
  selector: 'app-async-demo',
  imports: [Button, SignalCellComponent],
  // Default strategy — re-checked on every AppRef.tick()
  template: `
    <div class="component-box">
      <span class="component-box-label">Default strategy</span>

      <div class="result-row">
        <span class="result-label">Plain counter (setInterval)</span>
        <span class="result-value">{{ plainCounter }}</span>
      </div>
      <app-signal-cell #signalCell />
      <div class="result-row">
        <span class="result-label">CD visits (plain)</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>

      <div class="btn-row" style="margin-top:0.75rem">
        @if (!running) {
          <p-button label="Start timer (1s interval)" size="small" severity="secondary" (onClick)="start()" />
        } @else {
          <p-button label="Stop timer" size="small" severity="danger" (onClick)="stop()" />
        }
      </div>
    </div>
  `
})
export class AsyncDemoComponent implements DoCheck, OnDestroy {
  @ViewChild('signalCell') signalCell!: SignalCellComponent;

  plainCounter = 0;
  checkCount = 0;
  running = false;
  private interval: ReturnType<typeof setInterval> | null = null;

  ngDoCheck() { this.checkCount++; }

  start() {
    this.running = true;
    this.interval = setInterval(() => { this.plainCounter++; }, 1000);
    this.signalCell.start();
  }

  stop() {
    this.running = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.signalCell?.stop();
  }

  ngOnDestroy() { this.stop(); }
}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-cd-triggers',
  imports: [OnpushChildComponent, AsyncDemoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Change Detection Triggers</h2>
      <p class="subtitle">
        How state changes reach the DOM — and why the rules differ between Zone.js and Zoneless.
      </p>

      <!-- PART A: Zone.js vs Zoneless for async -->
      <div class="section-label">Part A — Zone.js vs Zoneless: async mutations</div>

      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header neutral">
          <i class="pi pi-clock"></i> setInterval — plain property vs signal
        </div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeAsync }}</pre>
          <div class="two-col" style="margin-top:0.5rem">
            <div>
              <div class="warning-box">
                <strong>Zone.js mode:</strong> <code>setInterval</code> is patched.
                When the callback fires, Zone.js calls <code>AppRef.tick()</code>.
                The Default-strategy component re-renders → <em>both</em> counters update.
              </div>
            </div>
            <div>
              <div class="error-box">
                <strong>Zoneless mode:</strong> nothing patches <code>setInterval</code>.
                The signal counter updates (signal notifies the scheduler).
                The plain counter is mutated but <strong>no CD is scheduled</strong>
                → it stays stale.
              </div>
            </div>
          </div>
          <app-async-demo />
        </div>
      </div>

      <!-- PART B: OnPush manual CD -->
      <div class="section-label">Part B — OnPush: explicit CD is always required</div>

      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header neutral">
          <i class="pi pi-shield"></i> OnPush — plain mutation, markForCheck, detectChanges, signal
        </div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeOnPush }}</pre>
          <div class="warning-box">
            <strong>Even in Zone.js mode</strong>, plain mutation into an OnPush component is invisible —
            Zone.js fires <code>AppRef.tick()</code> but the component is not dirty so it is skipped.
            OnPush always requires explicit notification regardless of zone mode.
          </div>
          <app-onpush-child />
        </div>
      </div>

      <!-- PART C: markForCheck vs detectChanges summary -->
      <div class="section-label">Part C — markForCheck vs detectChanges: the key difference</div>

      <div class="two-col">
        <div class="demo-card">
          <div class="demo-card-header info"><i class="pi pi-flag"></i> markForCheck()</div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeMFC }}</pre>
            <ul style="font-size:0.82rem;color:#334155;padding-left:1rem;line-height:1.7">
              <li>Sets dirty flag upward through ancestors</li>
              <li>Does NOT run CD</li>
              <li>CD runs at next scheduler tick (microtask)</li>
              <li>Async — DOM updated after current call stack</li>
              <li>Works in both Zone.js and zoneless</li>
            </ul>
            <a href="https://angular.dev/api/core/ChangeDetectorRef#markForCheck" target="_blank" style="font-size:0.8rem;color:#3b82f6">Docs →</a>
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-card-header fixed"><i class="pi pi-bolt"></i> detectChanges()</div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeDC }}</pre>
            <ul style="font-size:0.82rem;color:#334155;padding-left:1rem;line-height:1.7">
              <li>Runs CD synchronously on this subtree</li>
              <li>DOM updated before next line of code</li>
              <li>Does NOT call AppRef.tick()</li>
              <li>Bypasses OnPush dirty flag</li>
              <li>Use sparingly — prefer signals</li>
            </ul>
            <a href="https://angular.dev/api/core/ChangeDetectorRef#detectChanges" target="_blank" style="font-size:0.8rem;color:#3b82f6">Docs →</a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CdTriggersComponent {
  readonly codeAsync = `setInterval(() => {
  this.plainCounter++;              // plain mutation
  this.signalCounter.update(c => c + 1);  // signal

  // Zone.js mode:  setInterval is patched → AppRef.tick() fires after callback
  //                plainCounter AND signalCounter both update ✓
  //
  // Zoneless mode: nothing intercepts setInterval
  //                signal notifies scheduler → CD runs → signalCounter updates ✓
  //                plainCounter: no scheduler notification → stays stale ✗
}, 1000);`;

  readonly codeOnPush = `@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
class ChildComponent {
  counter = 0;

  plainMutate()      { this.counter++; }                  // broken in BOTH modes
  withMarkForCheck() { this.counter++; this.cdr.markForCheck(); } // works in both
  withDetectChanges(){ this.counter++; this.cdr.detectChanges(); } // works in both
  withSignal()       { this.counterSignal.update(c => c + 1); }   // works in both
}`;

  readonly codeMFC = `// markForCheck — async, schedules next tick
this.counter++;
this.cdr.markForCheck();
// DOM still shows old value here ↑
// ... microtask fires → CD runs → DOM updates`;

  readonly codeDC = `// detectChanges — synchronous, local
this.counter++;
this.cdr.detectChanges();
// DOM already shows new value here ↑
// No AppRef.tick() was called
// Only THIS subtree was checked`;
}
