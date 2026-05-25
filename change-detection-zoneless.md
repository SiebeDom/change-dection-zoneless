# Angular Change Detection & Zoneless

## Goal

This document explains Angular change detection from first principles, builds up to OnPush strategy and zoneless architecture, and makes the case for adopting zoneless in a team.

---

## 1. A Brief History: From Page Refreshes to SPAs

In the early web, every action that needed fresh data triggered a full page reload. The server rendered a new HTML page and sent it to the browser. Simple, but slow, and it destroyed any sense of continuity.

**Single Page Applications (SPAs)** changed this model. The browser downloads one HTML shell and a JavaScript bundle. After that, JavaScript updates the DOM directly — no full reloads. Angular, React, and Vue are all SPAs.

This shift introduced a new challenge: **how does the framework know when the DOM needs to be updated?** That question is what change detection answers.

---

## 2. How Angular Renders Your App

Angular compiles your application — templates and TypeScript — into pure JavaScript.

The **Angular compiler** transforms your templates (HTML with bindings, directives, pipes, control flow) into TypeScript instructions. The **TypeScript compiler** then converts everything to JavaScript. The result is a JavaScript bundle the browser can run.

When the browser loads the app, Angular bootstraps the root component and walks the component tree, calling DOM APIs (`document.createElement`, `element.setAttribute`, etc.) to build the initial DOM. This first render is relatively expensive.

After that first render, Angular does not rebuild the DOM from scratch on every change. Instead, it runs **change detection**: a targeted process that finds what changed in component state and updates only the affected bindings. Angular updates the *values* of existing DOM nodes — it does not replace the nodes themselves. Structural directives (`*ngFor`, `@for`, `*ngIf`) are the exception: they add and remove DOM nodes when the collection or condition changes.

### The two binding syntaxes

There are two ways to bind data from a component to its template.

**String interpolation `{{ }}`** — wraps an expression in double curly braces. The result is always coerced to a string and inserted as text content inside the element. Use it for displaying values as readable text.

```html
<p>{{ car.name }}</p>
<span>Speed: {{ car.topSpeed }} km/h</span>
```

**Property binding `[property]="expression"`** — wraps the target in square brackets. Angular evaluates the expression and sets it directly on the **DOM property** (not the HTML attribute). The value keeps its original type — booleans, numbers, objects are passed as-is.

```html
<button [disabled]="isLoading">Save</button>
<img [src]="imageUrl">
<app-car-detail [car]="selectedCar">  <!-- component @Input() -->
```

**Key differences:**

| Aspect | `{{ expression }}` | `[property]="expression"` |
|---|---|---|
| Output type | Always a string | Preserves original type |
| Where it works | Text content inside elements | DOM properties and `@Input()` bindings |
| Compiler instruction | `ɵɵtextInterpolate` | `ɵɵproperty` |

A practical consequence of type preservation: `[disabled]="false"` correctly removes the disabled state. The interpolation alternative `disabled="{{ false }}"` would pass the string `"false"`, which is truthy and would keep the button disabled.

For HTML attributes that have no corresponding DOM property (such as `aria-*` and `data-*`), use attribute binding: `[attr.aria-label]="description"`.

Both syntaxes create a slot in the LView and are checked the same way during every CD cycle.

---

### How Angular knows what changed: LView

For each component, Angular maintains a flat array called the **LView** (Logical View). It stores the *last-written value* for every template binding in that component.

When the compiler sees a template like this:

```html
<p>{{ car.name }}</p>
<button [disabled]="isLoading">Save</button>
```

It generates change detection instructions that, during each CD cycle, do roughly this:

1. Evaluate `car.name` → current value is `"Tesla"`
2. Look up the stored value in LView → was `"BMW"`
3. Values differ → update the DOM text node, write `"Tesla"` into LView
4. Evaluate `isLoading` → current value is `false`
5. Look up stored value in LView → also `false`
6. Values match → skip the DOM update entirely

The LView is Angular's record of **what it last wrote to the DOM**. Change detection is simply: evaluate each binding, compare to LView, update the DOM and LView only on a mismatch.

This is not the same as React's Virtual DOM. React builds a new shadow tree on every render and diffs the whole tree. Angular has no shadow tree — the compiler generates precise, targeted instructions at build time for exactly which bindings to check and where they sit in the DOM.

The Angular Compiler Output tool makes this visible — you can see the generated `ɵɵproperty` and `ɵɵtextInterpolate` calls and the slot indices into the LView array:
[https://jeanmeche.github.io/angular-compiler-output/](https://jeanmeche.github.io/angular-compiler-output/) ([source](https://github.com/JeanMeche/angular-compiler-output))

### TView vs LView

Every component has two companion data structures:

**TView** (Template View) — static, shared between all instances of the same component. Think of it as the class definition. It describes the shape: which index in LView holds which DOM node, how many bindings there are, where directives live.

**LView** (Logical View) — per-instance, the actual flat array. Think of it as the object instance. Stores live state: DOM node references, directive instances, the last-rendered value for each binding.

DOM nodes are stored as **direct JavaScript object references**, not as string IDs. The index is fixed at compile time. `lView[domNodeIndex]` IS the actual DOM node — no lookup needed. When Angular needs to update the DOM, it reads the node reference from LView and calls `renderer.setValue(lView[domNodeIndex], newValue)` directly.

### Template functions and `ctx`

The Angular compiler turns each component template into a **template function**. This is what `ɵɵtextInterpolate1` and friends actually live in:

```javascript
function MyComponent_Template(rf, ctx) {
  if (rf & 1) {             // RenderFlags.Create — runs once on first render
    ɵɵtext(0);              // create text node, store reference in lView
  }
  if (rf & 2) {             // RenderFlags.Update — runs on every CD cycle
    ɵɵtextInterpolate1(
      ' And this is a dynamic text node: ',
      ctx.test              // ctx = the component class instance
    );
  }
}
```

`ctx` is the component class instance — what you call `this` inside the class. Angular passes `lView[CONTEXT]` (index 3 in LView) as the second argument when calling the template function. So `ctx.test` is exactly `this.test` from the class.

### RenderFlags bitmask (`rf & 1`, `rf & 2`)

`rf` is a `RenderFlags` enum:

```typescript
enum RenderFlags {
  Create = 0b01,  // decimal 1
  Update = 0b10,  // decimal 2
}
```

`rf & 1` asks: "is the Create bit set?" `rf & 2` asks: "is the Update bit set?"

**Why a bitmask instead of a simple boolean or string check?**

Bitwise AND (`&`) is a single machine instruction — the fastest possible conditional check. Template functions are called on every change detection cycle across potentially thousands of components. The bitmask means one function serves both creation and update, avoiding the overhead of two separate function definitions. It also allows Angular to theoretically pass both flags simultaneously (`rf = 3`) when it wants a component to run both phases in one call.

---

## 3. Change Detection: The Core Concept

Change detection answers: *"Has anything in my component state changed that would affect what the user sees?"*

Angular's change detection always runs **top to bottom** through the component tree. This is a deliberate design decision: a bidirectional or bottom-up approach would risk infinite loops and make the system very hard to reason about. You cannot tell Angular to run change detection only on a single isolated component — it always starts from the root.

The method that kicks off a full top-to-bottom cycle is **`AppRef.tick()`**. Everything else in change detection is about *when* `AppRef.tick()` is called and *which components* are checked during a cycle.

---

## 4. Zone.js: The Original Scheduler

In the classic Angular setup, **Zone.js** is responsible for calling `AppRef.tick()`.

Zone.js works by **monkey-patching** browser APIs. It replaces the native implementations of:
- DOM event listeners (`click`, `input`, `submit`, ...)
- Async APIs (`setTimeout`, `setInterval`, `Promise.then`, `fetch`, `XMLHttpRequest`, ...)

with wrapper functions. These wrappers do the same work as the originals, but they also notify Angular when they complete. Angular responds by calling `AppRef.tick()`.

The result: any click handler, HTTP response, or timer automatically triggers a full change detection cycle. Zero effort from the developer.

**The downsides:**
- Zone.js is a significant dependency.
- The wrappers add overhead to every async operation.
- Call stacks become deep and full of `zone.js` frames — harder to read when debugging.
- Code that should *not* trigger change detection (chart libraries, animations) must be explicitly moved outside the zone using `NgZone.runOutsideAngular()`.

### Why Zone.js lives in polyfills, not a regular import

Zone.js is just an npm library (`zone.js`). The reason it is placed in the `polyfills` entry of `angular.json` — rather than imported as a regular module — is purely **load order**.

Zone.js patches global browser APIs before anything else runs:

```
window.setTimeout         → Zone.js wrapper
window.Promise            → Zone.js wrapper
EventTarget.addEventListener → Zone.js wrapper
```

If any other code loads first and captures a reference to the native API, Zone.js's patches are bypassed for that code:

```typescript
// A library loads before Zone.js and saves the native reference:
const nativeSetTimeout = window.setTimeout;

// Zone.js then patches window.setTimeout —
// but this library still holds the original, unwrapped function.
```

The `polyfills` entry tells Angular CLI: *"bundle and execute this before the main application bundle starts."* It is not a statement about Zone.js being a browser standard polyfill — it is about guaranteeing Zone.js runs before the module graph itself (which uses Promises, timers, etc.) begins executing.

In Angular 12+, placing `import 'zone.js'` as the very first line of `polyfills.ts` achieves the same effect. In zoneless Angular, Zone.js is removed entirely — no load-order concern needed.

---

## 5. Change Detection Strategies

### Default

Every component is `ChangeDetectionStrategy.Default` unless you specify otherwise. During every `AppRef.tick()` cycle, Angular checks the component — regardless of whether its inputs changed. In a large tree this means many components are checked even when nothing relevant to them has changed.

### OnPush

`ChangeDetectionStrategy.OnPush` tells Angular: *"Only check this component if one of these conditions is true:"*

1. An **input reference** changed (a new object or array was passed, not a mutation of the existing one).
2. An **event inside this component's template** fired (a click, etc.).
3. An **Observable** linked via the `async` pipe emitted a new value.
4. `markForCheck()` was called on this component.
5. A **signal** read in the template changed.

#### OnPush as a shield for subtrees

An OnPush component that is not marked dirty acts as a **shield for its entire subtree**. Even if a descendant uses the Default strategy, it will not be checked if an OnPush ancestor was skipped. This explains why, in the JeanMeche visualizer, some Default-strategy components in the bottom of a branch are not checked: they sit behind an OnPush ancestor that was not triggered.

#### Immutability and OnPush

Condition 1 is the most common source of OnPush bugs. If you have `@Input() cars: Car[]` and mutate the array with `this.cars.push(newCar)`, the **reference** is unchanged — Angular sees the same object and skips the component. You must return a new reference:

```typescript
// Wrong — mutates the existing array, reference unchanged
this.cars.push(newCar);

// Correct — new reference, OnPush component updates
this.cars = [...this.cars, newCar];
```

This is the principle of **immutability**: instead of mutating an existing object, produce a new object with the changed values. Immutability matters beyond Angular too — immutable data can be safely shared across threads and workers without race conditions, and equality checks reduce to a single reference comparison instead of a deep object comparison. Deborah Kurata covers this well (see Resources).

---

## 6. Manual Change Detection Control

### The three actors — a mental model

Before comparing the methods, it helps to see them as completely separate things:

```
markForCheck()       →  only sets a dirty flag. Does nothing else.
AppRef.tick()        →  the actual CD run. Walks the tree top-to-bottom.
Zone.js / scheduler  →  the trigger that calls AppRef.tick().
```

`markForCheck()` and `AppRef.tick()` never call each other. They need a third party to connect them.

> **Analogy:** `markForCheck()` = raise your hand. `AppRef.tick()` = teacher does roll call. Zone.js / scheduler = the bell that starts roll call. Raising your hand before the bell rings does nothing until the bell rings.

---

### Why does `markForCheck()` exist? — batching

`markForCheck()` exists as a **performance optimisation**. Instead of updating the DOM the moment any state changes, Angular collects all dirty components first and updates them in one pass.

Without batching, every state change would force an immediate DOM update:
```
signal A changes → DOM update
signal B changes → DOM update
signal C changes → DOM update
```

With `markForCheck()` batching, all three changes collapse into one cycle:
```
signal A changes → mark dirty
signal B changes → mark dirty (already dirty, no-op)
signal C changes → mark dirty (already dirty, no-op)
→ one AppRef.tick() → one DOM update
```

The DOM is expensive. Batching avoids layout thrashing and unnecessary repaints.

---

### Can there be race conditions?

JavaScript is single-threaded, so there are no true race conditions between `markForCheck()` and a CD cycle — they cannot literally run at the same time.

What can happen instead is `ExpressionChangedAfterItHasBeenChecked`.

### ExpressionChangedAfterItHasBeenChecked

Angular [NG0100](https://angular.dev/errors/NG0100) — development mode only.

After every CD cycle, Angular runs a **second pass** in dev mode and re-evaluates all bindings. If any binding value differs from what was just written to the DOM, it throws. This catches side effects: something rendered, and as a result of rendering, state changed — which means the view is already stale.

**Practical example — lifecycle hook trap:**

```typescript
@Component({
  template: `<child [label]="headerText"></child>`
})
class ParentComponent implements AfterViewInit {
  headerText = 'Loading...';

  ngAfterViewInit() {
    this.headerText = 'Done!'; // triggers the error
  }
}
```

Timeline:
1. CD runs on parent → evaluates `headerText = 'Loading...'` → passes to child
2. Child renders
3. `ngAfterViewInit` fires (Angular calls it *after* all children have rendered)
4. `headerText` is now `'Done!'`
5. **Dev-mode second pass** re-evaluates `headerText` → sees `'Done!'` ≠ `'Loading...'` → **throws**

The fix: don't mutate template-bound state in `ngAfterViewInit`. Derive it with `computed()` or move the logic to `ngOnInit`.

**Why it happened more with observables:**

`BehaviorSubject` and `shareReplay(1)` emit **synchronously** on subscription. If you subscribed in `ngOnInit` (which runs during CD) or used the `async` pipe on a synchronously-emitting source, the emission mutated state mid-cycle:

```typescript
ngOnInit() {
  // BehaviorSubject emits the current value synchronously here,
  // inside the CD cycle that's already running
  this.dataService.value$.subscribe(v => this.displayValue = v);
}
```

**Why signals don't have this error:**

Signals are reactive — Angular tracks which template reads which signal. When a signal changes, Angular marks that specific binding as stale. There is no "re-evaluate everything after the fact" second pass. The model is: "I know exactly what changed." More practically, signals encourage deriving state with `computed()` rather than syncing it in lifecycle hooks, removing the primary trigger for this error.

Also see: [Angular docs on NG0100](https://angular.dev/errors/NG0100)

---

### `markForCheck()` vs `detectChanges()`

| Property | `markForCheck()` | `detectChanges()` |
|---|---|---|
| **What it does** | Sets a dirty flag on this component and all ancestors | Runs a CD cycle synchronously on this component's subtree |
| **Scope** | Cooperates with the next global `AppRef.tick()` | Local subtree only, bypasses the global cycle |
| **Timing** | Async — at the next scheduled CD cycle | Sync — immediately, DOM updated before next line of code |
| **Traversal direction** | Upward (marks ancestors) | Downward (checks this component + all descendants) |
| **Respects OnPush?** | Yes — sets the dirty flag that OnPush checks | No — checks the subtree regardless of strategy |
| **Preferred?** | Yes | Rarely — testing or when an immediate local DOM update is unavoidable |
| **Docs** | [ChangeDetectorRef#markForCheck](https://angular.dev/api/core/ChangeDetectorRef#markForCheck) | [ChangeDetectorRef#detectChanges](https://angular.dev/api/core/ChangeDetectorRef#detectChanges) |

#### Apparent conflict: "CD always starts from top" vs `detectChanges()`

The rule "CD always starts from the root" applies to `AppRef.tick()` — the global cycle triggered by Zone.js or the scheduler. `detectChanges()` is an explicit **escape hatch** that runs *local* change detection on a subtree, starting from the called component downward, with no involvement of the root.

These are two distinct mechanisms:
- `AppRef.tick()` — global, top-down, triggered by the scheduler
- `detectChanges()` — local, starts at the component, goes down only

In zoneless Angular, local CD is actually the **preferred** model — signals naturally produce local updates without a global cycle. `detectChanges()` is that same concept surfaced as a manual API. The old "CD must start from top" rule was a consequence of Zone.js's global approach, not a fundamental constraint of Angular.

#### Seeing the difference in the JeanMeche demo

In the demo, uncheck Zone.js first (to remove the automatic CD trigger). Then:

- Press **detectChanges** on a component — the subtree below it re-renders immediately, even though no global cycle ran.
- Press **markForCheck** on a component — nothing visible happens. The flag is set but no cycle fires. Only when you re-enable Zone.js or trigger a click does the view update.

This is the clearest way to see that `markForCheck()` is just a flag and nothing more.

---

### What triggers CD for RxJS observables and Subjects in Zone.js world?

RxJS has no built-in Angular integration. A `Subject.next()` call by itself does nothing for change detection. What matters is *where and how* the observable emits.

**If the emission happens inside a Zone.js-patched async callback** — the emission is already "inside the zone." Zone.js will trigger `AppRef.tick()` after the callback completes:

```
setTimeout(() => subject.next('value'), 1000)
// Zone.js patched setTimeout → emission happens inside zone → tick fires after
```

**If the emission happens outside the zone** (e.g., `NgZone.runOutsideAngular(...)` or a third-party library that captured native APIs before Zone.js loaded) — Zone.js doesn't see it and no tick fires:

```typescript
this.ngZone.runOutsideAngular(() => {
  setInterval(() => this.subject.next(Date.now()), 100);
  // NO CD triggered — explicitly outside zone
});
```

**For `async` pipe** specifically: `async` pipe subscribes to the observable and calls `markForCheck()` every time it emits. Then Zone.js (triggered by whatever caused the emission) fires `AppRef.tick()`. The `markForCheck()` ensures the OnPush component is not skipped during that cycle.

**For Default strategy components**: Zone.js fires a full `AppRef.tick()` on any async event, checking all Default components unconditionally. No `markForCheck()` needed.

**Summary**:

| Scenario | CD triggered? | How? |
|---|---|---|
| Subject.next() in click handler | Yes | Zone.js intercepts click event, fires tick after handler |
| Subject.next() in setTimeout | Yes | Zone.js intercepts setTimeout callback |
| Subject.next() in HTTP callback (XHR) | Yes | Zone.js intercepts XHR callback |
| Subject.next() in runOutsideAngular | No | Emission bypasses zone |
| async pipe subscribes to observable | Yes (if in zone) | async pipe calls markForCheck() + Zone.js fires tick |

### The click event — precise flow

**With Zone.js (OnPush component):**

```
1. User clicks — Zone.js intercepts (addEventListener was patched)
2. Angular's event binding calls markForCheck() on the component
   → sets LViewFlags.Dirty on the component and all ancestors
3. Click handler runs synchronously (your code)
4. Handler returns — all synchronous code is done
5. Promises/microtasks from the handler drain (microtask queue empties)
6. Zone.js: microtask queue is empty → fires NgZone.onMicrotaskEmpty
   → AppRef.tick() runs
7. top-down CD cycle — sees dirty flags → re-checks those components
```

Key insight: Zone.js does not trigger `tick()` immediately when the click fires. It waits until **all async operations spawned by that task have completed**. If the click handler starts an HTTP request, Zone.js tracks the open XHR and defers `onMicrotaskEmpty` until the response arrives. This is the Zone.js "safety net" — you never get a half-loaded view rendered before the data arrives.

**With Zoneless:**

```
1. User clicks — Angular's own event listener fires (no Zone.js wrapping)
2. Angular's event binding calls markForCheck()
   → sets dirty flag AND notifies ChangeDetectionScheduler
   → scheduler queues a microtask (Promise.resolve())
3. Click handler runs synchronously
4. Handler returns
5. Microtask fires → AppRef.tick() runs → CD cycle
```

In zoneless, `tick()` fires after the current synchronous execution, NOT after all outstanding HTTP requests. If you start an HTTP request in the click handler, the first CD cycle runs before the response arrives. When the response arrives, you need a signal or `markForCheck()` to schedule a second cycle. There is no automatic Zone.js safety net.

This is simpler and more explicit: you always know exactly why CD runs. But it shifts responsibility to the developer — state that drives the view must use signals or explicit scheduling.

### HTTP Observables and change detection — the full picture

Imagine a component with OnPush and an HTTP call using plain `HttpClient` — no signals, no `httpResource`.

#### Zone-based app

Zone.js patches `XMLHttpRequest`. When the HTTP response arrives, Zone.js intercepts the XHR callback and calls `AppRef.tick()` after your subscription runs. The flow:

```
HTTP response arrives
→ Zone.js intercepts the XHR callback
  → subscription runs: this.cars = result
  → markForCheck()          ← marks the component dirty
← Zone.js: async op done → AppRef.tick()
  → CD cycle runs
  → component is dirty → re-renders ✓
```

`markForCheck()` is needed here so the OnPush component is not skipped during the cycle Zone.js triggers. Without it, the cycle runs but skips the component.

#### Zoneless app — the stale screen problem

In zoneless, Zone.js is gone. Nothing patches XHR. The flow becomes:

```
1. User clicks button
   → Angular's event listener fires
   → schedules AppRef.tick() as a microtask

2. Click handler runs → HTTP request sent → handler returns

3. Microtask fires → AppRef.tick() runs
   → HTTP hasn't returned yet → view renders with empty data (correct so far)

4. HTTP response arrives
   → subscription runs: this.cars = result
   → plain property assignment, no signal
   → nothing notifies the scheduler
   → no AppRef.tick() scheduled
   → screen stays stale ✗
```

#### The fix options

**Option 1 — signal (zoneless-native):**
```typescript
cars = signal<Car[]>([]);

load() {
  this.http.get<Car[]>('/api/cars').subscribe(result => {
    this.cars.set(result);  // signal notifies scheduler → AppRef.tick() scheduled
  });
}
```

**Option 2 — `toSignal()` (cleaner):**
```typescript
cars = toSignal(this.http.get<Car[]>('/api/cars'), { initialValue: [] });
// no subscribe, no markForCheck, scheduler handles everything
```

**Option 3 — `markForCheck()` (works, but has a caveat):**
```typescript
this.http.get<Car[]>('/api/cars').subscribe(result => {
  this.cars = result;
  this.cdr.markForCheck();
  // in zoneless: Angular's scheduler queues a microtask → AppRef.tick() runs shortly after
});
```

The caveat: there is a microtask-length gap between the HTTP response arriving and the view updating. In practice this is imperceptible. But more importantly, this keeps you on observables and manual wiring — the other options are cleaner.

**Option 4 — `httpResource` (preferred for zoneless):**
```typescript
carsResource = httpResource<Car[]>('/api/cars');

// in template:
// carsResource.value()     — the data (signal)
// carsResource.isLoading() — loading state (signal)
// carsResource.error()     — error state (signal)
```

`httpResource` is Angular's signal-native HTTP primitive (Angular 19+). It wraps `HttpClient` in a resource, exposes loading/error/data as signals, and requires no manual subscription management or `markForCheck()`. It is the preferred approach in a zoneless app.

---

### The Router in zoneless

Angular's Router handles the framework side correctly in zoneless. `RouterOutlet` calls `markForCheck()` internally when swapping the activated component, and `routerLinkActive` is wired to the scheduler. Navigation itself does not require any extra work.

The risk is **developer code that subscribes to Router observables** — the same problem as any RxJS subscription:

```typescript
// ✗ Broken in zoneless — subscribe mutates plain property, no CD scheduled
constructor(private route: ActivatedRoute) {
  this.route.queryParams.subscribe(params => {
    this.selectedId = params['id'];   // plain property → no scheduler notification
  });

  this.router.events
    .pipe(filter(e => e instanceof NavigationEnd))
    .subscribe(e => {
      this.lastUrl = (e as NavigationEnd).url; // plain property → broken
    });
}

// ✓ Fixed — toSignal bridges the Observable to the scheduler
private readonly params   = toSignal(this.route.queryParams, { initialValue: {} });
readonly selectedId       = computed(() => this.params()['id'] ?? 'none');

// ✓ Also fine — snapshot for one-time reads (synchronous, no observable)
ngOnInit() {
  this.selectedId = this.route.snapshot.queryParams['id'];
}
```

Angular 17+ introduced `withComponentInputBinding()` in the router config. With it, route params and query params flow directly into `@Input()` fields — no subscribe, no `toSignal()`, no lifecycle hook needed:

```typescript
// app.config.ts
provideRouter(routes, withComponentInputBinding())

// component.ts
@Input() id = '';   // Angular maps ?id=42 → this.id = '42' automatically
```

---

### `firstValueFrom` + `async/await` for write operations

This is the most commonly overlooked zoneless risk because it looks safe but isn't. The pattern is widespread for POST/PUT/DELETE operations.

```typescript
async onSave() {
  this.isSaving = true;          // ✓ synchronous, inside click handler → CD scheduled

  const result = await firstValueFrom(   // ← suspends here
    this.http.post<Order>('/api/orders', this.form.value)
  );

  // Everything below runs AFTER the HTTP response arrives (new macrotask)
  this.savedOrder = result;       // ✗ plain property — no CD scheduled
  this.isSaving   = false;        // ✗ spinner never disappears
  this.success    = 'Saved!';     // ✗ never shows in the template
}
```

`this.isSaving = true` works because it runs synchronously within the click handler, and Angular's event binding schedules a CD microtask before the handler returns. Everything after the `await` runs when the HTTP response arrives — a separate macrotask — with no Zone.js to call `tick()` afterward.

**Fix 1 — signals (preferred):**
```typescript
isSaving    = signal(false);
savedOrder  = signal<Order | null>(null);
errorMsg    = signal('');

async onSave() {
  this.isSaving.set(true);
  try {
    this.savedOrder.set(
      await firstValueFrom(this.http.post<Order>('/api/orders', this.form.value))
    );
  } catch (e: any) {
    this.errorMsg.set(e.message);
  } finally {
    this.isSaving.set(false);   // signal update → scheduler notified → CD runs
  }
}
```

**Fix 2 — `markForCheck()` in `finally` (pragmatic migration path):**
```typescript
async onSave() {
  this.isSaving = true;
  try {
    this.savedOrder = await firstValueFrom(this.http.post('/api/orders', this.form.value));
  } catch (e: any) {
    this.errorMsg = e.message;
  } finally {
    this.isSaving = false;
    this.cdr.markForCheck();   // one call covers all mutations above
  }
}
```

The `finally` + `markForCheck()` pattern is a practical migration step: one line per write operation, and you can refactor to signals incrementally. Any uncaught error still leaves the view stale without `finally`, so always use `finally` rather than a trailing `markForCheck()` after the `await`.

---

### Angular APIs that are still RxJS-based — zoneless audit

| API | Risk in zoneless | Safe approach |
|---|---|---|
| `ActivatedRoute.params` / `.queryParams` / `.data` / `.url` | ✗ subscribe → broken | `toSignal()`, `.snapshot`, or `withComponentInputBinding()` |
| `Router.events` | ✗ subscribe → broken | `toSignal()` or avoid |
| `FormControl.valueChanges` / `statusChanges` | ✗ subscribe → broken | `toSignal()` or `markForCheck()` in subscribe |
| `QueryList.changes` (`@ViewChildren`, `@ContentChildren`) | ✗ subscribe → broken | `toSignal(this.items.changes)` |
| `HttpClient` reads | ✓ use `httpResource` | Signal-native, no subscribe needed |
| `HttpClient` writes (`firstValueFrom` + `await`) | ✗ post-`await` state | Signals or `markForCheck()` in `finally` |
| `AsyncPipe` | ✓ has `markForCheck()` built in | Works in both modes |
| `EventEmitter` (`@Output`) | ✓ Angular handles it | No action needed |
| `BreakpointObserver` (CDK) | ✗ subscribe → broken | `toSignal(breakpointObserver.observe(...))` |
| `FocusMonitor` (CDK) | ✗ subscribe → broken | `toSignal()` |
| `Title` / `Meta` service | ✓ synchronous | Fine |
| NgRx `store.select()` | ✗ subscribe → broken | `store.selectSignal()` (NgRx 16+) |

**`QueryList.changes`** is easy to miss — it fires when `@ViewChildren` or `@ContentChildren` results change:

```typescript
@ViewChildren(ItemComponent) items!: QueryList<ItemComponent>;

// ✗ Broken in zoneless
ngAfterViewInit() {
  this.items.changes.subscribe(() => {
    this.itemCount = this.items.length; // plain property
  });
}

// ✓ Fixed
readonly itemCount = toSignal(
  this.items.changes.pipe(startWith(null), map(() => this.items.length)),
  { initialValue: 0 }
);
```

**Audit grep pattern** — catches most subscribe-with-plain-property cases:
```
\.subscribe\(.*=>\s*\{?[^}]*this\.\w+\s*=
```
For `firstValueFrom` + `await`, search for `await firstValueFrom` and verify that all assignments after the `await` use signals or that `markForCheck()` appears in `finally`.

---

### `attach()` / `detach()`

`ChangeDetectorRef.detach()` removes a component from the CD tree entirely — Angular will never check it. `attach()` reattaches it. This is an escape hatch for components that manage their own rendering schedule (such as a chart rendering at 60fps). In the vast majority of applications you will never need this. The JeanMeche demo includes these to show the complete API surface — not because they are common.

---

## 7. Signals

Signals are Angular's built-in reactive primitive, introduced in Angular 16. A signal holds a value and notifies its consumers when that value changes.

```typescript
const count = signal(0);        // WritableSignal<number>
count.set(1);                   // set a new value directly
count.update(v => v + 1);       // derive new value from current value
```

Use **`set()`** when the new value is independent of the old one. Use **`update()`** when the new value is computed from the current value. For objects, `update()` is also the natural place to ensure immutability:

```typescript
// Wrong — mutates the existing object, reference unchanged
this.car.update(c => { c.mileage = 100; return c; });

// Correct — creates a new object
this.car.update(c => ({ ...c, mileage: 100 }));
```

### `computed()` vs `effect()` vs `afterRenderEffect()`

**`computed()`** is **synchronous and lazy**. It derives a new (read-only) signal from one or more source signals. The computation runs the first time the computed signal is read, and re-runs only when a dependency changes *and* the signal is read again. Reading a computed signal always returns an up-to-date value immediately.

**`effect()`** is **asynchronous** — it does not run inline when a signal changes. As of Angular 19, the timing depends on where the effect is created:

- **View effect** (created inside a component): runs **before** that component undergoes change detection in the current CD cycle.
- **Root effect** (created in a root-level service or `TestBed`): runs **before any component** is checked in the cycle.

In both cases the effect runs *during* the CD cycle, not at an arbitrary microtask checkpoint. The DOM has **not** been updated yet when a plain `effect()` runs. This makes `effect()` appropriate for logic side effects — logging, updating non-Angular state, calling external APIs. It is *not* appropriate for deriving values (use `computed()`) and *not* appropriate for reading or writing the DOM.

As of Angular 19, you no longer need `allowSignalWrites: true` — writing to signals inside an `effect()` is allowed by default.

**`afterRenderEffect()`** is the Angular 19+ replacement for DOM access inside effects. It runs **after** Angular has finished updating the DOM. Use it where you previously would have used `ngAfterViewInit` or `ngAfterViewChecked`:

| Old lifecycle hook | New signal API |
|---|---|
| `ngOnInit` / `ngOnChanges` | `effect()` |
| `ngAfterViewInit` / `ngAfterViewChecked` | `afterRenderEffect()` |

Use `afterRenderEffect()` for anything that reads or writes the DOM directly — measuring element dimensions, integrating a third-party chart library, triggering a CSS animation based on rendered state.

### Signals and the CD cycle

When a signal used in a template changes, Angular does three things:

1. Marks the component as a **dirty consumer** — it needs to be re-rendered.
2. Marks all ancestor components as **traversal** — they need to be visited to reach the dirty component, but they do not need to be fully re-checked themselves (unless they are also dirty consumers).
3. **Schedules a CD cycle** — it does not run change detection immediately.

This fine-grained marking is more efficient than `markForCheck()`, which marks ancestors as fully dirty rather than just traversal.

---

## 8. The Four Key Rules from the JeanMeche Demo

These four statements appear in the [JeanMeche change detection visualizer](https://jeanmeche.github.io/angular-change-detection/). Understanding all four means understanding Angular change detection.

---

> **"Event listeners in templates (like click) will mark the ancestors as dirty. This is why OnPush parents still run change detection on click."**

When a click event fires inside an OnPush component, Angular marks that component *and all its ancestors* as dirty — not just the component where the click happened. This is why an OnPush parent component gets re-checked after a click in a child, even if the parent received no new inputs.

---

> **"Mark for check won't fire a CD cycle; this is done by the scheduler (currently NgZone)."**

`markForCheck()` only sets a dirty flag. The actual CD cycle is triggered separately by the scheduler. In zone-based apps the scheduler is NgZone, which calls `AppRef.tick()` after async operations complete. When you see the view update after calling `markForCheck()`, it is because the click event (which Zone.js intercepted) also triggered the scheduler — `markForCheck()` just ensured the component was not skipped during that cycle.

---

> **"Signal updates won't fire a CD cycle; this is done by the scheduler (currently NgZone)."**

Same principle. Updating a signal marks components dirty but does not run CD inline. If the signal update happens inside a click handler, Zone.js fires the CD cycle after the handler completes. In a zoneless app, Angular's own scheduler fires it. Either way, the signal update and the CD cycle are separate steps.

---

> **"Signal updates will mark the component as a dirty consumer & all ancestors as traversal."**

This is the key insight. A signal update uses two distinct dirty flags:
- **Dirty consumer** on the component that reads the signal in its template — re-render this component.
- **Traversal** on all ancestors — visit these to reach the dirty component, but do not re-render them unless they are also dirty consumers.

This is what makes signals more efficient than `markForCheck()`: ancestors are visited but not fully re-checked.

---

### On the "dirty remains" question

After `AppRef.tick()` completes, dirty flags are **not** cleared. Two separate reasons explain what the visualizer shows:

**Default components show "dirty" permanently.** Default strategy maps internally to `CheckAlways` — these components are always checked on every cycle. Their dirty flag is their permanent state, not a temporary marker. It is never cleared because it does not need to be: Default components are checked unconditionally.

**OnPush dirty and `HasChildViewsToRefresh` persist after the tick.** Dirty flags for OnPush components are cleared at the **start** of the next CD cycle, not at the end of the current one. After `AppRef.tick()` finishes, the flags set during that cycle remain visible until a new cycle begins and resets them. This is expected — Angular preserves the post-cycle flag state so the scheduler can reason about what still needs work.

---

## 9. Zoneless Angular

Zoneless Angular removes Zone.js entirely. Angular manages the CD schedule itself, triggered by signals and framework events.

### What changes

- Zone.js no longer patches browser APIs.
- `AppRef.tick()` is called by Angular's own scheduler, not Zone.js.
- Click events still schedule CD cycles — Angular registers its own event listeners.
- Any state that drives the view **must** use signals (or explicit `markForCheck()`). There is no Zone.js safety net to catch missed updates.

### Observables in a zoneless app

Observables still work, but they no longer automatically trigger CD cycles. You have two options:

1. **`toSignal()`** — convert the Observable to a signal. Angular handles scheduling automatically.
2. **Manual `markForCheck()`** — call it in the subscription when a new value arrives.

The Angular team's recommendation is `toSignal()` wherever possible.

**Reactive Forms and Router** are still Observable-based internally, but the framework manages their CD scheduling. If you subscribe to form value changes yourself, use `toSignal()` or `markForCheck()`.

### The compatibility matrix

| Aspect | Zone.js (classic) | Zoneless |
|---|---|---|
| **Default CD** | Every event triggers a full top-to-bottom cycle automatically. | Angular's scheduler triggers cycles on signal changes and events. |
| **OnPush CD** | Events mark ancestors dirty; signals and `markForCheck()` mark components dirty. | Same rules — but no Zone.js safety net for missed mutations. |
| **Key requirement** | None. Zone.js catches all async operations. | All reactive state must use signals or explicit `markForCheck()`. |
| **Observables** | `async` pipe works automatically. | Use `toSignal()`, or call `markForCheck()` in subscriptions. |
| **Debugging** | Deep call stacks with many Zone.js frames. | Clean, short call stacks. |

---

## 10. Why Go Zoneless: Arguments for Your Team

**1. Smaller, cleaner call stacks.**
Without Zone.js wrapper layers, stack traces are shorter. Debugging is faster when the stack does not include dozens of `zone.js` frames.

**2. Easier profiling.**
The Chrome performance profiler shows less noise — CPU time is spent on your code, not Zone.js bookkeeping. CPU profiles and flame charts become meaningful.

**3. Simpler mental model.**
In a zoneless app you always know what triggers change detection: a signal changes, or an event fires. There are no surprise re-renders caused by a `setTimeout` you forgot about.

**4. Performance.**
Zone.js patches all async operations, even those unrelated to your view. Removing it reduces overhead. More importantly, fine-grained signal reactivity means Angular only re-checks components that actually consumed a changed signal, not the whole tree.

**5. It is where Angular is going.**
Zoneless is the Angular team's stated direction. Starting now builds familiarity with signals incrementally and reduces future migration work.

**6. Better AI tooling support.**
AI tools can be prompted to migrate components to signals, set OnPush on every component, and audit for immutability violations. Tasks that would take days manually become tractable with AI assistance via the Angular MCP tool.

---

## 11. Migration Strategy

A practical, incremental path to zoneless:

1. **Set OnPush on every component.** This forces you to find every place that relies on Default-strategy catch-all CD. Fix each one with signals, `async` pipe, or `markForCheck()`. AI tooling can automate this step.
2. **Replace Observables in templates with `toSignal()`.** Usually mechanical — AI tooling handles this well.
3. **Audit for immutability.** Find all mutations of `@Input()` objects and arrays and replace them with new-reference patterns. AI tooling can flag these.
4. **Audit subscriptions and async/await writes.** Grep for `\.subscribe(` and for `await firstValueFrom`. Any plain property mutation after either needs signals or `markForCheck()`. Pay particular attention to `ActivatedRoute.params/.queryParams`, `router.events`, and `QueryList.changes` subscriptions.
5. **Enable zoneless.** In `app.config.ts`, switch to `provideZonelessChangeDetection()` and remove `zone.js` from `polyfills`.
6. **Verify.** Walk through your app's key flows. Any view that fails to update is a place where a mutation slipped through steps 3–4.

---

## 12. Macrotasks, Microtasks, and the Event Loop

Angular's async behaviour is layered on the browser's task model.

### The event loop — what actually runs when

```
┌─────────────────────────────────────────────────────────┐
│  1. Execute next macrotask                              │
│     (e.g. "fire the click event" — includes all sync   │
│      code your handler calls)                           │
├─────────────────────────────────────────────────────────┤
│  2. Drain microtask queue completely                    │
│     (every Promise.then, queueMicrotask — all of them, │
│      including new ones added during this phase)        │
├─────────────────────────────────────────────────────────┤
│  3. Browser may render (requestAnimationFrame)          │
├─────────────────────────────────────────────────────────┤
│  4. Back to step 1 — next macrotask                    │
└─────────────────────────────────────────────────────────┘
```

**Macrotasks** — one per event loop turn:
- The currently executing script (a click handler, a timer callback, a network response callback)
- `setTimeout` / `setInterval` callbacks create new macrotasks
- Browser events (click, input, fetch response) each arrive as a macrotask

**Microtasks** — drain entirely after every macrotask:
- `Promise.then` / `async/await`
- `queueMicrotask()`

### Common misconception

> "Macrotask = synchronous code. Microtask = async code. Macrotasks have priority."

None of these are correct.

- **Synchronous code runs *inside* the current macrotask** — the click handler IS the macrotask. "Sync vs async" is not the same axis as "macrotask vs microtask."
- **`setTimeout(..., 0)` creates a macrotask** (queued for later). **`Promise.resolve().then(...)` creates a microtask** (runs before the next macrotask). Both are "async" in everyday language, but they live in different queues.
- **Microtasks drain between every macrotask** — they effectively have *higher* priority in the sense that they always run before the next macrotask starts. "Macrotask gets priority" is backwards.

### Where Angular fits in

Zone.js patches both queues:
- `Promise.then` (microtask) → Zone.js wrapper
- `setTimeout` (macrotask) → Zone.js wrapper

Zone.js fires `NgZone.onMicrotaskEmpty` at step 2 — after the macrotask finishes and all its Promises have resolved. This is why Zone.js's CD tick always runs after all async work from the triggering event is complete.

Angular's zoneless scheduler uses `queueMicrotask()` (or `Promise.resolve()`) to schedule CD cycles — this puts them at step 2 as well. Signal updates mark components dirty synchronously, then the microtask fires the actual CD pass.

*A visual diagram of the event loop with Angular's scheduling points would go well here.*

---

## 13. Demo Application

The demo app lives in `src/` and runs with `ng serve`. It uses PrimeNG 21 for components and is configured zoneless by default. A toggle in the top-right corner switches between `provideZonelessChangeDetection()` and `provideZoneChangeDetection()` by writing to `localStorage` and reloading — zone.js is always in `polyfills` but Angular only listens to it when the zone provider is active.

### Pages

| Route | What it demonstrates |
|---|---|
| `/home` | Overview, key concept summaries, resource links |
| `/interpolation` | `{{ }}` coerces to string; `[prop]` preserves type. The disabled-button trap. Compiled template output: `ctx`, `rf`, RenderFlags bitmask. |
| `/cd-triggers` | **Part A:** `setInterval` with plain property vs signal — switch to Zone.js mode to see the plain counter work. **Part B:** OnPush child with plain mutation (broken both modes), `markForCheck`, `detectChanges`, signal. **Part C:** side-by-side API comparison with docs links. |
| `/reactive-forms` | Three columns: subscribe + plain property (broken) / `markForCheck` fix / `toSignal` fix. "Simulate HTTP" fires a `setTimeout` to show the async case. |
| `/immutability` | `array.push()` vs `[...array, item]` — OnPush child with `@Input` change counter that flashes on real reference changes. |
| `/onpush-shield` | PrimeNG DataTable side by side. Parent ticker fires every second. Default-strategy table re-checks on every tick; OnPush table stays at 1 CD visit until a new product reference is passed. |
| `/expression-changed` | Three columns: `ngAfterViewInit` mutation (throws NG0100 in dev mode) / `Promise.resolve()` defer fix / signal fix. Broken example gated behind a button. |
| `/router-demo` | `ActivatedRoute.queryParams` subscribe broken vs `toSignal` fix. `router.events` subscribe broken vs `toSignal` fix. `@ViewChildren` QueryList.changes broken vs `toSignal` fix. |
| `/async-writes` | `firstValueFrom` + `async/await` for POST/PUT. Three columns: plain properties after `await` (broken) / `markForCheck` in `finally` fix / signals fix. |

---

## 14. Resources

### Angular Official Docs

- **[NG0100 — ExpressionChangedAfterItHasBeenChecked](https://angular.dev/errors/NG0100)**
- **[ChangeDetectorRef API](https://angular.dev/api/core/ChangeDetectorRef)** — markForCheck, detectChanges, detach, attach
- **[Runtime performance — OnPush, CD strategy](https://angular.dev/best-practices/runtime-performance)**
- **[Zoneless guide](https://angular.dev/guide/zoneless)**
- **[Signals overview](https://angular.dev/guide/signals)**
- **[Component lifecycle](https://angular.dev/guide/components/lifecycle)**

### Must-Watch Videos

- **[Zoneless Angular — Minko Gechev](https://www.youtube.com/watch?v=ybNj-id0kjY)** — the case for zoneless from Angular's lead developer.
- **[Angular Change Detection Deep Dive — Minko Gechev](https://www.youtube.com/watch?v=f8sA-i6gkGQ)** — authoritative overview of the whole system.
- **[Going Zoneless — Angular team](https://www.youtube.com/watch?v=6lF5xMBk1aA)** — the implementation details of zoneless.
- **[https://www.youtube.com/watch?v=rL-gInxctZs](https://www.youtube.com/watch?v=rL-gInxctZs)** — change detection / zoneless (verify title when watching).
- **[https://www.youtube.com/watch?v=FvNXnBdIX1M](https://www.youtube.com/watch?v=FvNXnBdIX1M)** — change detection / signals (verify title when watching).
- **[Immutability in Angular — Deborah Kurata](https://www.youtube.com/watch?v=oqYQG7QMdzw)** — clear explanation of immutability and why it matters with OnPush and signals.

### Must-Read Articles

- **[A change detection, Zone.js, zoneless, local change detection, and signals story — Enea Jahollari (justangular.com)](https://justangular.com/blog/a-change-detection-zone-js-zoneless-local-change-detection-and-signals-story)** — the best written narrative from Zone.js to zoneless. By Enea Jahollari (push-based.io), not Mathieu Riegler.
- **[Local change detection and Angular signals in templates in detail (angularwave, Medium)](https://medium.com/angularwave/local-change-detection-and-angular-signals-in-templates-in-details-948283adc36d)** — deep dive into how signal-driven local CD works inside Angular's rendering pipeline.
- **[How does Angular change detection really work? — Angular University](https://blog.angular-university.io/how-does-angular-2-change-detection-really-work/)** — foundational explanation, explains Zone.js patching and the change detection cycle in detail.
- **[Everything you need to know about change detection in Angular — Max Koretskyi (indepth.dev)](https://indepth.dev/posts/1053/everything-you-need-to-know-about-change-detection-in-angular)** — the deepest LView/TView internals reference. Older but the internal model is still accurate.
- **[push-based.io event — A change detection, Zone.js, and signals story](https://push-based.io/event/a-change-detection-zone-js-and-signals-story)** — event/workshop material from Enea Jahollari.

### Key People

- **Matthieu Riegler** ([@Jean__Meche](https://github.com/JeanMeche)) — Angular core contributor, primary author of the zoneless scheduler and local change detection implementation. His tools:
  - [Angular Change Detection Visualizer](https://jeanmeche.github.io/angular-change-detection/)
  - [Angular Compiler Output](https://jeanmeche.github.io/angular-compiler-output/)
- **Enea Jahollari** ([push-based.io](https://push-based.io)) — most published author on the signals + zoneless story in practice.
- **Max Koretskyi** ([indepth.dev](https://indepth.dev)) — wrote the foundational deep-dives on Angular internals (LView, TView, Zone.js mechanics).
- **Minko Gechev** — Angular lead, best videos for the "why zoneless" argument.

### Interactive Tools

- **[Angular Change Detection Visualizer](https://jeanmeche.github.io/angular-change-detection/)** ([source](https://github.com/JeanMeche/angular-change-detection)) — interactive tool to explore how CD propagates through a component tree. Built by Matthieu Riegler.
- **[Angular Compiler Output](https://jeanmeche.github.io/angular-compiler-output/)** ([source](https://github.com/JeanMeche/angular-compiler-output)) — see what the Angular compiler generates from templates. Essential for understanding how bindings become CD instructions (`ɵɵtextInterpolate`, `ɵɵproperty`, `ctx`, LView indices).
