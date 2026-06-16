# Problem Statement Validation Criteria

## Score Areas

Use scores only when they clarify the verdict. Tie every score to evidence from the repo, the user's description, or searched sources.

| Area | Strong | Weak |
|---|---|---|
| Pain intensity | The user loses money, time, trust, access, safety, status, or opportunity. | The user is mildly annoyed or only "might like" the idea. |
| Niche clarity | The target user is specific enough to find manually. | The target user is "everyone", "students", "creators", "businesses", or another broad group without a narrow context. |
| Urgency | The pain appears during a repeated workflow, deadline, compliance moment, transaction, or high-stakes decision. | The pain has no trigger or can be ignored indefinitely. |
| Originality | The project has a distinct data source, user wedge, workflow timing, integration, or insight. | The project is a generic dashboard, chatbot, marketplace, planner, tracker, or AI wrapper. |
| Solution fit | The solution directly removes the core friction and can prove behavior change. | The solution adds features around the pain without changing the painful behavior. |
| Demo strength | The core value can be shown in under 3 minutes with realistic input and output. | The demo depends on imagined adoption, fake data, or future integrations. |

## Strong Problem Statement Pattern

Prefer this shape:

```text
For [specific user] during [specific situation], [current behavior] fails because [sharp friction], causing [concrete consequence].
```

Examples of strong structure:

- "For independent clinic owners during insurance claim follow-up, spreadsheet-based tracking fails because denials arrive across disconnected portals, causing missed appeal windows."
- "For hackathon teams using multiple sponsor APIs, integration planning fails because track requirements are scattered across docs and Discord updates, causing teams to build demos that miss judging criteria."

Avoid these weak shapes:

- "People need a better way to manage tasks."
- "An AI platform for productivity."
- "A decentralized marketplace for everything."
- "Students struggle with learning."

## Opponent Mapping

Always look for opponents before recommending an idea.

- **Direct competitor**: product that claims to solve the same problem for the same user.
- **Indirect substitute**: broader tool the user already uses, such as spreadsheets, Notion, Airtable, Slack, Discord, Google Forms, Zapier, ChatGPT, or email.
- **Manual workaround**: human process, freelancer, assistant, operations teammate, spreadsheet ritual, or copy-paste workflow.
- **Do nothing**: the user tolerates the pain because switching cost is higher than the pain.

When current market facts matter, browse or use available search tools instead of guessing. When the user asks for recent winning hackathon inspiration, use Tavily MCP if available and search for recent hackathon winners, sponsor track winners, demo day projects, and project galleries.

## Duplicate Risk Test

Flag high duplicate risk when:

- the idea can be described as "[known product] but with AI/blockchain"
- the problem statement names the solution technology before the user pain
- the product competes with default behavior from a platform vendor
- the niche is broad and already served by many tools
- the project has no unique workflow timing, data source, user access, or distribution angle

Lower duplicate risk when:

- the project owns a narrow workflow with a clear trigger
- the target user can be found in specific communities or channels
- the output plugs into a decision the user already has to make
- the demo uses real artifacts from the user's current workflow
- the solution is meaningfully faster, safer, cheaper, or more trusted than current behavior

## Idea Generation Heuristics

When generating new ideas from a rough track, create options that are:

- narrow enough to explain in one sentence
- painful enough that a user would try a rough tool
- demoable with realistic sample data
- differentiated from obvious competitors
- tied to a specific user and moment
- small enough for an MVP or hackathon build

Useful angles:

- compliance deadline or audit trail
- coordination failure between teams
- trusted verification of claims or credentials
- messy data trapped across screenshots, PDFs, chats, or portals
- workflow handoff where errors are expensive
- public data converted into private decisions
- niche professional process still run by spreadsheet

## Validation Tests

Prefer tests that measure behavior, not compliments:

- Ask target users to show their current workaround.
- Ask when the problem last happened and what it cost.
- Ask what they tried before and why it failed.
- Create a landing page or demo and ask for a concrete next action.
- Manually perform the service for 3-5 users before automating.
- Compare the result against the user's current workflow on time saved, error reduction, or decision quality.

## Pivot Paths

If the idea is weak, suggest one of these pivots:

- narrow the user
- move closer to a costly workflow trigger
- replace generic AI chat with structured output inside a workflow
- use a unique data source or integration
- target the buyer instead of the end user
- turn a broad platform into a single wedge feature
- reposition from "nice to have" to deadline, risk, compliance, revenue, or access
