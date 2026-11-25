@norma/REGLES.md

The line above imports the suite's common rules (Norma, versioned copy in `norma/`, `norma/VERSION`): they change in the
`Yhumiii27/Norma` repository only, never here (`npm run norma:check` refuses a modified copy). The rules below are Vector's own.

@AGENTS.md

# Vector — instructions for Claude sessions

Vector (working name, question N-1) is the group's tool for the **shipping manager** (domestic and international
shipments): shipment requests (project, purchase order, spare part, site return), shipments and their packages (crates,
dimensions, weights, HS codes, origin, value, dangerous goods), carriers and forwarders with their performance, RFQs and
award, booking and cut-offs, export customs and compliance (dual use, sanctions), the document checklist and the documents
(filed in Codex, Vector keeps references only), tracking milestones and ETA, incidents and claims, proof of delivery, costs
(estimated, quoted, invoiced, allocation) and KPIs.

## Where the project stands

- **Delivery 0 (framing) is done** (24 Nov 2026): `docs/BENCHMARK.md`, `docs/spec/00`–`07`, `docs/DECISIONS.md` (questions
  with a default answer, applied until answered), `docs/PLAN.md`, `docs/DONNEES.md` + `docs/donnees/*.csv`, `docs/DEMANDES.md`
  (drafts only: nothing is sent to another tool without the owner's « validé »).
- **Delivery 1 (platform and the whole interface on fictitious demo data) is built** (`docs/DELIVERY-1.md`, `docs/SOCLE.md`):
  platform from Clavis `main` `5a6026b`, sign-in through Clavis from Crucible, shell of Norma 2.0 (below); schema `src/server/db/schema/`
  (every column constrained); pure rules `src/domain/` (`shipment-state.ts`, `packing.ts`, `incoterms.ts`, `documents.ts`,
  `eta.ts`, `costs.ts`, `quotes.ts`, `compliance.ts`, `claims.ts`, `kpi.ts`); reads `src/server/dal/world.ts` (`loadWorld`:
  the visibility rule, every figure computed on read); writes `src/features/shipping/actions.ts` (through
  `src/server/shipping/write.ts`); side-panel forms `src/features/shipping/forms.tsx`; reference queries of the publications
  `src/server/publications/definitions.ts`; simulated connectors `src/server/integrations/` (outbox, tracking).
- Repository `Yhumiii27/vector` (created by the owner, 24 Nov 2026); delivery 1 is on the branch `claude/quirky-brown-c7af5m`.
- Norma 2.1.0 registers `vector` (request DN-1 done, 24 Nov 2026): `npm run norma:check` passes and runs in CI.
- **Common shell of Norma 2.0** (`norma/charte/COQUE.md`, binding; item VE-N01): `AppShell` + `MobileTopBar` (menu button up
  to 1024 px) in `src/app/(app)/layout.tsx`, `Sidebar` / `PageSearch` / `NavSection` / `NavEntry` of `@norma/charte/ds` in
  `src/components/app/shell/sidebar.tsx`, `PageHeader` of the charter (breadcrumb without "Vector", one 26 px `<h1>`, actions
  with the main one rightmost and the "Actions" menu beyond three, `useHeaderMenu`) in `page-header.tsx`, and the language /
  display pair `PrefsStack` (`prefs.tsx`: FR | EN over dark | light, same size) as the last element of every page header and
  of the top bar, nowhere else. `touch.css` then `coque.css` are imported after `nocturne.css`; period navigation and
  filters go in the header's `toolbar` (`FilterBar`); sizes come from the `--text-*` tokens.
- **Logo, Norma 2.3.0** (owner, 25 Nov 2026; `norma/charte/COQUE.md` § 8 bis): the brand of the sidebar and of the top bar is the
  charter's `ToolLogo code="vector"` (`@norma/charte/ds/ToolLogo`, 26 px, 20 px in the top bar), also on the pages outside the shell
  (sign-in…); the favicon is `src/app/icon.svg`, a copy of `norma/charte/logos/vector.svg` (checked by `src/app/icon.test.ts`).
- Owner's answers: questionnaire built from `scripts/questionnaire/` by `node norma/outils/questionnaire/build.mjs`
  (`.artifacts/decisions-vector.html`, to be published as an artifact); read its database (collection `answers`) before each
  delivery and apply the answers to `docs/DECISIONS.md`.
- Remaining work: one list for the whole suite in Norma (`reste-a-faire/vector.json` in `Yhumiii27/Norma`), shown on the
  global page https://claude.ai/artifact/Rs7kooJdowShdYUqNS8jQf; Vector keeps no list of its own.

## Rules specific to Vector

- **Keystone owns projects, BOM, deliverables, site reception and punch items; Vector owns shipments** (transition proposal
  `docs/spec/05-echanges.md` § 4, question T-1). Never modify Keystone or any other repository; requests go to
  `docs/DEMANDES.md`.
- **Codex hosts every document**: Vector stores no file, only Codex references.
- **Computed, never stored**: packing totals, chargeable weight, fill rate, missing documents, delay, current ETA, cost
  variance, carrier scores and KPIs (`src/domain/`).
- **Values and costs** are shown only to the roles of question U-2 (`canSeeValues`).
- **No external call** (tracking APIs, carrier portals, sanctions lists, exchange rates): connectors are simulations or
  outboxes under `src/server/integrations/<tool>/` until the IT department validates them.
- Demo data are fictitious: never a real person, company, mine or project name.
- Ports on the owner's Mac: **3900** (Vector) and **3910** (tests). Never use or kill another tool's port of Norma's registry.
- Commit messages in English.

## Setup and checks

```bash
npm ci && npm run db:local && npm run db:migrate   # .env.local: see .env.example (database vector_dev, PostgreSQL only)
npx next typegen && npm run typecheck && npm run lint && npm test
npm run dev                                         # http://localhost:3900 (demo: "View as")
VECTOR_DIST_DIR=.next-ci npm run build && VECTOR_DIST_DIR=.next-ci npx next start --port 3910 & npm run test:smoke
node norma/outils/questionnaire/build.mjs           # .artifacts/decisions-vector.html (owner's questionnaire)
```
