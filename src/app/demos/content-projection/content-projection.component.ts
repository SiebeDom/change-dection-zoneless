import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DoCheck,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Button } from 'primeng/button';

// ── User component: Default strategy, no signals ──────────────────────────────
// Simulates a user-provided component that relies on zone.js for CD.
// renderCount and lastRendered only update when Angular actually visits
// this component's view — that's the thing we're testing.
@Component({
  selector: 'app-user-form',
  template: `
    <div class="component-box">
      <span class="component-box-label">User component — Default, no signals</span>
      <div class="result-row">
        <span class="result-label">Render count (ngDoCheck)</span>
        <span class="render-badge">{{ renderCount }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Last rendered at</span>
        <span class="render-badge" style="font-variant-numeric: tabular-nums">{{ lastRendered }}</span>
      </div>
    </div>
  `,
})
export class UserFormComponent implements DoCheck {
  renderCount = 0;
  lastRendered = 'never';

  ngDoCheck() {
    this.renderCount++;
    const d = new Date();
    this.lastRendered =
      `${String(d.getHours()).padStart(2,'0')}:` +
      `${String(d.getMinutes()).padStart(2,'0')}:` +
      `${String(d.getSeconds()).padStart(2,'0')}`;
  }
}

// ── lib-card: OnPush host with content projection slot ────────────────────────
@Component({
  selector: 'lib-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lib-host-box">
      <div class="lib-host-label">lib-card — OnPush</div>
      <ng-content />
    </div>
  `,
})
export class LibCardComponent {}

// ── lib-dynamic-onpush: OnPush host using ViewContainerRef.createComponent ────
// The dynamic component lives inside this subtree.
// Because this host is OnPush and its inputs never change, Angular skips
// the whole subtree — the dynamic child is never visited.
@Component({
  selector: 'lib-dynamic-onpush',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lib-host-box broken">
      <div class="lib-host-label">lib-dynamic-host — OnPush</div>
      <ng-container #outlet />
    </div>
  `,
})
export class LibDynamicOnPushComponent implements AfterViewInit {
  @ViewChild('outlet', { read: ViewContainerRef }) outlet!: ViewContainerRef;
  private dynamicRef: ComponentRef<UserFormComponent> | null = null;

  ngAfterViewInit() {
    this.dynamicRef = this.outlet.createComponent(UserFormComponent);
  }

  forceCheck() {
    this.dynamicRef?.changeDetectorRef.detectChanges();
  }
}

// ── lib-dynamic-default: Default host using ViewContainerRef.createComponent ──
// Same dynamic pattern but without OnPush — Angular always enters this subtree,
// so the dynamically created component is visited normally.
@Component({
  selector: 'lib-dynamic-default',
  template: `
    <div class="lib-host-box success">
      <div class="lib-host-label">lib-dynamic-host — Default strategy</div>
      <ng-container #outlet />
    </div>
  `,
})
export class LibDynamicDefaultComponent implements AfterViewInit {
  @ViewChild('outlet', { read: ViewContainerRef }) outlet!: ViewContainerRef;

  ngAfterViewInit() {
    this.outlet.createComponent(UserFormComponent);
  }
}

// ── Main demo page ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-content-projection',
  imports: [Button, LibCardComponent, LibDynamicOnPushComponent, LibDynamicDefaultComponent, UserFormComponent],
  template: `
    <div class="demo-page">
      <h2>Content Projection vs ViewContainerRef.createComponent</h2>
      <p class="subtitle">
        Click <strong>Save</strong> in any column. The click is a zone.js event — it schedules
        a global CD run. Watch which user components actually get re-rendered.
      </p>

      <div class="info-box">
        <strong>Zone.js mode only.</strong> Switch to zoneless (top-right) and all three columns
        freeze — a Default-strategy component has no way to schedule a check without zone.js.
      </div>

      <div class="three-col" style="margin-top: 1rem">

        <!-- Column 1: content projection into OnPush host — SAFE ─────────────── -->
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> ng-content slot — OnPush host
          </div>
          <div class="demo-card-body">
            <p class="hint">
              User component is compiled into the <em>parent's</em> view.
              lib-card's OnPush strategy only shields lib-card's own template.
            </p>
            <lib-card>
              <app-user-form />
            </lib-card>
            <div class="btn-row" style="margin-top: 0.75rem">
              <p-button label="Save" icon="pi pi-save" size="small" severity="success" (onClick)="onSave(1)" />
            </div>
            <div class="save-status" [class.visible]="saves[0]">Saved ✓</div>
          </div>
        </div>

        <!-- Column 2: ViewContainerRef.createComponent + OnPush host — BLOCKED ─ -->
        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> createComponent — OnPush host
          </div>
          <div class="demo-card-body">
            <p class="hint">
              User component lives inside the OnPush host's VCRef. The host has no
              dirty inputs → its entire subtree is skipped on every CD run.
            </p>
            <lib-dynamic-onpush #onpushHost />
            <div class="btn-row" style="margin-top: 0.75rem">
              <p-button label="Save" icon="pi pi-save" size="small" severity="danger" (onClick)="onSave(2)" />
              <p-button label="Force detectChanges" size="small" severity="secondary" (onClick)="onpushHost.forceCheck()" />
            </div>
            <div class="save-status" [class.visible]="saves[1]">Saved ✓ (parent notified, but user component never re-rendered)</div>
          </div>
        </div>

        <!-- Column 3: ViewContainerRef.createComponent + Default host — SAFE ─── -->
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> createComponent — Default host
          </div>
          <div class="demo-card-body">
            <p class="hint">
              Same dynamic pattern, but the host uses Default strategy.
              Angular always enters its subtree → the dynamic component is visited normally.
            </p>
            <lib-dynamic-default />
            <div class="btn-row" style="margin-top: 0.75rem">
              <p-button label="Save" icon="pi pi-save" size="small" severity="success" (onClick)="onSave(3)" />
            </div>
            <div class="save-status" [class.visible]="saves[2]">Saved ✓</div>
          </div>
        </div>

      </div>

      <div class="demo-card">
        <div class="demo-card-header neutral"><i class="pi pi-book"></i> CD tree — where the user component lives</div>
        <div class="demo-card-body">
          <pre class="code-block">{{ treeExplanation }}</pre>
          <div class="info-box" style="margin-top: 0.5rem">
            Library components that call <code>ViewContainerRef.createComponent()</code>
            (dialogs, overlays, portals) <strong>cannot safely use OnPush</strong> if the
            hosted component may be Default strategy and rely on zone.js.
            <code>&lt;ng-content&gt;</code> and template-ref inputs are always safe — the host
            owns only its own template, not the projected content.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lib-host-box {
      border: 2px dashed #a855f7; border-radius: 8px;
      padding: 0.75rem 0.875rem; background: #faf5ff;
    }
    .lib-host-box.broken  { border-color: #ef4444; background: #fff5f5; }
    .lib-host-box.success { border-color: #22c55e; background: #f0fdf4; }
    .lib-host-label {
      font-size: 0.68rem; font-weight: 700; color: #7c3aed;
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;
    }
    .lib-host-box.broken  .lib-host-label { color: #dc2626; }
    .lib-host-box.success .lib-host-label { color: #16a34a; }
    .hint { font-size: 0.82rem; color: #64748b; margin-bottom: 0.75rem; line-height: 1.5; }
    .save-status {
      font-size: 0.8rem; color: #16a34a; font-weight: 600;
      min-height: 1.2em; opacity: 0; transition: opacity 0.2s;
    }
    .save-status.visible { opacity: 1; }
  `],
})
export class ContentProjectionComponent {
  saves = [false, false, false];
  private saveTimers: ReturnType<typeof setTimeout>[] = [];

  onSave(column: 1 | 2 | 3) {
    const i = column - 1;
    this.saves[i] = true;
    clearTimeout(this.saveTimers[i]);
    this.saveTimers[i] = setTimeout(() => { this.saves[i] = false; }, 2000);
  }

  readonly treeExplanation =
`// 1. ng-content slot — user component lives in the PARENT's view:
//
//   Parent (Default)                  ← zone.js click → check
//     ├── LibCardComponent (OnPush)   ← own template skipped (not dirty)
//     └── UserFormComponent (Default) ✓  ← direct child of parent, always visited
//
// 2. createComponent — OnPush host — user component is INSIDE the host:
//
//   Parent (Default)                      ← zone.js click → check
//     └── LibDynamicOnPush (OnPush) ✗    ← not dirty → entire subtree SKIPPED
//           └── [VCRef] UserFormComponent  ← never visited
//
// 3. createComponent — Default host — host has no shield:
//
//   Parent (Default)                      ← zone.js click → check
//     └── LibDynamicDefault (Default) ✓  ← always checked
//           └── [VCRef] UserFormComponent ✓  ← visited normally`;
}
