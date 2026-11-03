# Plan: Feature name

Feature branch: `feature/<feature>` (from `@@DEFAULT_BRANCH@@`)

| Task | Covers (ACs) | Stack (package) | Files it may touch | Depends on | Lane |
|---|---|---|---|---|---|

Order along the data contract: schema and migrations, then shared packages, then backend, then frontend.
One task owns each shared package change; tasks that consume it depend on it.
Hot files (listed in CLAUDE.md) belong to one wiring task, scheduled last.
Tasks in the same lane run one after another; different lanes run in parallel and never share a file.
