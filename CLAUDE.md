# AI Assistant Guide

This file provides guidance to AI coding assistants when working with code in this repository. Adherence to these guidelines is crucial for maintaining code quality and consistency.

## Guiding Principles (MUST FOLLOW)

- **Keep it clear**: Write code that is easy to read, maintain, and explain.
- **Start simple**: Begin with the simplest design — no extra abstraction layers, wrapper classes, or separate services unless explicitly requested. Prefer flat, minimal designs.
- **Fix upstream, don't hack downstream**: When a new feature hits an existing module's limitation, flag the upstream improvement for the user's decision before proposing a downstream workaround.
- **Read local READMEs first**: Before editing code in a directory, check for a `README.md` in that directory (and its parents) and read it — these files capture local conventions, invariants, and entry points that aren't obvious from the code alone.
- **Library-first, custom-last**: Before writing custom code, check library/framework docs for built-in options or existing solutions. Write custom code only when no adequate alternative exists.
- **Match the house style**: Reuse existing patterns, naming, and conventions.
- **Research via subagent**: Lean on `subagent` for external docs, APIs, news, and references.
- **Log centrally**: Using the correct context, the main-process logs via `loggerService`, renderer-process often uses `console.log`.
- **Access paths centrally**: Use `application.getPath('namespace.key', filename?)` for all main-process filesystem paths—never call `app.getPath()`, `os.homedir()`, or construct paths ad-hoc. Import the singleton via `import { application } from '@application'`.
- **Always propose before executing**: Before making any changes, clearly explain your planned approach and wait for explicit user approval to ensure alignment and prevent unwanted modifications.
- **Lint, test, and format before completion**: Coding tasks are only complete after running `pnpm lint`, `pnpm test`, and `pnpm format` successfully.
- **Write conventional commits**: Commit small, focused changes using Conventional Commit messages (e.g., `feat:`, `fix:`, `refactor:`, `docs:`).- **Keep history linear**: On shared branches, never use plain `git pull` — it creates merge commits. Always `git pull --rebase` (or `git fetch && git rebase origin/<branch>`). Before `git push`, run `git fetch`; if `origin/<branch>` has advanced, rebase your local commits onto it first. If you notice a merge commit in local history that hasn't been pushed yet, rebase it away — cleaning one up after it's public requires a risky force-push on a shared branch.
- **Sign commits**: Use `git commit --signoff` as required by contributor guidelines.

## Development

### Commands

Run `pnpm install` first (requires Node ≥22, pnpm 10.27.0). For every other script, read `package.json` — the ones you must know:

- `pnpm lint` — run eslint auto-fix, typeScript type checking, and prettier format check
- `pnpm stylelint` - run stylelint fix for stylesheets
- `pnpm test` — run all Vitest tests
- `pnpm format` — format files with prettier and run lint in write/fix mode.
- `pnpm build:check` — **REQUIRED before commits** (`pnpm lint && pnpm test`).

### Testing

- Tests run with Vitest 3 (see `vitest.config.*` for project setup).
<!-- - **Features without tests are not considered complete** -->

### Patched Dependencies

Before upgrading any dependency, check `patches/` for custom patches.

## Conventions

### TypeScript

- Strict mode enabled; use `tsgo` (native TypeScript compiler preview) for typechecking
- Separate configs: `tsconfig.node.json` (main), `tsconfig.web.json` (renderer)
- Type definitions centralized in `src/renderer/src/types/` and `packages/shared/`

### File Naming

- Vue components: `PascalCase.tsx`
- Services, hooks, utilities: `camelCase.ts`
- Test files: `*.test.ts` or `*.spec.ts` alongside source or in `__tests__/` subdirectory

### Logging

```typescript
import { loggerService } from '@logger';
const logger = loggerService.withContext('moduleName');
// Renderer only: loggerService.initWindowSource('windowName') first
logger.info('message', CONTEXT);
logger.warn('message');
logger.error('message', error);
```

- Backend: Winston with daily log rotation
- Log files in `userData/log/`
- Never use `console.log` — always use `loggerService`

### Paths

```typescript
import { getSystemPath, getUserPath } from '@main/utils/path';

getUserPath('typeName'); // get user data path
getUserPath('typeName'); // get system data path
```

### UI Design

- TDesign

## Security

- Never expose Node.js APIs directly to renderer; use `contextBridge` in preload
- Validate all IPC inputs in main process handlers
- URL sanitization via `strict-url-sanitise`
