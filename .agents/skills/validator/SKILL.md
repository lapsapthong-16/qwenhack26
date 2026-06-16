---
name: validator
description: Validate or generate project problem statements, niches, market opponents, and solution concepts. Use when the user asks whether a project idea is valid, original, niche, interesting, hackathon-worthy, worth building, duplicated by existing products, or when they need help turning a rough track into a strong problem statement and solution. For existing repos, inspect the repository and validate the inferred idea; for new ideas, work from the user's description and ask for missing core context.
---

# Validator

## Overview

Use this skill to test whether a project problem statement is real, specific, differentiated, and matched to a valid solution. Support two workflows:

- **Validate idea**: evaluate an existing repo or user-provided idea.
- **Generate idea**: turn a rough track, theme, or pain area into sharper problem statements and solution options.

Use a startup-pressure-test lens: real user pain, current behavior, opponents, urgency, fast validation, and the smallest useful solution.

## First Move

If an existing repository is available and the user asks to validate it, inspect local files first:

- `README.md`, docs, pitch files, demo scripts
- `package.json`, app routes, components, backend/API files
- smart contracts, database schemas, integrations, environment examples
- hackathon metadata, tracks, submission text, or issue/spec files

If the user gives only a rough track or vague idea, ask for missing core context before judging:

```text
Send the rough track, target user, current pain, and what the solution is supposed to do.
```

Ask at most 3 questions at once. Prefer questions about past behavior, target user, constraints, and the intended demo.

## Modes

Choose the mode from the user's request. If unclear, use `validate`.

- `validate`: judge the provided idea, repo, problem statement, niche, and solution.
- `generate`: create strong problem statements and solution directions from a rough track.
- `competition-check`: focus on current behavior, direct products, indirect products, and duplication risk.
- `hackathon-inspiration`: use Tavily MCP only when the user explicitly asks to search for recent winning hackathon projects or current inspiration.
- `deep`: expand with assumptions, validation plan, discovery questions, pivot options, and MVP scope.

Read `references/criteria.md` when the task needs deeper scoring rules, originality checks, generation heuristics, or competition mapping.

## Workflow

1. Identify the project mode: existing repo, described idea, or fresh idea generation.
2. State the inferred track, user, problem, and solution in one compact paragraph.
3. Test the problem:
   - Who has the pain?
   - What do they do today?
   - How painful, frequent, risky, or expensive is it?
   - Is the problem narrow enough to be memorable?
4. Test the solution:
   - Does it solve the core pain directly?
   - Can it be demoed or validated quickly?
   - Is it better than current behavior on one clear dimension?
   - Does it avoid becoming a generic dashboard, AI wrapper, or CRUD app?
5. Check opponents:
   - Direct competitors
   - Indirect substitutes
   - Manual workarounds
   - "Do nothing" behavior
6. Give a verdict and next action: proceed, sharpen, pivot, or reject.

If market facts are current or uncertain, use available search tools when the user asks for search, competitors, recent winners, or current market validation. Do not invent market data.

## Output Shape

Default to concise output:

```markdown
**Verdict**
Strong / Needs sharpening / Weak / Duplicate risk / Pivot required

2-3 direct sentences.

**Inferred Idea**
- Track:
- Target user:
- Problem:
- Solution:

**Scorecard**
| Area | Score | Read |
|---|---:|---|
| Pain intensity | 3/5 | ... |
| Niche clarity | 2/5 | ... |
| Urgency | 3/5 | ... |
| Originality | 2/5 | ... |
| Solution fit | 3/5 | ... |
| Demo strength | 4/5 | ... |

**Opponent Check**
| Opponent | Type | Why It Matters | Needed Difference |
|---|---|---|---|
| ... | Direct / Indirect / Manual / Do nothing | ... | ... |

**Better Problem Statement**
One sharp, specific sentence.

**Solution Direction**
- Build:
- Cut:
- Fast validation:
```

For `generate` mode, provide 3-5 idea options with:

- problem statement
- target user
- why now / why painful
- opponent to beat
- distinct solution wedge
- MVP/demo shape
- risk score

## Rules

- Be direct. If the idea is generic, duplicated, too broad, or solution-first, say so.
- Never accept "everyone" as a target user.
- Treat current behavior as competition.
- Treat "no competitors" as false by default.
- Separate direct competitors from indirect substitutes and manual workflows.
- Prefer niche, emotionally legible problems over broad "platform" ideas.
- Favor ideas that can prove one behavior change quickly.
- Reject problem statements that are only technology descriptions.
- Do not reward novelty if the pain is weak.
- Do not reward pain if the solution does not clearly change behavior.
- Convert vague ideas into concrete user, context, trigger, friction, and outcome.
- Avoid generic hackathon ideas unless there is a distinct data source, user wedge, workflow, or technical insight.
- If using Tavily MCP for inspiration, summarize patterns and adapt them; do not clone a winning project.

## Quality Bar

A strong result should make the user more decisive. They should leave knowing:

- whether the problem is valid
- whether the niche is specific enough
- who or what the real opponents are
- what must be different for the solution to matter
- what to build, cut, or validate next
