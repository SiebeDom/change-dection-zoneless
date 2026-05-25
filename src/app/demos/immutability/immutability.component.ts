import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Car, CarListComponent, DefaultCarListComponent } from './list-child.component';

@Component({
  selector: 'app-immutability',
  imports: [Button, CarListComponent, DefaultCarListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page">
      <h2>Immutability &amp; OnPush</h2>
      <p class="subtitle">
        OnPush checks whether the <em>reference</em> to an <code>@Input()</code> changed.
        Mutating an existing array or object is invisible — the reference is the same.
      </p>

      <div class="info-box">
        <strong>How Angular checks inputs:</strong> Angular stores the previous value in LView.
        During CD it compares <code>lView[bindingIndex] === newValue</code> (reference equality, <code>===</code>).
        Mutating an object changes its contents but not its identity — Angular sees the same reference
        and skips the component.
      </div>

      <div class="two-col" style="margin-bottom:1rem">
        <!-- MUTATION (broken) -->
        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> Mutation — broken
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeMutation }}</pre>
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              The array reference never changes → OnPush child is never dirty → view stays stale.
            </p>
            <div class="btn-row">
              <p-button label="Push a car (mutation)" size="small" severity="danger" (onClick)="pushCar()" />
              <p-button label="Reset" size="small" severity="secondary" (onClick)="resetMutable()" />
            </div>
            <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">
              Parent array length: <strong>{{ mutableCars.length }}</strong>
              (child shows: still <strong>{{ mutableCars.length - addedMutable }}</strong>)
            </div>
            <app-car-list [cars]="mutableCars" />
          </div>
        </div>

        <!-- IMMUTABLE (fixed) -->
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> New reference — correct
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeImmutable }}</pre>
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              Each add creates a new array → new reference → OnPush detects the change → re-renders.
            </p>
            <div class="btn-row">
              <p-button label="Add a car (spread)" size="small" severity="success" (onClick)="addCar()" />
              <p-button label="Reset" size="small" severity="secondary" (onClick)="resetImmutable()" />
            </div>
            <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">
              Parent array length: <strong>{{ immutableCars().length }}</strong>
            </div>
            <app-car-list [cars]="immutableCars()" />
          </div>
        </div>
      </div>

      <!-- WHY mutation appears to work — Default strategy comparison -->
      <div class="section-label">Why mutation can appear to work — Default strategy</div>

      <div class="info-box" style="margin-bottom:1rem">
        A child without <code>ChangeDetectionStrategy.OnPush</code> uses <strong>Default strategy</strong>:
        it is re-checked on <em>every</em> <code>AppRef.tick()</code>, regardless of whether its inputs changed.
        So mutation works there — but only because CD visits the component unconditionally.
        This is expensive and hides the bug until you add OnPush.
      </div>

      <div class="two-col" style="margin-bottom:1rem">
        <div class="demo-card">
          <div class="demo-card-header fixed">
            <i class="pi pi-check-circle"></i> Mutation + Default strategy — works
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeDefaultWorks }}</pre>
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              Default child is re-checked on every tick — it reads the mutated array directly
              and always shows the current length.
            </p>
            <div class="btn-row">
              <p-button label="Push a car (mutation)" size="small" severity="success" (onClick)="pushCarDefault()" />
              <p-button label="Reset" size="small" severity="secondary" (onClick)="resetDefault()" />
            </div>
            <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">
              Parent array length: <strong>{{ defaultCars.length }}</strong>
            </div>
            <app-car-list-default [cars]="defaultCars" />
          </div>
        </div>

        <div class="demo-card">
          <div class="demo-card-header broken">
            <i class="pi pi-times-circle"></i> Same mutation + OnPush — broken
          </div>
          <div class="demo-card-body">
            <pre class="code-block">{{ codeOnPushBroken }}</pre>
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.75rem">
              Exact same <code>push()</code> call, but the child uses OnPush.
              Same reference → skipped → child stays stale.
            </p>
            <div class="btn-row">
              <p-button label="Push a car (mutation)" size="small" severity="danger" (onClick)="pushCarOnPush()" />
              <p-button label="Reset" size="small" severity="secondary" (onClick)="resetOnPushMutable()" />
            </div>
            <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b">
              Parent array length: <strong>{{ onPushMutableCars.length }}</strong>
              (child shows: still <strong>{{ onPushMutableCars.length - addedOnPush }}</strong>)
            </div>
            <app-car-list [cars]="onPushMutableCars" />
          </div>
        </div>
      </div>

      <div class="warning-box" style="margin-bottom:1rem">
        <strong>The hidden danger:</strong> If you develop with Default strategy children and later
        add <code>ChangeDetectionStrategy.OnPush</code> (or a library uses it internally),
        mutation bugs silently appear. Always pass new references to be safe.
      </div>

      <div class="demo-card">
        <div class="demo-card-header neutral"><i class="pi pi-book"></i> The same principle for objects</div>
        <div class="demo-card-body">
          <pre class="code-block">{{ codeObjects }}</pre>
          <div class="warning-box">
            <strong>Mutation is a silent killer with OnPush.</strong> The template may look correct in
            Zone.js mode with Default strategy (because every tick re-checks), but switching to
            OnPush or zoneless exposes the bug. Always produce a new reference when changing
            the contents of an <code>@Input()</code> array or object.
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImmutabilityComponent {
  // Mutable side — same array reference mutated with push()
  mutableCars: Car[] = [
    { id: 1, make: 'Tesla', model: 'Model 3' },
    { id: 2, make: 'BMW',   model: 'M4' },
  ];
  addedMutable = 0;
  private nextMutableId = 3;

  pushCar() {
    this.mutableCars.push({ id: this.nextMutableId++, make: 'Audi', model: 'A4' });
    this.addedMutable++;
    // Reference is the same → Angular's === check passes → OnPush child skipped
  }

  resetMutable() {
    this.mutableCars = [
      { id: 1, make: 'Tesla', model: 'Model 3' },
      { id: 2, make: 'BMW',   model: 'M4' },
    ];
    this.addedMutable = 0;
    this.nextMutableId = 3;
  }

  // Immutable side — spread creates a new array each time
  immutableCars = signal<Car[]>([
    { id: 1, make: 'Tesla', model: 'Model 3' },
    { id: 2, make: 'BMW',   model: 'M4' },
  ]);
  private nextImmutableId = 3;

  addCar() {
    this.immutableCars.update(cars => [
      ...cars,
      { id: this.nextImmutableId++, make: 'Audi', model: 'A4' }
    ]);
    // New array reference → Angular detects change → OnPush child re-renders
  }

  resetImmutable() {
    this.immutableCars.set([
      { id: 1, make: 'Tesla', model: 'Model 3' },
      { id: 2, make: 'BMW',   model: 'M4' },
    ]);
    this.nextImmutableId = 3;
  }

  // Default strategy comparison — shared push() call
  defaultCars: Car[] = [
    { id: 1, make: 'Tesla', model: 'Model 3' },
    { id: 2, make: 'BMW',   model: 'M4' },
  ];
  private nextDefaultId = 3;

  pushCarDefault() {
    this.defaultCars.push({ id: this.nextDefaultId++, make: 'Audi', model: 'A4' });
    // Same reference, but Default child is re-checked every tick → it sees the mutated array
  }

  resetDefault() {
    this.defaultCars = [
      { id: 1, make: 'Tesla', model: 'Model 3' },
      { id: 2, make: 'BMW',   model: 'M4' },
    ];
    this.nextDefaultId = 3;
  }

  // OnPush comparison — same push() but child uses OnPush
  onPushMutableCars: Car[] = [
    { id: 1, make: 'Tesla', model: 'Model 3' },
    { id: 2, make: 'BMW',   model: 'M4' },
  ];
  addedOnPush = 0;
  private nextOnPushId = 3;

  pushCarOnPush() {
    this.onPushMutableCars.push({ id: this.nextOnPushId++, make: 'Audi', model: 'A4' });
    this.addedOnPush++;
  }

  resetOnPushMutable() {
    this.onPushMutableCars = [
      { id: 1, make: 'Tesla', model: 'Model 3' },
      { id: 2, make: 'BMW',   model: 'M4' },
    ];
    this.addedOnPush = 0;
    this.nextOnPushId = 3;
  }

  readonly codeDefaultWorks = `// Default strategy child — no OnPush
@Component({ /* no changeDetection */ })
class CarListDefaultComponent {
  @Input() cars: Car[] = [];
}

// Parent mutates the array
this.cars.push(newCar);
// Angular re-checks Default child on every tick
// → it reads cars.length directly → always correct ✓
// (but expensive — checked even when nothing changed)`;

  readonly codeOnPushBroken = `// OnPush child
@Component({ changeDetection: OnPush })
class CarListComponent {
  @Input() cars: Car[] = [];
}

// Parent does the exact same mutation
this.cars.push(newCar);
// Angular: lView[idx] === this.cars  → true (same ref)
// OnPush child: not dirty → skipped → stale ✗`;

  readonly codeMutation = `// ✗ Mutation — same reference
this.cars.push(newCar);
// Angular: lView[idx] === this.cars  → true (same object)
// OnPush child: not dirty → skipped`;

  readonly codeImmutable = `// ✓ New reference — spread operator
this.cars = [...this.cars, newCar];
// Angular: lView[idx] === this.cars  → false (new array)
// OnPush child: input changed → re-renders`;

  readonly codeObjects = `// ✗ Object mutation — still the same reference
this.car.speed = 300;
this.car.name = 'Updated';

// ✓ New object — spread
this.car = { ...this.car, speed: 300, name: 'Updated' };

// ✓ With signals — update() ensures new reference
this.car.update(c => ({ ...c, speed: 300 }));`;
}
