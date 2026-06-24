---
name: refactor-codebase
description: Review and refactor an existing repository end to end while preserving behavior. Use when the user explicitly invokes this skill or asks to clean an entire codebase, remove dirty or redundant code, find and delete unused files or assets, remove unused dependencies and stale configuration, simplify over-engineering, or perform a repository-wide refactor with verified changes and a final per-file and aggregate change summary.
---

# Refactor Codebase

Clean the repository, not merely report findings. Prefer deletion and simplification over new abstractions.

When the user asks for architecture review, also surface deepening opportunities. A deepening opportunity turns a shallow module into a deeper one: smaller interface, larger implementation, more locality, and better leverage from tests.

## Boundaries

- Preserve observable behavior unless the user explicitly requests a behavior change.
- Preserve unrelated user changes. Inspect the worktree before editing and never reset, overwrite, or reformat unrelated work.
- Treat pre-existing untracked files as user work. Inspect them for context, but do not modify or delete them unless the user placed them in scope or their disposable/generated status is certain.
- Do not commit, push, install new dependencies, or perform destructive version-control operations unless explicitly requested. When removing a dependency, update its lockfile with the repository's existing package manager.
- Treat generated files, migrations, public assets, framework entrypoints, scripts, CI/deployment files, and convention-loaded files as used until proven otherwise.
- Do not delete a file or dependency from one search result or unused-code tool alone. Confirm through imports, string and path references, configuration, package scripts, framework conventions, dynamic loading, CSS/HTML manifests, build output, runtime entrypoints, tests, and CI/deployment usage as applicable.
- If evidence remains ambiguous, leave the item in place and list it under `Uncertain / not changed`.

## Workflow

### 1. Establish the baseline

1. Read repository instructions and identify the language, framework, package manager, entrypoints, workspaces, generated-code boundaries, and available checks.
2. Record the initial worktree status so pre-existing changes remain distinguishable. Establish a content baseline for every path before changing it: use the current commit for clean tracked files and temporary copies for dirty, untracked, or non-version-controlled files.
3. Run the smallest representative existing checks before editing. Prefer the repository's existing build, test, typecheck, and lint commands; do not add tooling solely for this review.
4. If baseline checks fail, record the failures. Continue only where changes can still be verified without confusing existing failures with regressions.

### 2. Inspect the whole repository

Search tracked and relevant untracked source files while excluding dependency caches, build output, and version-control internals. Inspect:

- unreachable code, unused exports/imports/variables/parameters, stale flags, commented-out implementations, duplicate logic, and needless indirection;
- single-use wrappers, one-implementation interfaces, speculative factories/configuration, pass-through modules, and hand-rolled standard-library or native-platform behavior;
- unused source files, tests, routes, scripts, assets, styles, fixtures, declarations, and obsolete generated leftovers;
- unused direct dependencies, dev dependencies, package scripts, configuration, aliases, and redundant dependency manifests or lockfiles;
- accidental repository debris such as copied variants, backups, abandoned prototypes, and files not required by the shipped application or its development workflow.

Follow the Ponytail order: delete unnecessary work; use the standard library; use native platform features; reuse an installed dependency; only then write the minimum code required.

Also note architecture friction where it is directly relevant to safe cleanup:

- understanding one concept requires bouncing through many shallow modules;
- an interface is nearly as complex as the implementation behind it;
- pure functions were extracted only for testability, but bugs live in how they are wired together;
- tightly coupled modules leak across a seam;
- tests must mock many adapters instead of exercising one useful interface.

Use the deletion test before naming an architecture candidate: would deleting the
module concentrate complexity into a deeper module, or merely move the same
complexity elsewhere? Only keep candidates where the answer is "concentrate".

Use this vocabulary in architecture notes and final summaries: module,
interface, implementation, depth, deep, shallow, seam, adapter, leverage, and
locality.

If the user asked for architecture review, generate an HTML report before editing. Use `references/HTML-REPORT.md` for the format. Write it to the OS temp directory, open it for the user, and ask which candidate they want to explore or apply. Do not propose new interfaces until the user picks a candidate.

If architecture friction appears during ordinary cleanup, do not pause the cleanup. List credible candidates under `Uncertain / not changed` unless there is a small behavior-preserving deletion or inline cleanup to apply safely.

### 3. Rank and apply

Work from highest-confidence, highest-value cuts to smaller structural cleanup:

1. Delete proven dead files, assets, code, scripts, and dependencies.
2. Inline or remove redundant layers, wrappers, branches, and configuration.
3. Consolidate genuine duplication without creating speculative abstractions.
4. Apply architecture deepening only when it is behavior-preserving, backed by locality or leverage gains, and smaller than leaving the shallow modules in place.
5. Apply named behavior-preserving refactorings only where they make the result smaller or materially clearer.

Make changes in small coherent batches. After each non-trivial batch, run the narrowest relevant check. If a batch causes a regression, undo only the exact edits from that batch; never restore whole files containing pre-existing user changes.

When tests do not cover behavior being changed, add the smallest characterization check needed to make that refactor safe. Do not create a broad new test suite solely for cleanup.

Do not chase a score, arbitrary line-length threshold, or theoretical purity. Stop when remaining changes lack strong evidence or would trade working, understandable code for a different style.

### 4. Verify

Run the strongest existing checks affordable for the repository: tests, typecheck, lint, build, and focused runtime smoke checks. Compare failures with the baseline and report anything not run.

Review the final diff for accidental behavior changes, secrets, generated noise, unrelated formatting, and incomplete dependency or reference removal.

## Change accounting

Track only changes made during this skill run, excluding pre-existing worktree changes. Measure against the per-file content baseline captured before editing, not automatically against `HEAD`.

For every affected path, record its action and diff line counts:

- `modified`: additions and deletions;
- `added`: total lines in the new file;
- `deleted`: total lines in the removed file;
- `renamed`: old path → new path, plus content changes if any.

For each modified file, count `refactored lines` as `min(raw additions, raw deletions)`, added lines as `max(raw additions - raw deletions, 0)`, and deleted lines as `max(raw deletions - raw additions, 0)`. For added or deleted files, count every line as added or deleted. Aggregate those values for the summary and calculate net change from raw additions minus raw deletions. Label refactored lines as an estimate; line-based diffs cannot identify semantic refactoring exactly. Keep the per-file `+added / -deleted` figures as raw diff counts.

## Required final response

Lead with whether cleanup completed and whether behavior checks passed. Then include:

### Summary

- Refactored lines (estimated)
- Lines added
- Lines deleted
- Net line change
- Files modified
- Files added
- Files deleted
- Files renamed
- Dependencies removed or added
- Checks passed, failed, or skipped

### Files affected

Use one line per path: `action | +added / -deleted | path | concise reason`. Include manifest and lockfile changes caused by dependency removal.

### Verification

List commands run and their result. State baseline failures and skipped checks explicitly.

### Uncertain / not changed

List only plausible cleanup candidates retained because usage or safety could not be proven. Omit this section when empty.

Include architecture candidates not applied here when they were speculative, user
approval was not available, tests were insufficient, or the candidate would
change behavior.
