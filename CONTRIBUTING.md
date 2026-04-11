# Contributing to Society Sim

Thanks for your interest in helping. This project is a browser-based society simulation (TypeScript + Vite + PixiJS). The guidelines below keep reviews fast and the codebase consistent.

## Before you start

- **Bugs & ideas:** Open a [GitHub issue](https://github.com/hoangkhoaa/society-sim/issues) with what you expected, what happened, and how to reproduce (browser, steps). For larger features, a short proposal in an issue first avoids rework.
- **Scope:** Prefer focused changes—one logical fix or feature per pull request unless they are tightly coupled.

## Development setup

```bash
git clone https://github.com/hoangkhoaa/society-sim.git
cd society-sim
npm install
npm run dev          # http://localhost:5173/society-sim/
npm run build        # production build → dist/
npx tsc --noEmit     # type-check only
```

Optional env vars are documented in [`.env.example`](./.env.example) (for example, feature flags like `VITE_ENABLE_MARXIST_PRESET`).

## Code & project conventions

- **Language:** TypeScript. Keep the sim deterministic where it is today unless a change is explicitly about AI or randomness.
- **Style:** Match surrounding files—naming, imports, and structure. Avoid drive-by refactors in unrelated areas.
- **Structure:** See the [Project structure](README.md#-project-structure) section in the README (`src/sim`, `src/engine`, `src/ui`, `src/ai`, etc.).
- **i18n:** User-facing strings that appear in the UI should support English and Vietnamese where the app already does (see `src/i18n.ts` and existing patterns).
- **Tests:** There is no shared test runner in the repo yet; if you add one or extend scripts, document the command in your PR description.

## Pull requests

1. Branch from `main` with a descriptive name (e.g. `fix/map-tooltip`, `feat/press-templates`).
2. Ensure `npm run build` and `npx tsc --noEmit` succeed before opening the PR.
3. Describe **what** changed and **why** in the PR body. Link related issues with `Fixes #123` when applicable.
4. If you change gameplay, UI, or performance in a visible way, a short note or screenshot in the PR helps reviewers.

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project. See [`LICENSE`](./LICENSE) (MIT).

Thank you for contributing.
