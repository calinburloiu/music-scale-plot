---
paths:
  - "app.js"
  - "index.html"
  - "style.css"
  - "test/**/*.js"
---

# Required reading

**Read `docs/TESTING.md` before you edit this file.** Read it now, with the Read
tool — it is not loaded into context automatically, and this rule deliberately
does not restate it. For a non-trivial change, read `docs/PLAN-01.md` as well:
it is the source of truth for intended behaviour.

This project is strict TDD. The failing test comes first, always — including for
bug fixes, which start with a test that reproduces the bug. Never write
production code that no failing test demanded, never commit implementation
without its tests, and never delete, skip or loosen a test to get green. Run the
whole suite with `npm test` before committing, not just the file you touched.

`docs/TESTING.md` has the full red/green/refactor workflow, what is and is not
in scope for tests here, how the test harness loads `app.js`, and the
conventions for writing a new test.
