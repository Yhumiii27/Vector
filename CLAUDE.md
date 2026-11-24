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
- **Delivery 1 (platform and the whole interface on fictitious demo data)**: see `docs/DELIVERY-1.md`.
- **The GitHub repository does not exist yet**: the work is a local repository; the owner creates `Yhumiii27/Vector` (or
  the name chosen at N-1) and pushes it.
- Owner's answers: questionnaire built from `scripts/questionnaire/` by `node norma/outils/questionnaire/build.mjs`
  (`.artifacts/decisions-vector.html`, to be published as an artifact); read its database (collection `answers`) before each
  delivery and apply the answers to `docs/DECISIONS.md`.
- Remaining work: one list for the whole suite in Norma (`reste-a-faire/vector.json`, draft `docs/reste-a-faire-vector.json`
  until Norma adds it, request DN-1).

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
