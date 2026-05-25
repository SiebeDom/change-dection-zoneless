import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, DoCheck, inject, signal
} from '@angular/core';
import { Button } from 'primeng/button';

// ── BROKEN: mutates parent binding in AfterViewInit ───────────────────────────
@Component({
  selector: 'app-expr-broken',
  imports: [],
  // Default strategy so we can trigger AfterViewInit more easily
  template: `
    <div class="component-box">
      <span class="component-box-label">Broken (throws in dev mode)</span>
      <div class="result-row">
        <span class="result-label">headerText</span>
        <span class="result-value">{{ headerText }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
    </div>
  `
})
export class BrokenAfterViewInitComponent implements AfterViewInit, DoCheck {
  headerText = 'Loading…';
  checkCount = 0;
  triggered = false;

  ngDoCheck() { this.checkCount++; }

  ngAfterViewInit() {
    if (!this.triggered) {
      this.triggered = true;
      this.headerText = 'Done!';
      // NG0100: ExpressionChangedAfterItHasBeenChecked
      // Timeline:
      // 1. CD runs → evaluates headerText = 'Loading…' → renders child
      // 2. ngAfterViewInit fires → headerText = 'Done!'
      // 3. Dev-mode second pass: headerText === 'Done!' ≠ 'Loading…' → THROWS
    }
  }
}

// ── FIXED: defer to next tick with Promise ────────────────────────────────────
@Component({
  selector: 'app-expr-deferred',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box">
      <span class="component-box-label">Fixed — Promise.resolve()</span>
      <div class="result-row">
        <span class="result-label">headerText</span>
        <span class="result-value">{{ headerText }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
    </div>
  `
})
export class FixedDeferredComponent implements AfterViewInit, DoCheck {
  private cdr = inject(ChangeDetectorRef);
  headerText = 'Loading…';
  checkCount = 0;

  ngDoCheck() { this.checkCount++; }

  ngAfterViewInit() {
    Promise.resolve().then(() => {
      this.headerText = 'Done!';
      this.cdr.markForCheck();
      // Update happens after current CD cycle → no ExpressionChanged error
    });
  }
}

// ── BEST: use computed() signal — no lifecycle hooks needed ───────────────────
@Component({
  selector: 'app-expr-signal',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box">
      <span class="component-box-label">Best — signal / computed</span>
      <div class="result-row">
        <span class="result-label">headerText</span>
        <span class="result-value">{{ headerText() }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>
    </div>
  `
})
export class SignalHeaderComponent implements DoCheck {
  private isLoaded = signal(false);
  readonly headerText = () => this.isLoaded() ? 'Done!' : 'Loading…';
  checkCount = 0;

  constructor() {
    // Simulate async data arriving
    setTimeout(() => this.isLoaded.set(true), 1000);
  }

  ngDoCheck() { this.checkCount++; }
}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-expression-changed',
  imports: [Button, BrokenAfterViewInitComponent, FixedDeferredComponent, SignalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>ExpressionChangedAfterItHasBeenChecked</h2>
      <p class="subtitle">
        A dev-mode guard — Angular runs a second pass after every CD cycle and throws if any
        binding value changed as a side effect of rendering.
      </p>

      <div class="error-box">
        <strong>ERROR: NG0100</strong><br>
        ExpressionChangedAfterItHasBeenChecked: Expression has changed after it was checked.<br>
        Previous value: 'Loading…'. Current value: 'Done!'.<br>
        <a href="https://angular.dev/errors/NG0100" target="_blank" style="color:#ef4444">Docs →</a>
      </div>

      <div class="demo-card" style="margin:1rem 0">
        <div class="demo-card-header neutral"><i class="pi pi-clock"></i> Why it happens — the timeline</div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeTimeline }}</pre>
        </div>
      </div>

      @if (showBroken()) {
        <div class="warning-box">
          ⚠ The component below will throw <strong>NG0100</strong> in <strong>development mode</strong>.
          In production mode it runs silently (but leaves the view in an inconsistent state).
          Open the browser console to see the error.
        </div>
      }

      <div class="btn-row">
        <p-button [label]="showBroken() ? 'Hide broken example' : 'Show broken example (NG0100)'"
          [severity]="showBroken() ? 'secondary' : 'danger'"
          size="small" (onClick)="showBroken.update(v => !v)" />
      </div>

      @if (showBroken()) {
        <div class="three-col" style="margin-top:0.5rem">
          <app-expr-broken />
          <app-expr-deferred />
          <app-expr-signal />
        </div>
      }

      <div class="section-label" style="margin-top:1rem">Common triggers</div>
      <pre class="code-block">{{ codeCommonTriggers }}</pre>

      <div class="section-label">Why signals eliminated this error</div>
      <div class="demo-card">
        <div class="demo-card-body">
          <pre class="code-block">{{ codeSignalsWhy }}</pre>
          <div class="info-box" style="margin-top:0.5rem">
            Signals don't need the second-pass check. When a signal changes, Angular marks
            <em>exactly</em> which binding is stale and schedules a new CD cycle.
            There is no "compare after the fact" — Angular already knows what changed.
            Also, signals discourage lifecycle hooks for state sync, removing the main trigger.
          </div>
        </div>
      </div>
    </div>
  `
})
export class ExpressionChangedComponent {
  showBroken = signal(false);

  readonly codeTimeline = `@Component({ template: \`<child [label]="headerText"></child>\` })
class ParentComponent implements AfterViewInit {
  headerText = 'Loading…';

  ngAfterViewInit() {
    this.headerText = 'Done!'; // ← triggers NG0100
  }
}

// Timeline:
// 1. CD runs → renders parent with headerText = 'Loading…'
// 2. Child renders
// 3. ngAfterViewInit fires → headerText = 'Done!'   ← mutation AFTER render
// 4. Dev-mode second pass: headerText changed → THROWS NG0100`;

  readonly codeCommonTriggers = `// ① ngAfterViewInit / ngAfterViewChecked mutation
ngAfterViewInit() { this.label = 'Done'; }   // ✗

// ② BehaviorSubject that emits synchronously on subscription (in ngOnInit)
ngOnInit() {
  this.data$.subscribe(v => this.value = v); // BehaviorSubject emits sync → mutation during CD
}

// ③ async pipe on a synchronously-emitting observable
// <div>{{ syncObservable$ | async }}</div>  // emits during CD pass

// ④ Date.now() or Math.random() in a getter (new value on every check)
get timestamp() { return new Date(); }  // always different → always throws`;

  readonly codeSignalsWhy = `// With signals — no lifecycle hook needed, no NG0100 possible
@Component({})
class ParentComponent {
  private isLoaded = signal(false);
  headerText = computed(() => this.isLoaded() ? 'Done!' : 'Loading…');

  constructor() {
    // Simulated async — could be HTTP, timer, etc.
    someService.load().then(() => this.isLoaded.set(true));
  }
  // No ngAfterViewInit. No mutation. No error.
}`;
}
