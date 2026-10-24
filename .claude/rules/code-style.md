# TypeScript & Code Style

Formatting is Prettier and is applied automatically to edited files by the PostToolUse hook. **Two Prettier configs resolve per file**: the root `.prettierrc.json` (`printWidth: 100`, `singleQuote`, `arrowParens: avoid`, `trailingComma: es5`) and `packages/angular/.prettierrc` / `apps/demo-angular/.prettierrc` (Prettier defaults plus the `angular` HTML parser). That is why core and React write `node => ...` and the Angular code writes `(node) => ...` — match the file you are in, and let Prettier decide.

Linting is ESLint flat config: `packages/core/eslint.config.js` and `packages/react/eslint.config.js` (which adds `eslint-plugin-react-hooks`).

<important if="you are writing or modifying TypeScript code">

- Private class members are `_camelCase` with a required leading underscore (enforced by `@typescript-eslint/naming-convention`). React components use module-level helpers and hooks instead of classes, so the rule rarely applies there.
- `explicit-module-boundary-types` is an error — exported functions and methods need explicit return types.
- `// MARK: -` comments section long classes and long components.
- `tsconfig.base.json` sets `strict` + `noUncheckedIndexedAccess`; hence the `!` assertions after array index access in core.
- **The Angular workspace does not extend `tsconfig.base.json`** — it's a standalone Angular CLI workspace on its own TypeScript version (~6.0 vs core's ^5.8) with its own compiler options.
- Never use `any` — use `unknown` and narrow. No `enum` — use union types or `as const` objects.
- Prefer `interface` for object shapes and `readonly` for data that should not change.
- Descriptive names; no single-letter names outside tiny lambdas and loop indices.
  </important>

<important if="you are writing code comments, TSDoc, or documentation in source files">

- Every exported class, function, interface, input, output and prop has TSDoc. It ships in the `.d.ts` files and is what consumers see in their IDE, so describe behaviour, defaults and units, not implementation.
- Inline comments explain _why_ (a constraint, a browser quirk, a load-bearing ordering), not _what_.
- Don't state counts ("all four layers…") in comments or docs; they go stale. Name the command that produces the count, or cite `file:line`.
  </important>
