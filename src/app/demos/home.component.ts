import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Demo {
  route: string;
  icon: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Angular Change Detection &amp; Zoneless</h2>
      <p class="subtitle">
        Interactive demos that show how Angular decides when and what to re-render —
        and how the move to zoneless changes the rules.
      </p>

      <div class="info-box">
        <strong>Zone.js vs Zoneless toggle</strong> — use the button in the top-right corner.
        The page reloads and the <code>app.config.ts</code> switches between
        <code>provideZoneChangeDetection()</code> and
        <code>provideExperimentalZonelessChangeDetection()</code>.
        Demos that behave differently in each mode will tell you.
      </div>

      <div class="card-grid">
        @for (demo of demos; track demo.route) {
          <a class="home-card" [routerLink]="demo.route">
            <div class="home-card-icon"><i class="pi {{ demo.icon }}"></i></div>
            <div class="home-card-body">
              <div class="home-card-title">{{ demo.title }}</div>
              <div class="home-card-desc">{{ demo.description }}</div>
            </div>
            <span class="home-card-tag" [style.background]="demo.tagColor">{{ demo.tag }}</span>
          </a>
        }
      </div>

      <div class="section-label" style="margin-top: 1.5rem">Key concepts this app covers</div>
      <div class="concept-list">
        <div class="concept">
          <strong>LView</strong> — Angular's per-instance flat array storing DOM node references and last-rendered binding values.
          <a href="https://jeanmeche.github.io/angular-compiler-output/" target="_blank">See compiler output →</a>
        </div>
        <div class="concept">
          <strong>markForCheck()</strong> — sets a dirty flag and schedules a microtask. Does not run CD itself.
          <a href="https://angular.dev/api/core/ChangeDetectorRef#markForCheck" target="_blank">Docs →</a>
        </div>
        <div class="concept">
          <strong>detectChanges()</strong> — synchronously runs CD on the component's subtree (not the whole tree).
          <a href="https://angular.dev/api/core/ChangeDetectorRef#detectChanges" target="_blank">Docs →</a>
        </div>
        <div class="concept">
          <strong>OnPush shield</strong> — an OnPush component that isn't dirty is skipped entirely, protecting its whole subtree.
          <a href="https://angular.dev/best-practices/runtime-performance" target="_blank">Docs →</a>
        </div>
        <div class="concept">
          <strong>ExpressionChangedAfterItHasBeenChecked</strong> — dev-mode guard that catches state changed as a side effect of rendering.
          <a href="https://angular.dev/errors/NG0100" target="_blank">Docs →</a>
        </div>
      </div>

      <div class="section-label" style="margin-top: 1.5rem">Best resources</div>
      <div class="resource-list">
        <a href="https://justangular.com/blog/a-change-detection-zone-js-zoneless-local-change-detection-and-signals-story" target="_blank" class="resource-link">
          A change detection, Zone.js, zoneless &amp; signals story — Enea Jahollari (justangular.com)
        </a>
        <a href="https://jeanmeche.github.io/angular-change-detection/" target="_blank" class="resource-link">
          Angular CD Visualizer — Matthieu Riegler (interactive tool)
        </a>
        <a href="https://blog.angular-university.io/how-does-angular-2-change-detection-really-work/" target="_blank" class="resource-link">
          How does Angular CD really work? — Angular University
        </a>
        <a href="https://medium.com/angularwave/local-change-detection-and-angular-signals-in-templates-in-details-948283adc36d" target="_blank" class="resource-link">
          Local CD and Angular signals in detail — angularwave / Medium
        </a>
        <a href="https://www.youtube.com/watch?v=rL-gInxctZs" target="_blank" class="resource-link">
          YouTube — Signals &amp; Change Detection deep dive
        </a>
        <a href="https://www.youtube.com/watch?v=FvNXnBdIX1M" target="_blank" class="resource-link">
          YouTube — Zoneless Angular
        </a>
      </div>
    </div>
  `,
  styles: [`
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.875rem; }

    .home-card {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 1rem; background: white; border: 1px solid #e2e8f0;
      border-radius: 8px; text-decoration: none; color: inherit;
      transition: box-shadow 0.15s, border-color 0.15s; position: relative;
    }
    .home-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); border-color: #93c5fd; }
    .home-card-icon { font-size: 1.3rem; color: #3b82f6; margin-top: 0.1rem; }
    .home-card-title { font-weight: 600; font-size: 0.9rem; color: #1e293b; margin-bottom: 0.2rem; }
    .home-card-desc { font-size: 0.8rem; color: #64748b; line-height: 1.4; }
    .home-card-tag {
      position: absolute; top: 0.6rem; right: 0.6rem;
      font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem;
      border-radius: 4px; color: white; text-transform: uppercase;
    }

    .concept-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .concept { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem 0.875rem; font-size: 0.85rem; color: #334155; }
    .concept a { color: #3b82f6; margin-left: 0.35rem; font-size: 0.8rem; }

    .resource-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .resource-link { color: #3b82f6; font-size: 0.85rem; text-decoration: none; padding: 0.3rem 0; }
    .resource-link:hover { text-decoration: underline; }
  `]
})
export class HomeComponent {
  readonly demos: Demo[] = [
    { route: '/interpolation',      icon: 'pi-code',                 title: 'Interpolation vs Binding',   description: '{{ }} always coerces to string. [prop]="x" preserves the original type.',      tag: 'basics', tagColor: '#3b82f6' },
    { route: '/cd-triggers',        icon: 'pi-sync',                 title: 'CD Triggers',                description: 'Zone.js vs zoneless. markForCheck vs detectChanges. Async mutations.',          tag: 'core',   tagColor: '#8b5cf6' },
    { route: '/reactive-forms',     icon: 'pi-file-edit',            title: 'Reactive Forms',             description: 'Why form subscriptions silently break in zoneless and how to fix them.',        tag: 'gotcha', tagColor: '#ef4444' },
    { route: '/immutability',       icon: 'pi-database',             title: 'Immutability',               description: 'OnPush compares references. Mutating an array or object is invisible to Angular.', tag: 'onpush', tagColor: '#f59e0b' },
    { route: '/onpush-shield',      icon: 'pi-shield',               title: 'OnPush Shield (PrimeNG)',    description: 'An OnPush component shields its entire subtree — even Default-strategy children.', tag: 'onpush', tagColor: '#f59e0b' },
    { route: '/expression-changed', icon: 'pi-exclamation-triangle', title: 'ExpressionChanged error',    description: 'The dev-mode guard that fires when state changes as a side effect of rendering.',  tag: 'devmode', tagColor: '#6b7280' },
  ];
}
