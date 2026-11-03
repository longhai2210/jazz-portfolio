# <Project name>: <one sentence on what it does and for whom>

## Stack
<one line per package: framework, language, state, router, UI library, i18n, API client, ORM>

## Commands
- Dev server: <command and URL per app>
- See "AI workflow" below for install, worktree setup and verify.

## Architecture: how a request flows
<e.g. Page -> hook -> React Query -> api/client.ts -> REST -> controller -> service -> repository>
- <key locations: routes or pages, shared components, design tokens, API client, state, i18n files, modules, DTOs, schema>

## Conventions
<Only patterns the code follows consistently, each with Example: `<path to a real file>`. In a monorepo or when this file passes ~150 lines, keep only repo-wide rules here and put package rules in .claude/rules (see Rules map).>

## Recipes
- <Add a page / endpoint / migration: the steps, each with an example file>

## Contracts to review
- <cross-boundary checks specific to this repo, e.g. API DTOs match the client types; mutations invalidate the matching queries; every locale has the new keys>

## Forbidden
- Reading or editing .env files, committing secrets; <client env prefix> variables are public
- Skipping or weakening tests, disabling lint rules to get green
- Guessing when a spec is unclear: ask instead
- <only what the code and lint config actually follow; anything else is listed as a known gap, not a rule>
