# Boomkin design

Boomkin presents an open-source DeFi desk for research, position review and strategy testing. Its identity is charcoal, pale paper, acid yellow, Manrope and ruled data. Keep the question, inputs, evidence and next action visible. Source access belongs beside the work.

The visual source of truth is `site/assets/style.css`, the homepage and lab HTML, `site/assets/app.js`, `site/assets/lab.js`, and the documentation template in `scripts/build-site.ts`. Desktop and mobile captures in `.impeccable/review/` establish the composition; current source controls copy and behavior.

## Color and materials

Reuse the existing CSS variables. The homepage alternates dark working surfaces and pale catalog sections; documentation uses the pale surface with dark navigation and footer. This is a content hierarchy, not a user-selectable theme.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#111214` | Main dark canvas |
| `--panel` | `#191a1c` | Workbench surface |
| `--raised` | `#222326` | Raised neutral surface |
| `--fg` | `#f4f5f1` | Primary dark-surface text |
| `--muted` | `#a5a8ac` | Secondary neutral text |
| `--line` | `#333538` | Dark structural dividers |
| `--accent` | `#e7f06a` | Primary actions, brand diamond, strategy line and dark focus |
| `--paper` | `#f3f4ef` | Catalog and documentation canvas |
| `--ink` | `#17181a` | Primary paper-surface text |
| `--paper-muted` | `#5c6061` | Secondary paper-surface text |
| `--paper-line` | `#d4d7d0` | Paper structural dividers |
| `--radius` | `12px` | Workbench, detail and major panel corners |

The lab uses existing blue-gray surfaces and dividers for settings, charts and trade rows. The benchmark is `#71818b`; errors use warm text on a subdued brown surface. Reuse these treatments for the same roles. Reserve broad acid-yellow fills for the primary action. Selected rows use a quiet neutral or pale olive tint.

Use spacing and alignment before containers. Packs and ownership points are ruled rows, metrics are open readouts, and commands get a divider within their parent surface. Major panels use 12px corners, primary buttons 7px, and form controls 6px. The workbench has the site's restrained shadow; other surfaces rely on fill and structure. Avoid decorative gradients, glows or extra badges.

## Typography and layout

Manrope is self-hosted at `site/assets/manrope.ttf`, with variable weights 200–800, `font-display: swap`, and Arial/sans-serif fallbacks. Preserve `site/assets/OFL-Manrope.txt` with the font: it credits the Manrope Project Authors and supplies the SIL Open Font License 1.1. The code's MIT license does not replace the font license. Commands and inline code use the system monospace stack.

| Role | Desktop treatment |
| --- | --- |
| Base | 15px / 1.6 |
| Homepage H1 | `clamp(46px, 5.3vw, 76px)`, weight 550, line height 1.12, tracking −0.04em |
| Section H2 | `clamp(34px, 3.3vw, 48px)`, weight 550, line height 1.2 |
| Hero supporting copy | 18px / 1.8 |
| Workbench and workflow copy | Mostly 11–12px, generous line height |
| Documentation | 14px / 1.9; H1 43px, H2 25px, H3 19px, weight 650 |
| Lab | H1 48px; metric values 24px, weight 550, tabular numerals |

Large headings carry the argument; short supporting paragraphs explain the job. Use balanced headings and compact labels. Keep provenance and technical qualifications near their result, at a secondary reading level. Positive returns retain an explicit plus sign; numeric results state percent, USD or basis-point units.

The common `.wrap` is at most 1240px including 40px side padding. The header has its own 1440px maximum. Homepage sections use approximately 65–105px vertical intervals and two-column compositions where comparison helps. The workbench uses a 210px menu; the workflow explorer pairs a scrolling list with detail; packs form three columns; the lab pairs 290px settings with results. Reuse nearby padding and gaps rather than inventing a spacing scale absent from the stylesheet.

## Controls and evidence

Give each view a clear primary action: set up Boomkin, open the lab, or run a strategy test. Source links and documentation stay quieter and remain easy to find. Primary buttons have a filled acid-yellow surface and dark text; secondary links are text, optionally with a small arrow. Copy controls sit beside the exact command they copy.

The homepage workbench is a **workflow preview**. Its tabs change the curated question, explanation, evidence fields and onboarding command. The prompt bubble is passive text, not a chat input. Research evidence and result readouts must retain passive treatments. Only actual inputs and selects receive the bordered form treatment.

The workflow catalog loads from generated `assets/catalog.json`. Search filters protocol/job rows and updates the result count; selection opens inputs, output, access information, command and guide link. Preserve a usable detail state when returning from an empty search. Empty results and load failures need actionable text and a documentation route. Packs expose their version and a link to the catalog's exact source revision.

The lab is a local browser simulation. Settings use native labeled controls, strategy-specific fields appear only when relevant, and execution assumptions expand in place. Loading disables the run action; submitting runs the selected inputs. The bundled dataset runs once after loading. A failed run clears metrics, chart and trades and disables downloads. A completed run enables report and dataset/rules downloads. Results describe the last completed run; editing a field alone does not rerun the engine.

Copy success and failure use a short polite toast; failed clipboard access gives a manual-copy instruction. Installation, previews and simulations must not imply a connected wallet, live financial execution or future performance. Keep provider authorization language close to any financial-action claim.

## Documentation reading

Use the pale canvas and a maximum 780px prose measure. Desktop documentation has a sticky 230px sidebar, a selected-page tint and a separate source link. Sections follow a readable heading rhythm with 48px before H2s. Commands use dark code blocks; inline code uses a subdued pale fill. Links are underlined, tables have restrained header fill and row dividers, and blockquotes use a single left rule. Build revision and edit-source links belong at the end of the article.

Allow code and tables to scroll within their own containers. Preserve exact commands, schemas and units instead of squeezing them into narrower typography or truncating them. On mobile, replace the sidebar with the labeled documentation select above the article.

## Charts and simulation language

The homepage chart is labeled **Illustrative curves** and has an accessible illustrative description. It carries no measured return claim. Lab plots use the engine's flow-neutral return index, beginning at 100, with dated endpoints and strategy/buy-and-hold labels. Acid yellow identifies the strategy; subdued gray identifies the benchmark. Keep the four outcome metrics, trade log and downloadable report adjacent to the plot.

Every lab result identifies the asset, daily price type, observation count, historical or synthetic status, source and retrieval time. Evidence text also reports trade count, fees and slippage. Distinguish aggregate price marks from venue closes. Synthetic inputs remain explicitly synthetic. The simulation assumes long-only fractional spot, prior-observation decisions, next-observation fills, adverse slippage, fees and a benchmark with the same cash flows. The assumptions and research disclosure must remain reachable near the settings and result.

The SVG has no point tooltip or interactive time-range control. Its accessible label is descriptive; metrics, trade rows and the full JSON report supply inspectable detail. Do not imply that the plot alone provides every data point or validates a source.

## Responsive behavior

| Breakpoint | Existing adaptation |
| --- | --- |
| At or above 1500px | Header side padding increases to 70px; hero top padding to 80px |
| At or below 1050px | Common side padding becomes 30px; columns and gaps tighten; lab metrics become two columns |
| At or below 760px | Side padding becomes 22px; homepage sections stack; workbench tabs become a horizontal scrolling row; low-value header and runtime details disappear; packs remain two columns; documentation uses its select; lab settings stack above results with paired small fields |
| At or below 380px | Hero H1 becomes 39px; navigation, panel padding, pack type and form gaps tighten |

At mobile widths, homepage H1 is normally 46px, documentation H1 33px and lab H1 36px. Trade tables keep a 470px minimum width and documentation tables a 450px minimum inside horizontal scroll containers. Inspect the whole page at desktop and around 390px, plus the narrowest supported width. Controls, long source strings and download actions must remain reachable without page-level overflow.

## Accessibility and motion

Preserve skip links, landmarks, heading order, labeled inputs, table header scopes and descriptive link names. The workbench uses a tablist, selected states, a labeled panel and roving focus with Left/Right, Home and End keys. Workflow selection uses `aria-pressed`; counts, detail updates, lab results and copy feedback use status/live regions, while lab errors use an alert.

Focus is visible with a 2px outline and 5px offset; pale sections use a darker olive focus color. Search also has a visible focus-within underline. Keep labels and text as state cues alongside color. Verify keyboard travel and contrast when adding controls or changing muted text, especially the small chart/provenance labels. The small metadata scale and descriptive SVG label are existing mechanisms, not a claim of a complete accessibility audit.

Motion is limited to smooth anchor scrolling and the brief toast transition. `prefers-reduced-motion` removes transitions and animations and restores automatic scrolling. Preserve that behavior; working state does not need decorative animation.
