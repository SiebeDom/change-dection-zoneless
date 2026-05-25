import {
  ChangeDetectionStrategy, Component, DoCheck, Input, OnChanges, signal, SimpleChanges
} from '@angular/core';

export interface Car { id: number; make: string; model: string; }

@Component({
  selector: 'app-car-list',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="component-box" [class.checking]="flashing()">
      <span class="component-box-label">OnPush child</span>

      <div class="result-row">
        <span class="result-label">cars.length</span>
        <span class="result-value">{{ cars.length }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">@Input changes detected</span>
        <span class="render-badge" [class.flash]="flashing()">{{ inputChangeCount }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits (ngDoCheck)</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>

      <div style="margin-top:0.5rem">
        @for (car of cars; track car.id) {
          <div style="font-size:0.82rem;padding:0.2rem 0;color:#475569">
            {{ car.id }}. {{ car.make }} {{ car.model }}
          </div>
        }
        @if (!cars.length) {
          <div style="font-size:0.82rem;color:#94a3b8">No cars</div>
        }
      </div>
    </div>
  `
})
export class CarListComponent implements OnChanges, DoCheck {
  @Input({ required: true }) cars: Car[] = [];

  inputChangeCount = 0;
  checkCount = 0;
  flashing = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cars']) {
      this.inputChangeCount++;
      this.flashing.set(true);
      setTimeout(() => this.flashing.set(false), 500);
    }
  }

  ngDoCheck() { this.checkCount++; }
}

// ── Default-strategy version — no ChangeDetectionStrategy.OnPush ───────────────
@Component({
  selector: 'app-car-list-default',
  imports: [],
  // Default strategy — re-checked on every AppRef.tick()
  template: `
    <div class="component-box" [class.checking]="isChecking">
      <span class="component-box-label">Default strategy child</span>

      <div class="result-row">
        <span class="result-label">cars.length</span>
        <span class="result-value">{{ cars.length }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">@Input changes detected</span>
        <span class="render-badge" [class.flash]="isChecking">{{ inputChangeCount }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">CD visits (ngDoCheck)</span>
        <span class="render-badge">{{ checkCount }}</span>
      </div>

      <div style="margin-top:0.5rem">
        @for (car of cars; track car.id) {
          <div style="font-size:0.82rem;padding:0.2rem 0;color:#475569">
            {{ car.id }}. {{ car.make }} {{ car.model }}
          </div>
        }
        @if (!cars.length) {
          <div style="font-size:0.82rem;color:#94a3b8">No cars</div>
        }
      </div>
    </div>
  `
})
export class DefaultCarListComponent implements OnChanges, DoCheck {
  @Input({ required: true }) cars: Car[] = [];

  inputChangeCount = 0;
  checkCount = 0;
  isChecking = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cars']) {
      this.inputChangeCount++;
    }
  }

  ngDoCheck() {
    this.checkCount++;
    this.isChecking = true;
    setTimeout(() => { this.isChecking = false; }, 300);
  }
}
