import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DoCheck, inject, signal
} from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { Button } from 'primeng/button';

// ── Simulated HTTP service ─────────────────────────────────────────────────────
function fakeHttpPost(body: object): Observable<{ ok: boolean }> {
  return of({ ok: true }).pipe(delay(1200));
}

// ── Broken: plain properties after await ──────────────────────────────────────
@Component({
  selector: 'app-broken-write',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="isChecking">
      <span class="component-box-label">OnPush — Broken</span>
      <div class="result-row">
        <span class="result-label">isSaving</span>
        <span class="result-value" [style.color]="isSaving ? '#f59e0b' : '#64748b'">{{ isSaving }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">result</span>
        <span class="result-value">{{ result || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge" [class.flash]="isChecking">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.75rem">
        <p-button label="Save" size="small" severity="secondary" (onClick)="save()" [disabled]="isSaving" />
      </div>
      <div class="error-box" style="margin-top:0.5rem">
        <code>isSaving = true</code> renders (sync). After <code>await</code>,
        assignments run in a new macrotask — no CD scheduled in zoneless. Result stays stale.
      </div>
    </div>
  `
})
export class BrokenWriteComponent implements DoCheck {
  isSaving = false;
  result   = '';
  checkCount = 0;
  isChecking = false;

  ngDoCheck() {
    this.checkCount++;
    this.isChecking = true;
    setTimeout(() => { this.isChecking = false; }, 300);
  }

  async save() {
    this.isSaving = true;           // sync → works (button click is a CD trigger)
    try {
      const res = await firstValueFrom(fakeHttpPost({ name: 'test' }));
      this.result   = res.ok ? 'Saved!' : 'Error';   // async → no CD scheduled
      this.isSaving = false;                          // async → no CD scheduled
    } catch {
      this.result   = 'Error';
      this.isSaving = false;
    }
  }
}

// ── Fixed: markForCheck in finally ────────────────────────────────────────────
@Component({
  selector: 'app-mfc-write',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="isChecking">
      <span class="component-box-label">OnPush — markForCheck</span>
      <div class="result-row">
        <span class="result-label">isSaving</span>
        <span class="result-value" [style.color]="isSaving ? '#f59e0b' : '#64748b'">{{ isSaving }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">result</span>
        <span class="result-value">{{ result || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge" [class.flash]="isChecking">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.75rem">
        <p-button label="Save" size="small" severity="secondary" (onClick)="save()" [disabled]="isSaving" />
      </div>
      <div class="warning-box" style="margin-top:0.5rem">
        <code>cdr.markForCheck()</code> in <code>finally</code> schedules CD after
        every await resolution. Works, but easy to forget one branch.
      </div>
    </div>
  `
})
export class MfcWriteComponent implements DoCheck {
  private cdr = inject(ChangeDetectorRef);
  isSaving = false;
  result   = '';
  checkCount = 0;
  isChecking = false;

  ngDoCheck() {
    this.checkCount++;
    this.isChecking = true;
    setTimeout(() => { this.isChecking = false; }, 300);
  }

  async save() {
    this.isSaving = true;
    try {
      const res = await firstValueFrom(fakeHttpPost({ name: 'test' }));
      this.result   = res.ok ? 'Saved!' : 'Error';
      this.isSaving = false;
    } catch {
      this.result   = 'Error';
      this.isSaving = false;
    } finally {
      this.cdr.markForCheck();      // schedules CD after every resolution path
    }
  }
}

// ── Fixed: signals ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-signal-write',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="isChecking()">
      <span class="component-box-label">OnPush — Signals</span>
      <div class="result-row">
        <span class="result-label">isSaving</span>
        <span class="result-value" [style.color]="isSaving() ? '#f59e0b' : '#64748b'">{{ isSaving() }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">result</span>
        <span class="result-value">{{ result() || '—' }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits</span>
        <span class="render-badge" [class.flash]="isChecking()">{{ checkCount }}</span>
      </div>
      <div style="margin-top:0.75rem">
        <p-button label="Save" size="small" severity="secondary" (onClick)="save()" [disabled]="isSaving()" />
      </div>
      <div class="success-box" style="margin-top:0.5rem">
        Every <code>.set()</code> schedules CD automatically, regardless of
        when it runs. No <code>markForCheck()</code> needed anywhere.
      </div>
    </div>
  `
})
export class SignalWriteComponent implements DoCheck {
  isSaving  = signal(false);
  result    = signal('');
  checkCount = 0;
  isChecking = signal(false);

  ngDoCheck() {
    this.checkCount++;
    this.isChecking.set(true);
    setTimeout(() => this.isChecking.set(false), 300);
  }

  async save() {
    this.isSaving.set(true);
    try {
      const res = await firstValueFrom(fakeHttpPost({ name: 'test' }));
      this.result.set(res.ok ? 'Saved!' : 'Error');
      this.isSaving.set(false);
    } catch {
      this.result.set('Error');
      this.isSaving.set(false);
    }
  }
}

// ── Main page ──────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-async-writes',
  imports: [BrokenWriteComponent, MfcWriteComponent, SignalWriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Async Writes — firstValueFrom + async/await</h2>
      <p class="subtitle">
        Using <code>firstValueFrom()</code> with <code>async/await</code> for HTTP write operations.
        The synchronous part before the first <code>await</code> works fine.
        Everything after <code>await</code> is a new macrotask — no CD is scheduled in zoneless.
      </p>

      <div class="info-box" style="margin-bottom:1rem">
        <strong>Why this matters:</strong> This is the most common pattern for HTTP write operations
        (<code>POST</code>, <code>PUT</code>, <code>DELETE</code>). You call <code>isSaving = true</code>
        synchronously (works), make the HTTP call, then set <code>isSaving = false</code> and
        <code>result = 'Saved!'</code> after the <code>await</code> — but in zoneless, those
        post-<code>await</code> assignments are invisible to the change detector.
        Click Save and watch in <strong>Zoneless</strong> mode to see the difference.
      </div>

      <!-- Code comparison -->
      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header neutral">
          <i class="pi pi-code"></i> The macrotask boundary
        </div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeMacrotask }}</pre>
          <div class="two-col" style="margin-top:0.5rem">
            <div class="warning-box">
              <strong>Zone.js mode:</strong> Zone.js patches <code>Promise</code> internals.
              When the <code>await</code> continuation fires, Zone.js knows a task is completing
              and calls <code>AppRef.tick()</code>. Both the spinner and the result update.
            </div>
            <div class="error-box">
              <strong>Zoneless mode:</strong> Nothing watches Promises.
              <code>isSaving = true</code> (sync, before the first <code>await</code>) renders
              because the button click schedules CD. But <code>isSaving = false</code>
              and <code>result = '...'</code> run in a resumed microtask/macrotask
              with no scheduler notification → they stay stale.
            </div>
          </div>
        </div>
      </div>

      <!-- Three-column live demo -->
      <div class="section-label">Live demo — click Save in each column</div>
      <div class="three-col" style="margin-bottom:1rem">
        <app-broken-write />
        <app-mfc-write />
        <app-signal-write />
      </div>

      <!-- Fix options comparison -->
      <div class="section-label">Fix options</div>
      <div class="two-col">
        <div class="demo-card">
          <div class="demo-card-header info">
            <i class="pi pi-flag"></i> Option 1 — markForCheck in finally
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeMarkForCheck }}</pre>
            <ul style="font-size:0.82rem;color:#334155;padding-left:1rem;line-height:1.7">
              <li>Works with existing plain properties</li>
              <li><code>finally</code> ensures it runs on both success and error</li>
              <li>Must remember it in every async method</li>
              <li>Slightly noisy — mixing imperative CD with business logic</li>
            </ul>
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-bolt"></i> Option 2 — signals (recommended)
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeSignals }}</pre>
            <ul style="font-size:0.82rem;color:#334155;padding-left:1rem;line-height:1.7">
              <li>Every <code>.set()</code> schedules CD automatically</li>
              <li>No <code>markForCheck()</code> anywhere</li>
              <li>Works the same in Zone.js and zoneless</li>
              <li>Best for new code — the recommended zoneless pattern</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Takeaway box -->
      <div class="demo-card" style="margin-top:1rem">
        <div class="demo-card-header neutral">
          <i class="pi pi-lightbulb"></i> Rule of thumb for zoneless async writes
        </div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeTakeaway }}</pre>
          <div class="info-box" style="margin-top:0.5rem">
            The sync portion before the first <code>await</code> is safe because Angular intercepts
            the event handler and schedules CD. Everything after crosses a macrotask boundary.
            Use signals for state that changes after an <code>await</code>, or use
            <code>markForCheck()</code> in <code>finally</code> as a migration step.
          </div>
        </div>
      </div>
    </div>
  `
})
export class AsyncWritesComponent {
  readonly codeMacrotask = `async save() {
  this.isSaving = true;              // ← sync, before first await
  //                                    button click is a CD trigger → renders ✓

  const res = await firstValueFrom(  // ← crosses macrotask boundary here
    this.http.post('/api/save', body)
  );

  this.isSaving = false;             // ← after await = new macrotask
  this.result   = res.ok ? 'Saved!' : 'Error';
  //                                    Zoneless: no CD scheduled → stays stale ✗
  //                                    Zone.js:  Promise continuation → tick() ✓
}`;

  readonly codeMarkForCheck = `async save() {
  this.isSaving = true;
  try {
    const res = await firstValueFrom(this.http.post('/api/save', body));
    this.result   = res.ok ? 'Saved!' : 'Error';
    this.isSaving = false;
  } catch (e) {
    this.result   = 'Error';
    this.isSaving = false;
  } finally {
    this.cdr.markForCheck();   // ← always runs, schedules CD
  }
}`;

  readonly codeSignals = `isSaving = signal(false);
result   = signal('');

async save() {
  this.isSaving.set(true);           // signal → CD scheduled ✓
  try {
    const res = await firstValueFrom(this.http.post('/api/save', body));
    this.result.set(res.ok ? 'Saved!' : 'Error');  // signal → CD scheduled ✓
    this.isSaving.set(false);                       // signal → CD scheduled ✓
  } catch {
    this.result.set('Error');
    this.isSaving.set(false);
  }
  // No markForCheck() needed anywhere
}`;

  readonly codeTakeaway = `// Sync = safe (event handler starts a CD cycle)
this.isSaving = true;   ✓

// After await = new macrotask = unsafe in zoneless
const res = await ...;
this.isSaving = false;  ✗ (plain property)
this.isSaving.set(false); ✓ (signal — always safe)`;
}
