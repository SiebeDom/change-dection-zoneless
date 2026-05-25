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

What can happen instead is `ExpressionChangedAfterItHasBeenChecked`. If during a CD cycle a parent is checked and writes a value, and then a child updates that same value during its own check in the same cycle, Angular detects the inconsistency and throws in development mode. This is Angular's protection against a view being in an inconsistent state after a single pass.

The practical rule: never change state inside lifecycle hooks that run during CD (like `ngAfterViewChecked`). If you see `ExpressionChangedAfterItHasBeenChecked`, that is where to look.

---

### `markForCheck()` vs `detectChanges()`

| Property | `markForCheck()` | `detectChanges()` |
|---|---|---|
| **What it does** | Sets a dirty flag on this component and ancestors | Runs a CD cycle synchronously on this component's subtree |
| **Scope** | Cooperates with the next global `AppRef.tick()` | Local subtree only, bypasses the global cycle |
| **Timing** | Async — at the next scheduled CD cycle | Sync — immediately |
| **Respects OnPush?** | Yes | No — checks the subtree regardless of strategy |
| **Preferred?** | Yes | Rarely — testing or when an immediate DOM update is unavoidable |

#### Seeing the difference in the JeanMeche demo

In the demo, uncheck Zone.js first (to remove the automatic CD trigger). Then:

- Press **detectChanges** on a component — the subtree below it re-renders immediately, even though no global cycle ran.
- Press **markForCheck** on a component — nothing visible happens. The flag is set but no cycle fires. Only when you re-enable Zone.js or trigger a click does the view update.

This is the clearest way to see that `markForCheck()` is just a flag and nothing more.

---

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
4. **Enable zoneless.** In `app.config.ts`, add `provideExperimentalZonelessChangeDetection()` and remove `zone.js` from `polyfills`.
5. **Verify.** Walk through your app's key flows. Any view that fails to update is a place where a mutation slipped through step 3.

---

## 12. Macro Tasks, Micro Tasks, and Async

Angular's async behaviour is layered on the browser's task model. Understanding this helps explain *when* effects and scheduled CD cycles actually run.

- **Synchronous code** runs to completion before the browser does anything else.
- **Microtasks** (Promises, `queueMicrotask`) run immediately after the current synchronous task, before the browser renders or handles the next event.
- **Macrotasks** (`setTimeout`, `setInterval`, `requestAnimationFrame`) are queued and run in a later turn of the event loop.

Zone.js patches both microtasks and macrotasks, which is why it can intercept `Promise.then` and `setTimeout` alike. Angular's own scheduler (in zoneless mode) uses microtasks to schedule CD cycles — this is why signal updates feel immediate but are technically async: the update marks things dirty synchronously, and the CD cycle runs at the next microtask checkpoint.

*A visual / diagram of the event loop with Angular's scheduling points would go well here.*

---

## 13. Demos (To Be Added)

- **Pure HTML + JavaScript** — manual DOM updates, no framework, to show the baseline problem.
- **Angular Default strategy** — a car list and detail page; show how many components are checked on each interaction.
- **Angular OnPush** — same app with OnPush; show what breaks without immutability and what the fix looks like.
- **Zoneless** — same app with signals and `provideExperimentalZonelessChangeDetection()`; show the clean call stacks.
- **JeanMeche visualizer walkthrough** — guided tour of the interactive demo with real-world analogies (PrimeNG table, `setTimeout` simulating a backend call, chart library outside the zone).

---

## 14. Resources

### Must-Watch

- **[Zoneless Angular — Minko Gechev](https://www.youtube.com/watch?v=ybNj-id0kjY)** — the case for zoneless from Angular's lead developer.
- **[Angular Change Detection Deep Dive — Minko Gechev](https://www.youtube.com/watch?v=f8sA-i6gkGQ)** — authoritative overview of the whole system.
- **[Going Zoneless — Angular team](https://www.youtube.com/watch?v=6lF5xMBk1aA)** — the implementation details of zoneless.
- **[Immutability in Angular — Deborah Kurata](https://www.youtube.com/watch?v=oqYQG7QMdzw)** — clear explanation of immutability and why it matters with OnPush and signals.

### Must-Read

- **Everything you need to know about change detection in Angular** — deep dive by Max Koretskyi (indepth.dev)
- **Angular Change Detection Explained** — official Angular blog
- **Change Detection Fundamentals in Angular** — Angular docs, runtime performance section

### Interactive Tools

- **[Angular Change Detection Visualizer](https://jeanmeche.github.io/angular-change-detection/)** ([source](https://github.com/JeanMeche/angular-change-detection)) — interactive tool to explore how CD propagates through a component tree. Built by Matthieu Riegler (JeanMeche), a core Angular contributor.
- **[Angular Compiler Output](https://jeanmeche.github.io/angular-compiler-output/)** ([source](https://github.com/JeanMeche/angular-compiler-output)) — see what the Angular compiler generates from templates. Essential for understanding how bindings become CD instructions.
