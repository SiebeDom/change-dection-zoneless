import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DoCheck, inject, Input, OnDestroy, signal
} from '@angular/core';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';

export interface Product { id: number; name: string; category: string; price: number; }

// ── Default-strategy table wrapper (no shield) ────────────────────────────────
@Component({
  selector: 'app-default-table',
  imports: [TableModule],
  // Default strategy — re-checked on every AppRef.tick()
  template: `
    <div class="component-box" [class.checking]="isChecking">
      <span class="component-box-label">Default strategy table</span>
      <div class="result-row" style="margin-bottom:0.5rem">
        <span class="result-label">CD visits:</span>
        <span class="render-badge" [class.flash]="isChecking">{{ checkCount }}</span>
      </div>
      <p-table [value]="products" [tableStyle]="{'min-width': '20rem'}" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr><th>Name</th><th>Category</th><th style="text-align:right">Price</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr><td>{{ p.name }}</td><td>{{ p.category }}</td><td style="text-align:right">€{{ p.price }}</td></tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class DefaultTableComponent implements DoCheck {
  @Input({ required: true }) products: Product[] = [];
  checkCount = 0;
  isChecking = false;

  ngDoCheck() {
    this.checkCount++;
    this.isChecking = true;
    setTimeout(() => { this.isChecking = false; }, 200);
  }
}

// ── OnPush table wrapper (shielded) ───────────────────────────────────────────
@Component({
  selector: 'app-onpush-table',
  imports: [TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="flashing()">
      <span class="component-box-label">OnPush child — SHIELDED</span>
      <div class="result-row" style="margin-bottom:0.5rem">
        <span class="result-label">CD visits:</span>
        <span class="render-badge" [class.flash]="flashing()">{{ checkCount }}</span>
      </div>
      <p-table [value]="products" [tableStyle]="{'min-width': '20rem'}" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr><th>Name</th><th>Category</th><th style="text-align:right">Price</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr><td>{{ p.name }}</td><td>{{ p.category }}</td><td style="text-align:right">€{{ p.price }}</td></tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class OnpushTableComponent implements DoCheck {
  @Input({ required: true }) products: Product[] = [];
  checkCount = 0;
  flashing = signal(false);

  ngDoCheck() {
    this.checkCount++;
    this.flashing.set(true);
    setTimeout(() => this.flashing.set(false), 200);
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-onpush-shield',
  imports: [Button, DefaultTableComponent, OnpushTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>OnPush Shield — PrimeNG Tables</h2>
      <p class="subtitle">
        An OnPush component with unchanged inputs is skipped entirely, protecting its whole subtree.
        PrimeNG components use OnPush internally — which is exactly what you want.
      </p>

      <div class="info-box" style="margin-bottom:1rem">
        <strong>Scenario:</strong> A parent component updates a counter every second
        (simulating a "live feed" or global state change).
        The <em>product list passed to the table is never changed</em>.
        Watch how the Default-strategy table re-renders on every tick
        while the OnPush table is completely skipped.
      </div>

      <!-- Parent counter + controls -->
      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header neutral">
          <i class="pi pi-chart-line"></i> Parent component (Default strategy — ticks every second)
        </div>
        <div class="demo-card-body">
          <div class="result-row">
            <span class="result-label">Live ticker</span>
            <span class="result-value" style="font-size:1.2rem;color:#3b82f6">{{ ticker }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Parent CD visits</span>
            <span class="render-badge">{{ parentChecks }}</span>
          </div>
          <div class="btn-row" style="margin-top:0.75rem">
            @if (!running()) {
              <p-button label="Start ticker" size="small" severity="secondary" (onClick)="start()" />
            } @else {
              <p-button label="Stop ticker" size="small" severity="danger" (onClick)="stop()" />
            }
            <p-button label="Pass NEW product reference to OnPush" size="small" severity="info" (onClick)="refreshProducts()" />
          </div>
        </div>
      </div>

      <!-- Tables side by side -->
      <div class="two-col">
        <div class="demo-card">
          <div class="demo-card-header broken"><i class="pi pi-times-circle"></i> Default strategy child</div>
          <div class="demo-card-body">
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              Re-checked on every parent tick — even though products never changed.
              This is expensive in a real app with many components.
            </p>
            <app-default-table [products]="products" />
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-card-header fixed"><i class="pi pi-shield"></i> OnPush child</div>
          <div class="demo-card-body">
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              Skipped on every tick because its <code>products</code> input reference didn't change.
              Click "Pass NEW product reference" to trigger a real update.
            </p>
            <app-onpush-table [products]="products" />
          </div>
        </div>
      </div>

      <div class="demo-card" style="margin-top:1rem">
        <div class="demo-card-header neutral"><i class="pi pi-book"></i> Why PrimeNG uses OnPush</div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeExplain }}</pre>
          <div class="info-box" style="margin-top:0.5rem">
            PrimeNG's <code>p-table</code>, <code>p-dropdown</code>, <code>p-calendar</code> etc. are all
            <code>ChangeDetectionStrategy.OnPush</code>. This means a feature with 10 PrimeNG components
            on screen does <em>not</em> pay the cost of checking all 10 on every parent re-render —
            only those whose inputs actually changed.
            It would be very bad if PrimeNG components were Default strategy.
          </div>
        </div>
      </div>
    </div>
  `
})
export class OnpushShieldComponent implements DoCheck, OnDestroy {
  products: Product[] = [
    { id: 1, name: 'Angular Hoodie', category: 'Clothing', price: 49 },
    { id: 2, name: 'RxJS Mug',       category: 'Kitchen',  price: 12 },
    { id: 3, name: 'Signals Tote',   category: 'Bags',     price: 18 },
  ];
  private nextId = 4;

  ticker = 0;
  parentChecks = 0;
  running = signal(false);
  private interval: ReturnType<typeof setInterval> | null = null;

  ngDoCheck() { this.parentChecks++; }

  start() {
    this.running.set(true);
    this.interval = setInterval(() => { this.ticker++; }, 1000);
  }

  stop() {
    this.running.set(false);
    if (this.interval) clearInterval(this.interval);
  }

  refreshProducts() {
    // Pass a new reference → OnPush table detects the change and re-renders
    this.products = [
      ...this.products,
      { id: this.nextId++, name: `New product ${this.nextId}`, category: 'New', price: 99 }
    ];
  }

  ngOnDestroy() { this.stop(); }

  readonly codeExplain = `// All PrimeNG components use OnPush:
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class Table { ... }

// Your feature component with 5 PrimeNG tables — Default strategy parent:
// Parent ticks 100 times → PrimeNG tables are visited but SKIPPED
// unless one of their @Input() references changed.
// The whole PrimeNG subtree is shielded for free.`;
}
