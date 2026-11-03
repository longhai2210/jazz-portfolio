# Plan: Feature name

Feature branch: `feature/<name>`

| Task | Covers (ACs) | Files it may touch | Depends on | Lane |
|---|---|---|---|---|

Parallel lanes: tasks in the same lane run one after another; different lanes run in parallel.
Shared hot files (router config, store root, i18n files, API client registry) belong to one wiring task, scheduled last.
