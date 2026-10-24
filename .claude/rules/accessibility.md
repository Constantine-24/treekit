# Accessibility

Accessibility — including keyboard drag-and-drop — is a headline feature, not a polish item.

<important if="you are building UI, modifying templates or keyboard handling, or doing accessibility review">

- The tree follows the [WAI-ARIA APG tree view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) with **`aria-activedescendant`**: the viewport holds focus (`role="tree"`, `tabindex="0"`) and rows are `role="treeitem"` with `aria-level`, `aria-expanded` (folders only) and `aria-selected`.
- `aria-activedescendant` is `null` whenever the active row is not currently rendered, so the attribute never points at a missing element. Both adapters must keep this.
- Keyboard DnD messages go to an `aria-live="assertive"` region, rendered by both adapters.
- Everything must meet WCAG 2.2 AA (contrast 4.5:1 text / 3:1 UI, visible focus, logical focus order) and pass axe. `apps/site` and both demos keep a **Lighthouse accessibility score of 100** — check with chrome-devtools MCP before a UI change is complete.
- Any new interaction gets a keyboard-only spec path, in both adapters.
  </important>
