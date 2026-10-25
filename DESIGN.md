# Boomkin design

Boomkin is a local DeFi research desk. Keep the question, inputs, evidence and next action visible. The homepage workbench is a labeled workflow preview; the desk and lab perform the actual jobs.

## Source of truth

- Public site: `site/assets/style.css`, `site/index.html`, `site/lab/index.html` and their JavaScript modules.
- Local desk: `desk/`; scoped API and evidence states in [docs/DESK.md](docs/DESK.md).
- Documentation layout and code controls: `scripts/build-site.ts` and `scripts/docs-code.ts`.
- Workflow and pack content: `catalog/`; regenerate [the workflow guide](docs/WORKFLOWS.md) after catalog changes.

Use the existing charcoal, pale paper, acid-yellow actions, Manrope typography and ruled rows. Reuse nearby CSS variables and layout primitives; concrete values live in the stylesheets. Preserve the self-hosted font's SIL license. Use spacing and alignment before adding containers or decoration.

## Interaction and evidence

Give each view one primary action. Keep exact skill sources, input requirements, provider access and copyable commands close to the decision. Search, empty, loading and failure states must offer a useful next step. Keep the desk's saved history and cancellation visible; preserve selected-run identity in comparisons and follow-ups.

Charts and metrics identify their asset, units, source, observation/retrieval time and coverage. Dated examples and synthetic data retain their labels. Missing observations stay unavailable. A preview, simulation or installed procedure does not imply account access, financial execution or future performance.

## Responsive and accessible behavior

Use labeled native controls, visible focus, landmarks and a coherent heading order. Preserve the workbench's keyboard tabs, workflow selection state, live progress and manual copy fallback. Respect reduced motion. Commands, tables and long source identities scroll or wrap inside their content area; mobile pages must not widen to fit them.

After changing UI, inspect affected desktop and mobile views, keyboard travel and error/empty states. Run the native checks and verify the serving revision using [docs/WEBSITE.md](docs/WEBSITE.md). Current rendered behavior is the acceptance surface; old captures are not a separate design authority.
