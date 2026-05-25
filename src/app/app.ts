import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

const MODE_KEY = 'cd-mode';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-layout">

      <header class="top-bar">
        <span class="app-title">
          <i class="pi pi-bolt"></i> Angular CD Demo
        </span>
        <div class="top-right">
          @if (isZone()) {
            <p-tag value="Zone.js" severity="warn" />
          } @else {
            <p-tag value="Zoneless" severity="success" />
          }
          <p-button
            [label]="isZone() ? '→ Switch to Zoneless' : '→ Switch to Zone.js'"
            size="small"
            severity="secondary"
            (onClick)="toggleMode()"
          />
        </div>
      </header>

      <div class="body">
        <nav class="sidebar">
          @for (item of nav; track item.route) {
            <a class="nav-link" [routerLink]="item.route" routerLinkActive="active">
              <i class="pi {{ item.icon }}"></i> {{ item.label }}
            </a>
          }
          <div class="nav-divider"></div>
          <a class="nav-link small" href="https://angular.dev/guide/zoneless" target="_blank">
            <i class="pi pi-external-link"></i> Zoneless docs
          </a>
          <a class="nav-link small" href="https://jeanmeche.github.io/angular-change-detection/" target="_blank">
            <i class="pi pi-external-link"></i> CD Visualizer
          </a>
        </nav>
        <main class="main">
          <router-outlet />
        </main>
      </div>

    </div>
  `,
  styles: [`
    .app-layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.25rem; height: 52px;
      background: #1e1e2e; border-bottom: 1px solid #313244; flex-shrink: 0;
    }
    .app-title { font-weight: 700; color: #a6e3a1; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .top-right { display: flex; align-items: center; gap: 0.75rem; }

    .body { display: flex; flex: 1; overflow: hidden; }

    .sidebar {
      width: 200px; background: #181825; display: flex; flex-direction: column;
      padding: 0.5rem 0; flex-shrink: 0; overflow-y: auto;
    }
    .nav-link {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.55rem 1rem; color: #a6adc8; text-decoration: none;
      font-size: 0.85rem; transition: all 0.15s; white-space: nowrap;
    }
    .nav-link.small { font-size: 0.78rem; color: #6c7086; }
    .nav-link:hover { background: #2d2d44; color: #cdd6f4; }
    .nav-link.active { background: #313244; color: #89b4fa; border-right: 2px solid #89b4fa; }
    .nav-link i { width: 14px; font-size: 0.8rem; flex-shrink: 0; }
    .nav-divider { height: 1px; background: #313244; margin: 0.5rem 0.75rem; }

    .main { flex: 1; overflow-y: auto; padding: 1.5rem; background: #f8fafc; }
  `]
})
export class App {
  readonly isZone = signal(localStorage.getItem(MODE_KEY) === 'zone');

  readonly nav = [
    { label: 'Home',              icon: 'pi-home',                 route: '/home' },
    { label: 'Interpolation',     icon: 'pi-code',                 route: '/interpolation' },
    { label: 'CD Triggers',       icon: 'pi-sync',                 route: '/cd-triggers' },
    { label: 'Reactive Forms',    icon: 'pi-file-edit',            route: '/reactive-forms' },
    { label: 'Immutability',      icon: 'pi-database',             route: '/immutability' },
    { label: 'OnPush Shield',     icon: 'pi-shield',               route: '/onpush-shield' },
    { label: 'Expr. Changed',     icon: 'pi-exclamation-triangle', route: '/expression-changed' },
    { label: 'Router Demo',       icon: 'pi-map',                  route: '/router-demo' },
    { label: 'Async Writes',      icon: 'pi-send',                 route: '/async-writes' },
    { label: 'Proj. vs Dynamic',  icon: 'pi-clone',                route: '/content-projection' },
  ];

  toggleMode() {
    const next = this.isZone() ? 'zoneless' : 'zone';
    localStorage.setItem(MODE_KEY, next);
    window.location.reload();
  }
}
