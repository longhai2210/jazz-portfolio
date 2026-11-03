# signoff <feature>

Only after the user has explicitly accepted the demo in this conversation (gate G6).

1. Set the spec to `verified`. If the feature added a page, module, endpoint, shared component or convention, update CLAUDE.md (architecture map, recipes, contracts to review) and the matching `.claude/rules` file in the same branch; every new rule names a real `Example:` file. Run `node scripts/rules-check.mjs` and `node scripts/trace.mjs <feature> --check --write`, then commit.
2. Ask before pushing. With the user's yes: `git push -u origin feature/<feature>`, then `gh pr create --base <default branch> --head feature/<feature>` with the PR template filled: "Covers:" lists every AC, plus the task IDs.
3. Gate on CI: wait for the checks (`gh pr checks <pr> --watch --fail-fast`, in the background if slow). `ai-gates` must be green on the PR. If it is red, read the failure (`gh run view <run-id> --log-failed`), fix it on the feature branch (a task through `run` for product code), push and wait again. Never report the feature as done on local green.
4. Report: PR link, ai-gates result, anything left for the user. Never merge without the user's explicit go-ahead.
5. No GitHub remote or no `gh`: there is no ai-gates run; say so, give the clean-checkout result from `run` instead, and ask how the user merges.
6. If the repo uses a graph, remind the user to run /understand after the merge.
