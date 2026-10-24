import { DEMO_LINKS } from 'demo-shared';
import { ReactElement } from 'react';

import { CodeTabs } from './code-tabs';
import { CopyCommand } from './copy-command';
import { HeroTree } from './hero-tree';
import { ThemeToggle } from './theme-toggle';

const FEATURES: readonly { title: string; body: string }[] = [
  {
    title: 'Virtualized',
    body: 'Only the rows on screen exist in the DOM — ten thousand nodes, a few dozen elements. Fixed heights built in, measured rows through TanStack Virtual.',
  },
  {
    title: 'Native drag-and-drop',
    body: 'HTML5 drag resolved from the pointer — into, before or after — with an insertion line instead of placeholder rows, so nothing shifts. Accepts drags from outside the tree.',
  },
  {
    title: 'Keyboard drag-and-drop',
    body: 'Grab with Space, step through drop positions with the arrows, drop with Space. Every step is announced to screen readers, and it is the supported path on touch.',
  },
  {
    title: 'Multi-select',
    body: 'Click, ⌃/⌘-click, Shift-click, Shift+arrows and select-all, with anchored ranges — and a drag that starts on a selected row carries the whole selection.',
  },
  {
    title: 'Filter & lazy loading',
    body: 'Filtering keeps the ancestors of every match and never touches expansion state, so clearing it restores the view. Folders can load their children on demand.',
  },
  {
    title: 'Headless, zero dependencies',
    body: 'Five layers you can attach one by one to plain DOM. The core never mutates your data on drop: it reports a DropEvent, and your code decides.',
  },
];

const SHOWCASES: readonly { href: string; title: string; body: string }[] = [
  {
    href: 'react/',
    title: 'React showcase',
    body: 'The full instrument panel on 10,000 rows, built with @constantine-24/treekit-react.',
  },
  {
    href: 'angular/',
    title: 'Angular showcase',
    body: 'The same panel, component for component, built with @constantine-24/treekit-angular.',
  },
  {
    href: DEMO_LINKS.github,
    title: 'Source on GitHub',
    body: 'Documentation, the architecture notes, issues and contributions.',
  },
  {
    href: DEMO_LINKS.npm,
    title: 'Packages on npm',
    body: '@constantine-24/treekit-core, @constantine-24/treekit-react and @constantine-24/treekit-angular — MIT licensed.',
  },
];

/** The landing page: one screen of pitch, a live tree, the feature sheet and the code. */
export function App(): ReactElement {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="./">
          treekit
        </a>
        <nav aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#code">Code</a>
          <a href="react/">React demo</a>
          <a href="angular/">Angular demo</a>
          <a href={DEMO_LINKS.github}>GitHub</a>
        </nav>
        <ThemeToggle />
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="label">Headless · framework-agnostic · zero dependencies</p>
            <h1 id="hero-title">
              A virtualized tree with <em>native</em> drag&#8209;and&#8209;drop.
            </h1>
            <p className="lede">
              treekit renders hierarchies of tens of thousands of rows and lets people rearrange
              them with a mouse or a keyboard. One headless core, with thin adapters for React and
              Angular — or wire it to plain DOM yourself.
            </p>
            <CopyCommand command="npm install @constantine-24/treekit-react" />
            <p className="hint">
              or <code>@constantine-24/treekit-angular</code>,{' '}
              <code>@constantine-24/treekit-core</code>
            </p>
            <div className="cta">
              <a className="button primary" href="react/">
                Open the React demo
              </a>
              <a className="button" href="angular/">
                Angular demo
              </a>
            </div>
          </div>
          <HeroTree />
        </section>

        <section id="features" className="features" aria-labelledby="features-title">
          <h2 id="features-title" className="label">
            Specification
          </h2>
          <ol className="feature-grid">
            {FEATURES.map((feature, index) => (
              <li key={feature.title} className="feature">
                <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="code" className="code" aria-labelledby="code-title">
          <div className="section-head">
            <h2 id="code-title" className="label">
              Quick start
            </h2>
            <p>
              The same file tree three ways. Each adapter takes a <code>TreeState</code> you own,
              and reports drops for you to apply.
            </p>
          </div>
          <CodeTabs />
        </section>

        <section className="showcases" aria-labelledby="showcases-title">
          <h2 id="showcases-title" className="label">
            Go further
          </h2>
          <ul className="showcase-grid">
            {SHOWCASES.map(showcase => (
              <li key={showcase.title}>
                <a className="showcase" href={showcase.href}>
                  <span className="showcase-title">{showcase.title}</span>
                  <span className="showcase-body">{showcase.body}</span>
                  <span className="showcase-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <span>MIT © 2026 Konstantin Penzin</span>
        <span className="spacer" />
        <a href={DEMO_LINKS.github}>GitHub</a>
        <a href={DEMO_LINKS.npm}>npm</a>
      </footer>
    </div>
  );
}
