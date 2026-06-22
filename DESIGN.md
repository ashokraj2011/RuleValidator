# Rule Testing Studio — Design Proposal

Status: **Draft / for discussion**
Scope: a redesign of the current Angular POC (`angular-app/`) into a focused
**rule testing interface** — a workbench for exercising rules against data, asserting
outcomes, and keeping them green over time.

---

## 1. What this app is

A **rule testing interface**. The user's loop is:

```
   author / pick a rule
        │
        ▼
   arrange data  ──►  run  ──►  inspect trace  ──►  assert outcome
   (fixture)           │              │                   │
        ▲              │              ▼                   ▼
        └──────────────┴────────  save as test case  ──► add to suite
                                         │
                                         ▼
                          run suite · coverage · catch regressions
```

Everything in the design serves making that loop **fast, trustworthy, and reproducible.**
The app already does the skeleton of this; the redesign sharpens the test model, the
feedback, and the engine the tests run through.

Core pieces today:

| Concern | File |
|---|---|
| Domain types (Rule / Term / TestCase / EvalResult) | `src/app/models/types.ts` |
| Evaluation + data synthesis | `src/app/services/rule-engine.service.ts` |
| State + persistence (god-store) | `src/app/services/rule-store.service.ts` |
| Mock data source | `src/app/services/mock-db.service.ts` |
| Sample rules / seed cases | `src/app/data/*.ts` |
| UI tabs (overview, test-data, generated, test-runs, coverage) | `src/app/components/*` |

### What's genuinely good and must be preserved

- **Short-circuit-aware evaluation tree.** `evaluateLogical` records `SKIPPED` /
  `shortCircuited` nodes, not just a boolean — the basis for explainable test results.
- **Bug-vs-drift classification.** `RuleStoreService` pins an `expectedSnapshot`, so a later
  mismatch on *unchanged* data is a likely **bug** and a mismatch on *changed* data is
  **drift**. This is exactly the right idea for a testing tool; keep it.
- **Data synthesis.** `synthesizeSnapshot` builds data that drives a rule TRUE/FALSE — the
  engine behind auto-generated PASS/FAIL cases and (later) coverage gap-filling.

---

## 2. What holds the testing loop back

Two layers of problems. The first is about the **test model and feedback**; the second is
that the **engine the tests run through is unsound**, so the results can't be fully trusted.

### 2a. The test workflow is underdeveloped

- **The test case is muddled.** `TestCase` flattens `dbKeys`, `snapshot`, `invocation`,
  `expectedResult`, `expectedSnapshot`, `lastAssertion`, `lastAssertionClass`. There's no
  clean *Arrange → Act → Assert* shape, which makes cases hard to read, diff, and reuse.
- **No reusable fixtures.** Every case carries its own inline data snapshot. "Adult US VIP"
  is re-typed across cases instead of being one named fixture composed into many.
- **Assertions are outcome-only.** You can assert PASS/FAIL of the whole rule, but not
  branch-level facts ("the balance check is what failed", "the country arm short-circuited")
  — even though the eval tree already carries that detail.
- **Coverage is fake.** `aggregateCoverage = signal(82.4)` is a hardcoded literal. The one
  number that tells a tester "what haven't I tested?" is invented.
- **Live vs pinned data is blurred.** `executeTestCase` runs against a pinned `tc.snapshot`
  (reproducible), but `fetchLiveData` pulls fresh data and resolves unknown personas to a
  random record by hash. Reproducible tests and exploratory live probes are tangled together.
- **God-store.** `RuleStoreService` owns all state and re-`JSON.stringify`s to localStorage at
  every mutation, with no migrations. Hard to test, easy to corrupt.

### 2b. The engine under test is unsound — so test results can lie

A testing tool is only as trustworthy as the engine it exercises. This one ships defects that
silently corrupt outcomes:

| # | Issue | Location | Consequence for a tester |
|---|---|---|---|
| 1 | Strict `===` equality | `compare()` | DB `age:"34"` (string) vs rule `34` → case FAILs for the wrong reason |
| 2 | `>`/`>=`/… on non-number → `false` | `compare()` | A type error looks like a legitimate non-match |
| 3 | `NOT` reads only `terms[0]` | `evaluateLogical` | Extra terms silently dropped; a passing test proves nothing |
| 4 | No cycle detection on `rule_ref` | `evaluateTerm` | A→B→A overflows the stack mid-run |
| 5 | `undefined` data == real `false` | `evaluateComparison` | "data missing" is indistinguishable from "condition false" |
| 6 | Synthesis conflicts | `synthesizeSnapshot` | `x>5 AND x<3` assigns `x` twice → an auto-case built on invalid data |

Fixing these is a prerequisite for trustworthy testing, not a side quest.

---

## 3. Target design — the test loop as the spine

The redesign organizes around the loop in §1. A thin Angular UI sits on a pure, testable
**kernel**; in between sit the testing primitives (fixtures, cases, suites, assertions,
coverage).

```
┌──────────────────────────────────────────────────────────────┐
│  UI (Angular, thin)                                          │
│  rule picker · data arrange · run + trace · assert · suite    │
│  · coverage map · regression diff                             │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────────┐
│  Testing layer                                                │
│   Fixtures (named, composable)   TestCase (Arrange/Act/Assert)│
│   Suite (group · tags · run-all)  Coverage (real MC/DC)       │
│   Regression (pin · bug vs drift · suite diff)                │
└───────────────┬──────────────────────────────────────────────┘
                │  tests run THROUGH a trustworthy engine ↓
┌───────────────┴──────────────────────────────────────────────┐
│  @rules/kernel  (pure TS · zero Angular · fully unit-tested)  │
│   Schema Registry (typed attrs) · tri-valued eval ·           │
│   cycle-safe rule_ref · deterministic trace ·                 │
│   constraint-based synthesizer · pre-flight lint              │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 A clean test-case model (Arrange / Act / Assert)

Split the muddled `TestCase` into three readable parts:

```ts
interface TestCase {
  id: string; name: string; tags: string[];
  // ARRANGE — what data the rule sees (a fixture ref + per-case overrides)
  arrange: { fixtureId: string; overrides?: Partial<TestDataSnapshot> };
  // ACT — which rule, invoked how
  act: { ruleId: string; invocation: InvocationContext };
  // ASSERT — expected facts (see 3.3); empty = exploratory, no assertion
  assert: Expectation[];
}
```

The pinned data lives in the fixture, so a rerun is reproducible by construction; "live
probe" becomes an explicit, separate mode that never masquerades as a saved test.

### 3.2 Reusable fixtures (data builders)

A fixture is named, typed data you compose into many cases:

```ts
interface Fixture {
  id: string; name: string;                  // "Adult US VIP"
  data: TestDataSnapshot;                     // typed against the registry
  derivedFrom?: string;                       // optional inheritance/overlay
}
```

One edit to the "Adult US VIP" fixture updates every case that uses it. Personas in
`mock-db` become first-class fixtures instead of hash-resolved surprises.

### 3.3 Richer assertions + explainable results

Assert more than the final verdict, using the detail the eval tree already produces:

```ts
type Expectation =
  | { kind: 'outcome'; expect: 'PASSED' | 'FAILED' | 'UNKNOWN' }
  | { kind: 'condition'; path: string; expect: 'PASSED' | 'FAILED' | 'SKIPPED' }
  | { kind: 'shortCircuit'; path: string };   // assert a branch was skipped
```

A failing case shows **exactly which leaf flipped**, expected vs actual value, and why —
straight from the decision trace, not a bare red dot.

### 3.4 Suites, tags, run-all

Group cases into suites, filter by tag/rule/outcome, run the whole suite, and get a
summary (passed / failed / unknown / drifted). The store already has the run history to
build this on.

### 3.5 Coverage as a testing signal (real, computed)

Delete the `82.4` literal. Compute **condition/branch coverage (MC/DC-style)** from the run
history by walking each recorded `EvalResult` tree: every leaf condition should be exercised
both TRUE and FALSE across the suite. Then close the loop with the synthesizer:

> "3 conditions were never evaluated FALSE — generate cases to cover them?"

Coverage stops being decoration and becomes the tester's to-do list.

### 3.6 Regression: pin, classify, diff

Keep the bug-vs-drift idea, formalize it: pin expectations against a fixture snapshot, run
the suite on demand, and **diff against the last run** — surfacing newly-failing cases,
newly-passing cases, and drift (same expectation, changed data). This is what keeps rules
green as they evolve.

---

## 4. The engine the interface tests through must be trustworthy

The testing layer above is only credible if the kernel under it is sound. The kernel is pure
TypeScript with no Angular imports — unit-testable in isolation, and reusable later by a CLI
or CI check.

- **Typed Attribute Registry.** Declare each attribute's type once
  (`customer.age: int`, `customer.country: enum<US|CA|…>`). The comparator then coerces
  `"34"` → `34` instead of `===`-failing (#1), and `>` on a non-numeric attribute is a
  **static** error, not a silent `false` (#2).
- **Tri-valued (Kleene) logic.** Missing data becomes `UNKNOWN`, not `false`, so
  `EvalResult.status` distinguishes "rule failed" from "couldn't evaluate" (#5). Truth tables:
  `U AND T = U`, `U AND F = F`, `U OR T = T`, `U OR F = U`, `NOT U = U`.
- **Cycle-safe `rule_ref`.** Track the visited-rule set during evaluation; a cycle is a
  reported error, not a stack overflow (#4). Also fixes `NOT` to handle all its terms (#3).
- **Constraint-based synthesizer.** Collect every leaf constraint on an attribute, intersect
  them, then assign one value — replacing last-write-wins (#7). An unsatisfiable set is a
  finding the tester sees ("this rule branch can never be true").
- **Deterministic decision trace.** A canonical, exportable trace so two runs diff cleanly
  (powers §3.6) and golden-file regression is possible.
- **Pre-flight lint (supporting).** Before you waste time writing tests, a quick static pass
  flags obviously broken rules: type mismatches, undefined attributes, cyclic refs, and
  unsatisfiable branches. This is a *convenience that speeds up testing* — not the headline.

---

## 5. Supporting architecture changes

- **Split the god-store** into `RuleStore` / `FixtureStore` / `SuiteStore` / `RunStore`
  behind a `PersistencePort` interface. localStorage stays the default adapter, but
  serialization is centralized with **versioned migrations** (#8 / §2a).
- **Separate live-probe from pinned tests.** Live fetch is an explicit exploratory mode that
  produces a fixture you can *choose* to save — it never silently backs a saved test case.

---

## 6. Phased plan (strangler, not rewrite)

The existing UI keeps working throughout; we sharpen the loop one slice at a time.

**Phase 1 — Trustworthy kernel.**
`@rules/kernel` with the typed registry, tri-valued comparator, cycle-safe eval, and
constraint-based synthesizer. Port the current engine behind it. The §2b defect table
becomes a failing-then-passing regression suite. *Deliverable: green tests, identical UI,
results you can trust.*

**Phase 2 — Clean test model + real coverage.**
Introduce fixtures and the Arrange/Act/Assert `TestCase`; migrate existing cases. Replace the
`82.4` literal with computed MC/DC coverage and a "cover the gaps" action. *Deliverable: the
core testing loop, sharpened end to end.*

**Phase 3 — Suites, richer assertions, regression diff.**
Grouping/tags/run-all, condition-level assertions, and suite-diff-vs-last-run on top of the
pinned-expectation/bug-vs-drift model.

**Phase 4 — Store split, persistence port, pre-flight lint panel, optional rule DSL.**
Architectural cleanup and conveniences once the loop has proven itself.

---

## 7. Recommended first step

Build **Phase 1**: the trustworthy kernel, with the §2b bug table encoded as a regression
suite. A testing interface that runs on an unsound engine is worse than no interface — so the
engine comes first, and everything else in this document builds on it.

---

## 8. Implementation status

This design has been implemented in `angular-app/`. Summary of what shipped:

**Done & verified** (build clean, 22 kernel tests green, exercised in the running app):

- **Kernel** (`src/app/kernel/`) — pure TS, zero Angular: typed `SchemaRegistry`,
  three-valued (Kleene) `logic`, typed `compare` with coercion, cycle-safe + tri-valued
  `Evaluator` with decision trace, constraint-based `Synthesizer` (whole-rule **and**
  targeted single-branch), static `Linter`, MC/DC `coverage`, and trace `diff`. The §2b bug
  table is encoded in `kernel.spec.ts` (#1–#7 + branch synthesis + coverage).
- **Integration** — `RuleEngineService` is now a thin facade over the kernel; `EvalResult`
  gains `UNKNOWN`, rendered distinctly (amber + reason) in the eval tree.
- **Real coverage** — the `82.4` literal is gone; the Coverage tab shows computed MC/DC
  branch coverage with a gap list, and **"Cover the gaps"** synthesizes targeted cases that
  drive each uncovered branch and actually closes coverage to 100%.
- **Validate tab** — pre-flight lint surface (type errors, undefined attributes, cyclic refs,
  contradictions/tautologies) per rule + portfolio summary.
- **Library tab** — reusable Fixtures (synthesize PASS/FAIL data, use & evaluate) and Suites
  (group a rule's cases, run as a unit).
- **Regression diff** — the Evaluate tab flags outcome flips / changed conditions vs the last
  recorded run, via `diffTraces`.
- **Persistence port** — `persistence.ts` centralizes serialization behind `PersistencePort`
  (localStorage adapter) with a versioned `migrate()` step.
- **Explicit data source per namespace** (addresses the §2a "live vs pinned blurred" gap) —
  each namespace is either a **Pinned snapshot** (stored/edited, reproducible) or **Live (DB)**
  (evaluation tracks the DB record). **Refresh from DB** can be triggered any time; in pinned
  mode it never overwrites your data — it flags **drift** field-by-field (`stored → live`) with
  **Adopt live** / **Keep stored**.

**Deferred** (scaffolded, not fully wired — honest gaps):

- *Condition-level assertions* (§3.3): the model supports outcome assertions and the trace
  carries per-leaf detail, but asserting on a specific branch in the UI is not yet wired.
- *Full store split* (§5): persistence is centralized behind the port and new buckets
  (fixtures/suites) are separated, but `RuleStoreService` remains one cohesive class rather
  than four. The port makes a later split mechanical.
- *AAA test-case restructure* (§3.1): `TestCase` gained `tags` / `fixtureId` additively;
  the flat shape was kept for back-compat rather than restructured into arrange/act/assert.
