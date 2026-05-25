import {
  AfterViewInit, ChangeDetectionStrategy, Component,
  computed, DoCheck, inject, Input, QueryList,
  signal, ViewChild, ViewChildren
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { Button } from 'primeng/button';

// ── A simple item that can be dynamically added (for QueryList demo) ───────────
@Component({
  selector: 'app-query-item',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="query-item">{{ label }}</span>`,
  styles: [`.query-item { display:inline-block; padding: 0.2rem 0.6rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 0.8rem; margin: 0.2rem; }`]
})
export class QueryItemComponent {
  @Input() label = '';
}

// ── Broken Part A: queryParams subscribe → plain property, no signals ─────────
// Lives in its own LView so signal-triggered CD on the parent never sweeps it.
@Component({
  selector: 'app-broken-qp-cell',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-row">
      <span class="result-label">Selected ID</span>
      <span class="result-value">{{ selected || '—' }}</span>
    </div>
    <div class="result-row">
      <span class="result-label">CD visits</span>
      <span class="render-badge">{{ checkCount }}</span>
    </div>
  `
})
export class BrokenQpCellComponent implements DoCheck {
  private route = inject(ActivatedRoute);
  selected = '';
  checkCount = 0;
  constructor() {
    this.route.queryParams.subscribe(p => { this.selected = p['item'] ?? ''; });
  }
  ngDoCheck() { this.checkCount++; }
}

// ── Broken Part B: router.events subscribe → plain property ──────────────────
@Component({
  selector: 'app-broken-events-cell',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-row">
      <span class="result-label">Last navigation (broken)</span>
      <span class="result-value" style="font-size:0.78rem">{{ lastUrl || '—' }}</span>
    </div>
  `
})
export class BrokenEventsCellComponent {
  private router = inject(Router);
  lastUrl = '';
  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => { this.lastUrl = (e as NavigationEnd).urlAfterRedirects; });
  }
}

// ── Broken Part C: QueryList.changes subscribe → plain property ───────────────
@Component({
  selector: 'app-broken-ql-cell',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-row">
      <span class="result-label">Item count (broken)</span>
      <span class="result-value">{{ itemCount }}</span>
    </div>
  `
})
export class BrokenQlCellComponent {
  itemCount = 0;
  wire(ql: QueryList<QueryItemComponent>) {
    ql.changes.subscribe(() => { this.itemCount = ql.length; });
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-router-demo',
  imports: [Button, RouterModule, QueryItemComponent,
            BrokenQpCellComponent, BrokenEventsCellComponent, BrokenQlCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Router &amp; QueryList in Zoneless</h2>
      <p class="subtitle">
        The Router framework behavior (outlet swaps, routerLinkActive) is zoneless-safe.
        Developer code that subscribes to Router observables has the same risk as any RxJS subscription.
      </p>

      <!-- ── PART A: ActivatedRoute.queryParams ─────────────────────────────── -->
      <div class="section-label">Part A — ActivatedRoute query params</div>

      <div class="info-box">
        Click an item below. Both panels read from <code>ActivatedRoute.queryParams</code>.
        Watch which one updates in <strong>Zoneless</strong> mode.
        Switch to <strong>Zone.js</strong> mode — both work because Zone.js intercepts
        the Router's navigation Promise and calls <code>AppRef.tick()</code>.
      </div>

      <div class="btn-row" style="margin-bottom:0.75rem">
        @for (item of items; track item.id) {
          <p-button
            [label]="item.label"
            size="small"
            [severity]="selectedSignal() === item.id ? 'primary' : 'secondary'"
            (onClick)="navigate(item.id)"
          />
        }
        <p-button label="Clear" size="small" severity="secondary" (onClick)="navigate(null)" />
      </div>

      <div class="two-col">
        <!-- Broken -->
        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> subscribe → plain property
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeQueryBroken }}</pre>
            <app-broken-qp-cell />
            <div class="error-box" style="margin-top:0.5rem">
              Zoneless: <code>queryParams</code> emits after navigation completes
              (async). Plain property update → no CD scheduled → stays stale.
            </div>
          </div>
        </div>

        <!-- Fixed -->
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> toSignal (recommended)
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeQueryFixed }}</pre>
            <div class="result-row">
              <span class="result-label">Selected ID</span>
              <span class="result-value">{{ selectedSignal() || '—' }}</span>
            </div>
            <div class="result-row">
              <span class="result-label">CD visits</span>
              <span class="render-badge">{{ fixedCheckCount }}</span>
            </div>
            <div class="success-box" style="margin-top:0.5rem">
              <code>toSignal()</code> bridges the Observable to the signal graph.
              Every emission schedules CD automatically.
            </div>
          </div>
        </div>
      </div>

      <!-- ── PART A bonus: withComponentInputBinding ─────────────────────────── -->
      <div class="demo-card" style="margin-bottom:1rem">
        <div class="demo-card-header info">
          <i class="pi pi-link"></i> Best option — withComponentInputBinding()
        </div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeInputBinding }}</pre>
          <div class="info-box">
            With <code>withComponentInputBinding()</code> in <code>provideRouter()</code>,
            route params and query params flow directly into <code>@Input()</code> fields.
            No <code>ActivatedRoute</code>, no subscribe, no <code>toSignal()</code>.
            Angular handles the wiring — and since it's an <code>@Input()</code> change,
            OnPush components update correctly too.
          </div>
        </div>
      </div>

      <!-- ── PART B: router.events ──────────────────────────────────────────── -->
      <div class="section-label">Part B — router.events</div>

      <div class="two-col" style="margin-bottom:1rem">
        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> router.events subscribe → broken
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeEventsBroken }}</pre>
            <app-broken-events-cell />
          </div>
        </div>

        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> toSignal(router.events) → fixed
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeEventsFixed }}</pre>
            <div class="result-row">
              <span class="result-label">Last navigation (fixed)</span>
              <span class="result-value" style="font-size:0.78rem">{{ lastUrl() || '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── PART C: QueryList.changes ──────────────────────────────────────── -->
      <div class="section-label">Part C — @ViewChildren QueryList.changes</div>

      <div class="info-box">
        <code>QueryList.changes</code> is an Observable that fires when <code>@ViewChildren</code>
        or <code>@ContentChildren</code> results change (items added or removed from the DOM).
        Subscribing and mutating a plain property has the same problem.
      </div>

      <div class="btn-row" style="margin-bottom:0.75rem">
        <p-button label="Add item" size="small" severity="success" (onClick)="addQueryItem()" />
        <p-button label="Remove last" size="small" severity="danger" (onClick)="removeQueryItem()" [disabled]="queryLabels().length === 0" />
      </div>

      <div class="two-col">
        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> items.changes.subscribe → broken
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeQueryListBroken }}</pre>
            <app-broken-ql-cell #brokenQlCell />
            <div class="result-row">
              <span class="result-label">Items rendered</span>
              <span class="result-value">{{ queryLabels().length }}</span>
            </div>
          </div>
        </div>

        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> toSignal(items.changes) → fixed
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeQueryListFixed }}</pre>
            <div class="result-row">
              <span class="result-label">Item count (signal)</span>
              <span class="result-value">{{ fixedItemCount() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Rendered items (shared for both columns) -->
      <div style="margin-top:0.5rem;padding:0.75rem;background:white;border:1px solid #e2e8f0;border-radius:8px">
        @for (label of queryLabels(); track label) {
          <app-query-item [label]="label" />
        }
        @if (!queryLabels().length) {
          <span style="font-size:0.82rem;color:#94a3b8">No items — click Add item</span>
        }
      </div>
    </div>
  `
})
export class RouterDemoComponent implements DoCheck, AfterViewInit {
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  // ── Navigation items ────────────────────────────────────────────────────────
  readonly items = [
    { id: 'alpha',   label: 'Alpha' },
    { id: 'beta',    label: 'Beta' },
    { id: 'gamma',   label: 'Gamma' },
  ];

  navigate(id: string | null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id ? { item: id } : {},
      queryParamsHandling: id ? 'merge' : '',
    });
  }

  // ── Part A: Fixed — toSignal ──────────────────────────────────────────────
  fixedCheckCount = 0;
  private readonly qp     = toSignal(this.route.queryParams, { initialValue: {} as Record<string, string> });
  readonly selectedSignal = computed(() => this.qp()['item'] ?? '');

  // ── Part B: Fixed — toSignal(router.events) ───────────────────────────────
  readonly lastUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: '' }
  );

  // ── Part C: QueryList ─────────────────────────────────────────────────────
  queryLabels = signal<string[]>([]);
  private labelCounter = 1;

  @ViewChildren(QueryItemComponent) queryItems!: QueryList<QueryItemComponent>;
  @ViewChild('brokenQlCell') brokenQlCell!: BrokenQlCellComponent;

  readonly fixedItemCount = signal(0);

  ngAfterViewInit() {
    this.brokenQlCell.wire(this.queryItems);
    this.queryItems.changes.subscribe(() => {
      this.fixedItemCount.set(this.queryItems.length);
    });
  }

  ngDoCheck() { this.fixedCheckCount++; }

  addQueryItem()    { this.queryLabels.update(l => [...l, `Item ${this.labelCounter++}`]); }
  removeQueryItem() { this.queryLabels.update(l => l.slice(0, -1)); }

  // ── Code snippets ─────────────────────────────────────────────────────────
  readonly codeQueryBroken = `// ✗ Broken — subscribe to queryParams
constructor(private route: ActivatedRoute) {
  this.route.queryParams.subscribe(params => {
    this.selectedId = params['item']; // plain property
    // navigation is async → no CD scheduled → stale
  });
}`;

  readonly codeQueryFixed = `// ✓ Fixed — toSignal
private readonly qp   = toSignal(
  this.route.queryParams, { initialValue: {} }
);
readonly selectedId = computed(() => this.qp()['item'] ?? '');`;

  readonly codeInputBinding = `// app.config.ts — enable once for the whole app
provideRouter(routes, withComponentInputBinding())

// component.ts — params flow in as @Input()
@Component({ ... })
class ProductComponent {
  @Input() id = '';         // ?id=42  → this.id = '42'
  @Input() category = '';   // ?category=shoes
  // No ActivatedRoute. No subscribe. No toSignal.
}`;

  readonly codeEventsBroken = `// ✗ Broken
this.router.events
  .pipe(filter(e => e instanceof NavigationEnd))
  .subscribe(e => {
    this.lastUrl = e.urlAfterRedirects; // plain property
  });`;

  readonly codeEventsFixed = `// ✓ Fixed
readonly lastUrl = toSignal(
  this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => e.urlAfterRedirects)
  ),
  { initialValue: '' }
);`;

  readonly codeQueryListBroken = `// ✗ Broken — subscribe to QueryList.changes
@ViewChildren(ItemComponent) items!: QueryList<ItemComponent>;

ngAfterViewInit() {
  this.items.changes.subscribe(() => {
    this.itemCount = this.items.length; // plain property
  });
}`;

  readonly codeQueryListFixed = `// ✓ Fixed — signal updated in subscribe
// (toSignal needs injection context; use signal directly)
readonly itemCount = signal(0);

ngAfterViewInit() {
  this.items.changes.subscribe(() => {
    this.itemCount.set(this.items.length); // signal → CD scheduled
  });
}

// Even cleaner with toSignal in injection context:
readonly count = toSignal(
  this.items.changes.pipe(
    startWith(null),
    map(() => this.items.length)
  ), { initialValue: 0 }
);`;
}
