# T-000 Title

- Feature: <feature>
- Covers: AC-AREA-001.1, AC-AREA-001.2
- Role: dev | designer
- Stack: <package dir> (<framework>, <test runner>)
- Depends on: none
- Status: Ready
- Done when: verify green (G3), every covered AC has a passing test (G4), scope check clean, review approved (G5)

## Files it may touch
- path/to/file.ts

## Scoped verify
`<the package's scoped verify command from CLAUDE.md>`

## Rules
- <files printed by: node scripts/rules-check.mjs --for <files it may touch>>

## Context pack
<output of: node scripts/kg.mjs pack <files>, or written by hand without a graph>

## Log
