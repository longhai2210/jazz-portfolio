# spec <feature> [request text or file path]

1. Create `specs/<feature>/requirements.md` from `specs/_templates/requirements.md`. Pick a short uppercase AREA code that no other spec uses (`grep -h '^id:' specs/*/requirements.md`).
2. Turn the request into REQs, each with ACs in Given / When / Then form that a test can check. Put everything you are unsure about under "Open questions"; never guess.
3. Use the project's real names: `node scripts/kg.mjs find "<term>"` for the screens, components, endpoints, DTOs, modules and shared types involved (no graph: CLAUDE.md's architecture map and Packages table, then Glob/Grep). Fill "Packages touched" with each package and what changes there.
4. When the feature crosses packages (for example a shared type, an endpoint and a screen), write the data contract once in `specs/<feature>/api.md`: request and response fields with types, errors and status codes. ACs cite it, so every package builds against the same contract.
5. Leave `status: draft`. Show the user the REQ/AC list, the packages touched and the open questions, and ask them to approve (gate G0). Only the user's explicit approval lets you set `status: approved`.
