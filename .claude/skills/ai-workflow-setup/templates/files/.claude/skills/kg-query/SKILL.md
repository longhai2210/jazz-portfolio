---
name: kg-query
description: How to get code context cheaply, from the .ua knowledge graph with scripts/kg.mjs or, without a graph, from CLAUDE.md and Grep. Use before searching or reading code.
---
# Querying the knowledge graph

The graph in the main checkout's `.ua/` maps files, functions, imports and calls. It is large: never open, cat or grep `.ua/knowledge-graph.json`. Query it with `scripts/kg.mjs`, which works from any worktree and prints a few dozen lines.

| Need | Command |
|---|---|
| Is the graph current? | `node scripts/kg.mjs status` |
| Where is X? | `node scripts/kg.mjs find "<regex>" --type file` |
| What is this file, what's inside? | `node scripts/kg.mjs show <path>` |
| What does it use, who uses it? | `node scripts/kg.mjs deps <path>` |
| What could my change break, which tests to run? | `node scripts/kg.mjs impact --base <branch>` or `impact <files...>` |
| Context for a task | `node scripts/kg.mjs pack <paths or keywords>` |
| Which rule files apply? | `node scripts/rules-check.mjs --for <files...>` |

Cheapest first: (1) the task's context pack, (2) `show`/`deps` for what it misses, (3) read the source, (4) only then grep, and only in folders the graph pointed to.

Rules:
- The graph says WHERE; the code says WHAT. Summaries can lag behind small edits; never cite a summary as evidence.
- `[changed since graph: read source]` means the summary predates the latest change. `not in graph` means a new or ignored file.
- Never run /understand; the user updates the graph.

## No graph (kg.mjs says "No knowledge graph")
The graph is optional; the workflow works without it. Same questions, other tools:

| Need | Without a graph |
|---|---|
| Where is X? | CLAUDE.md's architecture map and Packages table, then Glob on file names, then Grep inside those folders |
| What does it use, who uses it? | Read its imports; Grep `from ['"].*<file stem>` for importers (in a monorepo also Grep the package name) |
| What could my change break, which tests to run? | Grep importers of each changed file, then their importers; run the tests next to all of them, then the package's scoped verify |
| Context for a task | The context pack the Lead wrote by hand in the task |

Workers never ask for /understand; the Lead decides.
