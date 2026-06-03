# Acres Painting Co. — Estimating & CRM

Internal, single-user (owner: **Koleson**), localhost-only web app for a Philadelphia-suburbs
painting contractor. No authentication. Runs at **http://localhost:3000**.

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript, Turbopack). `params`/`searchParams` are
  **async Promises** — always `await` them in dynamic pages/route handlers.
- **Prisma 6 + SQLite** (`prisma/dev.db`). Client generated to `@prisma/client`.
- **Tailwind CSS v4** + a hand-built design system in `app/globals.css` (dark, glassmorphic,
  emerald accents). Fonts: `DM Serif Display` (headings/brand) + `DM Sans` (body) via
  `next/font/google`.
- **Server Actions** for all mutations (`lib/actions/*`). The only REST endpoint is the XLSX
  export route.
- **xlsx** for spreadsheet export.

## Commands

```bash
npm run dev        # dev server (localhost:3000)
npm run build      # production build
npm run db:seed    # re-run prisma/seed.ts (company, settings, 13 SOPs)
npm run db:reset   # reset DB + reseed (DESTRUCTIVE)
npx prisma studio  # browse the DB
```

After changing `prisma/schema.prisma`: `npx prisma migrate dev --name <name>`.

## Directory structure

```
app/
  layout.tsx                     # root layout, fonts, dark theme
  page.tsx                       # redirects → /dashboard
  globals.css                    # design system (CSS vars, .card/.btn/.input/.badge/...)
  (backoffice)/                  # route group WITH sidebar + ToastProvider
    layout.tsx                   # sidebar + main content shell
    dashboard/                   # pipeline kanban, metrics, follow-ups
    customers/  [id]/            # CRM list + detail (inline edit, follow-ups, linked estimates)
    estimates/  [id]/            # list + 5-tab builder (EstimateBuilder.tsx, builderUI.tsx)
    proposals/  [id]/            # list + estimator proposal detail (status/tier/SOP/email)
    price-book/                  # Paint + Materials/Supplies price book (cost + per-item markup)
    budget/     [estimateId]/    # overview (accepted only) + estimated-vs-actual detail
    settings/                    # 5 tabs: company, business (deposit tiers), email, SOPs, data export
  proposals/[id]/sign/           # PUBLIC client-facing signing page (NO sidebar, light theme)
  api/export/                    # GET ?type=customers|estimates|proposals|all → .xlsx download
components/                      # Sidebar, StatusBadge, Modal, ConfirmDialog, LoadingSpinner,
                                 # EmptyState, TotalsPanel, PageHeader, Toast
lib/
  prisma.ts                      # PrismaClient singleton
  calculations.ts                # PURE calc engine (server + client safe)
  estimateCalc.ts                # ESTIMATE_INCLUDE + computeEstimate(prismaEstimate)
  builderState.ts                # BuilderState type, blank-row factories, buildCalcInput()
  idGenerator.ts                 # customer (A001→Z999→AA001) + EST-/PRO- numbers
  format.ts                      # date/name helpers
  types.ts                       # shared enums + payload types
  actions/                       # customers, estimates, proposals, budget, settings, followups
prisma/
  schema.prisma  seed.ts  migrations/  dev.db
```

## Data model (key relations)

- `Customer` 1—N `Estimate`, 1—N `FollowUpReminder`. Customer numbers are Excel-style IDs.
- `Estimate` owns: `Room` (→ `RoomDeduction`, `AccentWall`), `CabinetSet`, `DeckArea`,
  `ExteriorHouse` (→ `ExteriorDeduction`, `ExteriorReplacement`), `ExteriorDoor`,
  `ExteriorShutter`, `ExteriorGarageDoor`, `OverheadItem`, `EstimateLineItem` (manual custom
  items), and one optional `Proposal`.
- `Proposal` 1—1 `Estimate`. Stores selected tier, `includedSOPs` (JSON int array),
  signature (base64 PNG), timestamps.
- `BudgetEntry` 1—1 `Estimate` (by unique `estimateId`, **no Prisma relation field** — query
  it separately). Estimated columns are derived from the estimate; actual columns are
  hand-entered.
- `ProcedureTemplate` = SOP library. `CompanyProfile`/`BusinessSettings` are singletons (id=1).

## Job Rates (Settings) + per-estimate snapshot

All labor **rates** live in **Settings → Job Rates** (`JobRateSettings` singleton): interior
wall/ceiling/trim, cabinet door/drawer/frame, deck floor/railing/step/lattice, exterior
siding/power-wash, exterior door $/sf, shutter 1st/2nd/3rd-story (+ sqft-per-shutter), garage $/sf,
and labor markup — plus **default paints/stains** (wall/ceiling/trim/siding/door/garage/shutter/
deck-floor/deck-rail). Helpers in `lib/jobRates.ts` (`rowToJobRates`, `rowToPaintDefaults`,
`getCurrentRatesAndDefaults`, `parseRatesSnapshot`).

**Snapshot model:** each `Estimate` stores `ratesSnapshot` (JSON of `JobRates`). `createEstimate`
captures current rates; the builder computes from the snapshot; a **Refresh Rates** button re-pulls
current Settings rates into the snapshot (persisted on Save). Changing a rate in Settings does NOT
alter existing estimates until refreshed. The builder cards have **no rate inputs** — only
dimensions/counts/scopes. Pass `defaults` (PaintDefaults) into every `computeEstimate(est, catalog,
defaults)` call so inherited paints resolve.

## Primer, per-item materials, grouped services (`computeAll`)

- **Primer** is per painted surface: a primer product (Price Book), primer coats (default 1), and a
  `+/- primer sqft adjust` separate from paint sqft. Primer adds **material** (gallons × price) AND
  **labor** at `JobRates.primerRate` ($/sqft on the primed area). Cabinets: primer is material-only
  (per-piece gallons × primer coats; no area to bill labor on).
- **Paint is priced per surface** (gallons rounded up each), not aggregated — so each item's total
  is self-contained and the subtitle can show per-surface gallons.
- **Per-item materials**: every component carries a `materials` JSON column (array of
  `{priceBookItemId,name,unit,quantity,unitCost,markup}`). Their cost rolls into THAT item's total
  and is removed with the item. **Overhead** (`OverheadItem`) stays project-wide; project-wide
  ad-hoc `EstimateLineItem`s remain too.
- **Grouped services**: `computeAll(input)` returns `{ services, lines, totals }`. `services` is one
  `ServiceRow` per item — `{ name, qtyLabel, subtitle, total }` — used by the estimate Summary, the
  client sign page, and the PDF (collapsed "name + total" quote with a gray subtitle). `lines` is the
  flat labor+material list used only for category totals. `computeEstimate(est, catalog, defaults)`
  returns `{ generated, allItems, totals, services }`.
- Delivery: the Zoho email body appends an **interactive sign link** when
  `BusinessSettings.publicBaseUrl` is set (`{publicBaseUrl}/proposals/{id}/sign`) AND attaches the
  PDF. The sign page lets the client pick a tier + draw a signature. publicBaseUrl must point at a
  publicly reachable host/tunnel for clients to open it.

## Calculation engine (`lib/calculations.ts`)

Line items are **never double-stored** — they are regenerated from source components every time
via `generatedLineItems()` / `calcEstimateTotals(input)`. The input carries a `paintCatalog`
(`PaintCatalog`, keyed by PriceBookItem id) built server-side by `lib/priceCatalog.getPaintCatalog()`
and client-side in the builder. Pass it everywhere `computeEstimate(est, catalog)` is called
(dashboard, estimates list, customer detail, proposals, sign page, budget, export, ensureBudgetEntry).

**Labor** (rates come from the snapshot `JobRates`, billed at `laborMarkup`, category Labor):
- Rooms: wall `2*(L+W)*H − openings + wallSqftAdjust`, ceiling `L*W + ceilingSqftAdjust`, trim
  `perimeter + Σ openingTrim + trimLfAdjust`. Manual `+/-` adjusts are **per room, per surface**
  (signed). Openings (door/window/custom) subtract their area from walls; if `includeTrim`, they add
  trim LF (**door = W + 2H**, window/custom = `2(W+H)`). Accent walls are separate lines.
  Cabinets: doors×$door + drawers×$drawer + frames×$frame. Decks: floor $/sf + railing $/lf (toggle) +
  steps $/ea + lattice $/sf (toggle) + power-wash; wood repl = Material. Exteriors: siding area
  `2(L+W)H − deductions + sidingSqftAdjust` (signed +/-) × siding $/sf + power-wash $/sf. Doors:
  `W×H×paintedSides×count × door $/sf`. Shutters: `Σ storyN×storyNrate + customQty×customRate`
  (each shutter = `shutterSqFtEach` for paint). Garage: `W×H×2×count × garage $/sf`. Custom areas:
  amount × rate.

**Paint** (estimated by footage, priced from the Price Book, category Material):
- Gallons = footage × coats ÷ coverage; **trim = linear ft ÷ 2 × coats ÷ coverage**; cabinets use
  per-piece per-coat figures. Needs are **aggregated per paint product across the whole estimate**,
  rounded up to whole gallons, then priced `gallons × cost/gal × (1 + paint markup/100)`.
  Coverage defaults to 400 sf/gal, overridable per paint. Surfaces with no paint selected add labor
  but no paint cost.

**Materials/supplies**: added in the Summary tab from the Price Book → stored as manual
`EstimateLineItem`s (category Material) with the item's own cost + markup and an editable quantity.

- Retail per line = `qty * unitCost * (1 + markup/100)`. Totals bucket by category into
  Labor / Material / Other; overhead added; then discount → tax → grand total.
- Tier pricing: mid/max totals = grand × (1 − discount%), deposit = tierTotal × deposit%.

> Note: estimated "costs" in the budget mirror estimate *retail* category totals. The meaningful
> comparison is **actual revenue vs. actual costs** the owner keys in per job.

## Price Book (`/price-book`)

Two sections — **Paint** (cost/gallon + coverage sf/gal + per-item markup) and **Materials &
Supplies** (cost/unit + unit + per-item markup). Markup varies per item. Paint products are
selectable on every paintable surface/component in the estimate builder via `PaintSelect`;
materials are pulled into an estimate's Summary tab. Actions in `lib/actions/priceBook.ts`.
Editing a Price Book price does not retro-change saved estimates until the estimate is re-saved.

## Key workflows

- **New estimate** → `createEstimate()` (auto EST- number, prefilled from customer) → builder.
  The builder holds all state client-side; **one `saveEstimate()`** replaces all child
  collections in a transaction.
- **Generate proposal** (Summary tab) saves the estimate, then `generateProposal()` (auto PRO-
  number, pre-checks default SOPs) and navigates to the proposal.
- **Acceptance**: setting an estimate OR proposal to **Accepted** (estimator button or client
  signature) calls `ensureBudgetEntry()`, which creates/refreshes the budget entry with estimated
  values. Only `status === "Accepted"` estimates show in the Budget tracker.
- **Client signing** (`/proposals/[id]/sign`): public, light-themed, no sidebar. Vanilla canvas
  signature; on submit saves base64 + printed name, stamps `signedAt`, flips proposal + estimate
  to Accepted, shows a thank-you screen. Re-signing is locked.
- **Proposal email template** lives only in `BusinessSettings.proposalEmailTemplate`, edited in
  Settings → Proposal Email, shown read-only/copyable in the proposal detail. Never hardcoded.

## Job photos

`EstimatePhoto` (estimateId, url, caption, sortOrder) holds reference photos for an estimate.
- Files are uploaded via `POST /api/upload` (multipart) which downscales-on-client first, writes to
  `public/uploads/estimates/`, and returns a `/uploads/...` URL stored in the row. (`public/uploads/`
  is gitignored except `.gitkeep`.)
- Managed in the estimate builder's **Photos** tab (add/caption/reorder/delete); persisted by
  `saveEstimate` (delete+recreate like other children). Photos live on the estimate so they appear
  automatically on the **proposal detail** (read-only gallery) and the **client sign page**
  ("Project Photos" section) — no copying.
- Plain `<img>` tags (not next/image) to avoid image-optimization config.

## Zoho Mail integration

Lets the owner draft a proposal email **into their Zoho mailbox** (review & send from Zoho).
- Config singleton `ZohoConfig` (id=1): region, clientId/secret, refreshToken, accountId, fromAddress,
  connected. Set up in **Settings → Zoho Mail** via a Zoho **Self Client** (clientId/secret +
  authorization code with scope `ZohoMail.accounts.READ,ZohoMail.messages.CREATE`).
- `lib/zoho.ts` — region→host map, `exchangeAuthCode`, `getAccessToken` (refresh→access),
  `getPrimaryAccount`, `createDraft` (POST `…/api/accounts/{accountId}/messages` with `mode:"draft"`).
- `lib/actions/zoho.ts` — `connectZoho`, `updateZohoConfig`, `disconnectZoho`, `testZoho`,
  `createZohoDraft({to,subject,body})`.
- Proposal detail: **Draft to Zoho** button auto-fills `[Client Name]`/`[Project Name]` from the
  estimate, mints a token from the stored refresh token, **generates the proposal PDF, uploads it as
  a Zoho attachment, and creates the draft with the PDF attached** (`createZohoDraft({proposalId,
  to, subject, body})`). Falls back to a "Connect Zoho" CTA when not configured, plus ↓ PDF / Copy
  Text / mailto. Credentials are stored plaintext in SQLite (fine for single-user localhost).
- **Proposal PDF** (`lib/proposalPdf.ts`, `pdfkit`): client-facing PDF with header, scope by
  category + total, pricing tiers (selected highlighted), selected SOPs, terms/exclusions, custom
  note, photos, and a signature/acceptance block. Served at `GET /api/proposals/[id]/pdf` (inline).
  Zoho attachment flow: upload raw bytes to `…/messages/attachments?fileName=` → reference the
  returned `{storeName, attachmentName, attachmentPath}` in the draft's `attachments` array.
  `pdfkit` is in `serverExternalPackages` (next.config) so its bundled font files load at runtime.
  If PDF/upload fails, the draft is still created (text only) and the UI says to attach manually.

## Conventions

- Server actions return `{ success: boolean; error?: string }`; clients surface results via the
  `useToast()` provider (bottom-right toasts).
- Pages that read mutable data set `export const dynamic = "force-dynamic"`.
- Status colors / labels live in `components/StatusBadge.tsx`.
- Desktop-first; mobile is not a priority.
