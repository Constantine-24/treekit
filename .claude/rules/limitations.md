# Known limitations (documented in the README — don't "fix" accidentally)

These are deliberate v1 boundaries. Changing any of them is a design decision that needs a plan, not a drive-by fix.

- **Fixed row height in the built-in virtualizer.** Variable heights need `TanStackVirtualizer` (`@constantine-24/treekit-core/tanstack`) plus row measurement (`TkTreeRowMeasure` in Angular; built into `<TkTree>` in React when the virtualizer has `measure`).
- **The tree owns its scroll viewport** — no window-scroll mode.
- **RTL is untested.**
- **Native HTML5 DnD does not fire from touch gestures on Android Chrome** — keyboard DnD is the supported fallback on touch.

**Enabling multi-select rebinds one key.** `Space` becomes "toggle selection" and `Ctrl/Cmd+Space` becomes "grab for keyboard drag"; with no `SelectionModel` wired, `Space` still grabs exactly as before. This mode-dependent binding is a real smell, accepted because every unambiguous alternative chord collides with a browser or OS shortcut (`Cmd+M`, `Ctrl+M`, `Ctrl+Shift+M`, `Alt+Space`), and because the only thing displaced is APG's `Ctrl+Space`, which APG itself calls a redundant alias for `Space`.
