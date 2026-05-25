import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DoCheck, inject, Input, signal
} from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-onpush-child',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="flashing()">
      <span class="component-box-label">OnPush child</span>

      <div class="result-row">
        <span class="result-label">Counter (plain property)</span>
        <span class="result-value">{{ counter }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Counter (signal)</span>
        <span class="result-value">{{ counterSignal() }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits (ngDoCheck)</span>
        <span class="render-badge" [class.flash]="flashing()">{{ checkCount }}</span>
      </div>

      <div class="btn-row" style="margin-top:0.75rem">
        <p-button label="Plain mutation" size="small" severity="secondary" (onClick)="plainMutate()" />
        <p-button label="+ markForCheck" size="small" severity="warn"      (onClick)="withMarkForCheck()" />
        <p-button label="+ detectChanges" size="small" severity="success"  (onClick)="withDetectChanges()" />
        <p-button label="Signal set()" size="small" severity="info"         (onClick)="withSignal()" />
      </div>

      <div class="info-box" style="margin-top:0.75rem;font-size:0.8rem">
        <strong>Plain mutation:</strong> broken in both Zone.js and zoneless —
        OnPush won't re-check unless it's dirty.<br>
        <strong>markForCheck:</strong> marks dirty → schedules microtask → next CD cycle re-renders.<br>
        <strong>detectChanges:</strong> synchronously runs CD on this subtree right now.<br>
        <strong>signal set():</strong> notifies the scheduler automatically — preferred.
      </div>
    </div>
  `
})
export class OnpushChildComponent implements DoCheck {
  private cdr = inject(ChangeDetectorRef);

  counter = 0;
  counterSignal = signal(0);
  checkCount = 0;
  flashing = signal(false);

  ngDoCheck() {
    this.checkCount++;
    this.flashing.set(true);
    setTimeout(() => this.flashing.set(false), 400);
  }

  plainMutate() {
    this.counter++;
    // No CD notification → OnPush component is not dirty → view stays stale
  }

  withMarkForCheck() {
    this.counter++;
    this.cdr.markForCheck();
    // Schedules a microtask via ChangeDetectionScheduler
    // Works in both Zone.js and zoneless
  }

  withDetectChanges() {
    this.counter++;
    this.cdr.detectChanges();
    // Synchronous local CD — runs immediately on this subtree
    // Does NOT call AppRef.tick() — no global cycle
  }

  withSignal() {
    this.counterSignal.update(c => c + 1);
    // Signal update notifies the scheduler automatically
    // Most idiomatic zoneless pattern
  }
}
