---
'@constantine-24/treekit-core': patch
'@constantine-24/treekit-angular': patch
'@constantine-24/treekit-react': patch
---

Each package now declares the Node.js versions it supports: `"engines": { "node": ">=20.11" }`. Nothing changes at runtime. npm and pnpm warn when your build runs on an older Node, and installs fail there only if you enable `engine-strict` or use Yarn 1, which enforces `engines` by default.
