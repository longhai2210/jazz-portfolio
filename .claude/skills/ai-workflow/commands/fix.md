# fix "<symptom>" [feature]

1. Locate: `node scripts/kg.mjs find` on the symptom (screen, route, endpoint, error text), then `deps` to find where the behaviour lives and in which package. Without a graph: CLAUDE.md's maps, then Grep for the error text or route.
2. Find the AC the bug violates. If none covers it, draft a new AC in that feature's spec (or a new spec when none covers the area), bump the version, add a change-log line, and ask the user to confirm it before work starts.
3. Branch: `feature/<feature>` when it is still open. If it does not exist, create it from the default branch. If it exists but is already merged into the default branch, `git branch -d feature/<feature>` (git refuses unless it is merged) and create it again.
4. Create one task covering that AC, filled as in plan (Stack, Scoped verify, Rules, Context pack). The dev writes a failing test titled with the AC first, then fixes.
5. Run the loop from `run` for that single task, then give a short sign-off summary.
