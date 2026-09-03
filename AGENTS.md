
/
AGENTS.md

PayCycle AI Coding Instructions
This repository is a PayCycle AI MVP. Before changing code, understand the product and the contracts in docs/ and keep implementation narrowly aligned with them.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.

If multiple interpretations exist, present them. Don't pick silently.

If a simpler approach exists, say so. Push back when warranted.

If something is unclear, stop. Name what's confusing. Ask.

Required repository references
When the task touches any of the following, read the corresponding document under docs/ before implementation:

Product requirements, user flow, scope, behavior → docs/PRD.md

REST API, DTOs, request/response contracts → docs/API_SPEC.md

Database schema, entities, PK/FK, persistence rules → docs/DB_SCHEMA.md

Colors, visual tokens, UI styling rules → docs/COLOR_SYSTEM.md

Do not invent an API contract, DB relationship, product behavior, or design token when the repository documentation already defines it.

If code and docs disagree, do not silently choose one. Surface the conflict and ask for the intended source of truth unless the task explicitly tells you which one to change.

2. Simplicity First
   Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.

No abstractions for single-use code.

No "flexibility" or "configurability" that wasn't requested.

No error handling for impossible scenarios.

If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

Prefer the existing project conventions and the smallest change that satisfies the requirement.

Do not introduce a new library, state-management layer, design system, service abstraction, or infrastructure component unless there is a concrete requirement for it.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.

Don't refactor things that aren't broken.

Match existing style, even if you'd do it differently.

If you notice unrelated dead code, mention it. Don't delete it unless asked.

When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.

Don't remove pre-existing dead code unless asked.

The test
Every changed line should trace directly to the user's request or to a necessary consequence of the requested change.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals.

Examples:

"Add validation" → "Write tests for invalid inputs, then make them pass"

"Fix the bug" → "Write a test that reproduces it, then make it pass"

"Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

[Step] → verify: [check]

[Step] → verify: [check]

[Step] → verify: [check]

Do not stop at "it should work." Actually run the relevant checks.

Strong success criteria let you loop independently. Weak criteria require constant clarification.

Repository-specific guidance
Documentation is the source of truth
Before implementing a feature, inspect the relevant docs/ file(s).

PRD
docs/PRD.md defines:

service purpose and core value

MVP scope

user scenario

PayCheck behavior

OCR flow

AI Agent responsibilities

automatic salary monitoring

Calendar behavior

Profile behavior

API SPEC
docs/API_SPEC.md defines:

backend REST endpoints

request/response structures

mock bank API

PayCheck API

OCR API

AI Agent API

Calendar API

Profile API

Frontend requests must follow the documented API contract. If an API needs to change, update the API contract deliberately rather than silently changing the frontend/backend expectation.

DB SCHEMA
docs/DB_SCHEMA.md defines:

MySQL schema

entity names

columns and types

PK/FK relationships

persistence rules

how external financial data maps into internal storage

Do not create a second, conflicting schema in code or documentation.

COLOR SYSTEM
docs/COLOR_SYSTEM.md defines the existing visual tokens. Reuse these tokens rather than inventing ad-hoc colors.

PayCycle implementation rules
MVP scope
The current development focus is:

PayCheck

OCR/document extraction

mock bank transaction flow

automatic salary detection batch

rule-based comparison

AI Agent result and next action

persisted result

Calendar

salary, tax, exit, and personal events

source-linked events

Profile

display/edit current user profile

profile changes reflected in relevant flows

The MVP does not require real signup/login unless explicitly requested.

Use the existing seeded demo user described in docs/PRD.md.

AI boundaries
Do not ask the LLM to perform deterministic business calculations that code can perform reliably.

Use code/Rule Engine for:

amount differences

date differences

salary-day checks

trend calculations

case classification

readiness calculations

deterministic status changes

Use the AI Agent/LLM for:

explaining structured results

generating next-action guidance

generating fact-based employer questions

multilingual explanations

deciding which permitted internal tools/data should be consulted next

The Agent must not invent facts, legal conclusions, or unsupported numbers.

External data boundaries
For the MVP, real banking connectivity is represented by the documented Mock Bank API.

Do not build speculative financial-account integration unless explicitly requested.

When real external APIs are used later:

keep raw external response data separate from business analysis results

store only the data needed by the product

preserve source identifiers when needed for traceability

Calendar rules
CalendarEvent is a shared event/projection layer. Domain dates remain in their owning domain records.

Examples:

User.payday → PAYDAY event

BankTransaction / Paycheck.paymentDate → PAYCHECK event

tax schedule / TaxCheck → TAX event

User.expectedExitDate / ExitCheck → EXIT event

user-created date → PERSONAL event

source_type + source_id is a logical reference. Do not create a polymorphic database FK to multiple source tables unless the schema specification explicitly changes.

React → Next.js migration guidance
If an existing React/Vite app is provided and the task is to move it to Next.js, do not blindly rewrite the UI.

First inspect:

routing

entry points

shared layouts

static assets

environment variables

API calls

client-only browser APIs

state management

CSS/Tailwind setup

third-party packages that depend on Vite/browser globals

Then migrate incrementally:

Create the Next.js application structure.

Map the existing routes to Next.js routes.

Move reusable components with minimal changes.

Replace Vite-specific environment access with Next.js environment variables where required.

Mark only browser-dependent components with 'use client'.

Replace Vite-only imports/plugins with Next.js-compatible equivalents.

Preserve existing UI and behavior unless the task explicitly requests redesign.

Run the app and verify each migrated route before removing the old implementation.

Important
Do not assume "React → Next.js" means a full rewrite.

If the existing React app is already functional, prefer:

route/layout migration + compatibility fixes + verification

over a complete rewrite.

If the current app uses Vite-specific behavior that has no direct Next.js equivalent, stop and explain the tradeoff before replacing it.

Also, do not silently combine Next.js and Vite as the primary build system. If a requirement says "Next.js + Vite", clarify what is intended before implementation. Next.js normally uses its own build/runtime tooling; Vite can still appear as a separate tool for specific subprojects or tooling, but that is a deliberate architecture choice.

Working protocol
For every non-trivial task:

Before coding
Read the relevant docs.

State assumptions.

Surface ambiguity.

Give a short implementation plan.

Ask questions before coding when a decision materially affects architecture or behavior.

While coding
Make the smallest change that satisfies the task.

Follow the documented API and DB contracts.

Reuse existing code where practical.

Keep domain logic deterministic where possible.

After coding
Verify the requested behavior.

At minimum:

build/typecheck

relevant tests

affected API/UI flow

no new unused imports or dead code created by the change

If something remains unverified, say exactly what remains and why.

These guidelines are working when diffs stay small, rewrites are rare, and clarification happens before implementation rather than after mistakes.


마지막으로 모든 답변은 한국어로 진행할 것.