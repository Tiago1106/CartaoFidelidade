---
name: approval-workflow
description: How to run any development task in this repository, one at a time, with Tiago's approval before it counts as done. Use at the start of every task, whenever picking the next task, and when delivering work for review.
---

# Approval workflow

Tiago wants to move slowly and approve each piece. One task at a time. A task is **Done only when Tiago says it is approved.**

Talk to Tiago in Brazilian Portuguese. Everything written to the repository (code, identifiers, files, folders, routes, commits, comments, docs filenames) is in English. Only text shown to end users is Brazilian Portuguese, in the messages file (decision D-007 in `docs/DECISIONS.md`).

## 1. Pick the task

1. Open `docs/TASK_PLAN.md`. Take the first task with status `Pending`, in order, unless Tiago named another.
2. Check that no other task is `In progress`, `In review` or `Adjusting`. If one is, do not start a new task. Say which one is waiting.
3. For a milestone block in Phase C: break it into small tasks, add them to the plan, and wait for Tiago's OK on the breakdown before coding.

## 2. Plan in five lines

Before coding, write a short plan in the conversation: what you will build, which `RN-...` rules it covers, which design files you will read, how Tiago will check it. Do not wait for approval of the plan unless a product decision is missing from the documents. If it is missing, ask (one question at a time). Do not ask about technical details the stack already answers.

## 3. Work

- Create a branch `task/T05-text-field` (id plus short English name). Never work on `main`.
- Set the task to `In progress` in `docs/TASK_PLAN.md` and add a line to the Log.
- Small commits, Conventional Commits in English, citing the rule when there is one: `feat(stamps): minimum interval (RN-VIS-05)`.
- Stay inside the task. Notice something outside it? Write it down for the delivery message; do not fix it now.
- Do not edit anything in `docs/design/`. It is read-only.
- Do not invent rules. If something is not in the documents, take the simplest option, mark it `[Premissa]` in the document and tell Tiago.

## 4. Check before delivering

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`. For screens and components, take screenshots at 390 x 844 with Playwright and save them to `docs/evidence/<task-id>/`. Compare with the design file line by line (see `implement-screen` and `design-system-component`). Fix differences before delivering.

## 5. Deliver and stop

Set the task to `In review` and write the delivery message to Tiago, in Portuguese, with exactly these parts:

1. **Task**: id and name.
2. **What is ready**: three to six lines.
3. **How to see it**: the exact commands and URL (for example `pnpm storybook`, then the story name; or `pnpm dev` and the route).
4. **Evidence**: screenshot paths and the test output summary.
5. **Compared with the design**: a short checklist of what you checked, and any deliberate difference with the reason.
6. **Left out and new `[Premissa]`**: anything not done or assumed.

Then **stop**. Do not start the next task. Do not merge. Wait for Tiago.

## 6. After the answer

- **Approved** ("aprovado", "pode seguir", or similar): set `Done`, merge the branch into `main` (squash is fine), add a Log line, update documents if anything changed, then say which task is next and wait for a go-ahead.
- **Changes requested**: set `Adjusting`, fix only what was asked, rerun the checks, update the evidence, set `In review` again and send a new delivery message that lists what changed.
- **Unclear answer**: ask what he meant. Never treat silence or a question as approval.
