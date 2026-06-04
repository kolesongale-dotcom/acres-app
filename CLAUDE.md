# Acres Painting Co. — Estimating & CRM

Internal, single-user (owner: **Koleson**), localhost-only web app for a Philadelphia-suburbs
painting contractor. No authentication. Runs at **http://localhost:3000**.

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript, Turbopack). `params`/`searchParams` are
  **async Promises** — always `await` them in dynamic pages/route handlers.
- **Prisma 6 + SQLite**. Datasource url is `env("DATABASE_URL")` — local `file:./dev.db`
  (→ `prisma/dev.db`), cloud `file:/data/dev.db` (on the Railway volume). Client → `@prisma/client`.
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
npm run start      # serve the production build (local)
npm run start:prod # cloud start: prisma migrate deploy + db seed + next start
npm run db:seed    # re-run prisma/seed.ts (company, settings, 13 SOPs) — idempotent
npm run db:reset   # reset DB + reseed (DESTRUCTIVE — never run against the cloud)
npx prisma studio  # browse the DB
```

After changing `prisma/schema.prisma`: `npx prisma migrate dev --name <name>` (commit the
new folder in `prisma/migrations/` — Railway applies it on deploy).

**Env vars** (`.env` locally, Railway service vars in cloud; template in `.env.example`):
`DATABASE_URL` (SQLite path), `APP_PASSWORD` (empty = login OFF; set = login ON),
`AUTH_SECRET` (login cookie value), `UPLOAD_DIR` (where uploads are written).

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

Two sections — **Paint** (cost/gallon + coverage sf/gal + per-item markup + **category**) and
**Materials & Supplies** (cost/unit + unit + per-item markup). Markup varies per item. Paint
products are selectable on every paintable surface/component in the estimate builder via
`PaintSelect` (options grouped by category); materials are pulled into an estimate's Summary tab.
Actions in `lib/actions/priceBook.ts`. Editing a Price Book price does not retro-change saved
estimates until the estimate is re-saved.

**Paint categories** (`PriceBookItem.category`, `PAINT_CATEGORIES` in `lib/types.ts`): Interior
Wall/Ceiling, Interior Trim/Door, Exterior, Cabinet, Deck/Stain, Primer. A surface's category is
*derived from the paint assigned to it* (no per-surface category field). On the client sign page the
client may swap a surface's paint to any Price Book paint **in the same category** — except `Primer`,
which is locked (`CLIENT_SELECTABLE_CATEGORIES`).

## Client-selectable paints on the proposal

The client sign page (`SignFlow.tsx`) lets clients change the paint per surface and watch the price
re-compute live:
- `lib/paintSlots.ts` (client+server safe): `extractPaintSlots(input, catalog)` → one `PaintSlot`
  per painted surface (room walls/ceiling/trim, cabinets, deck floor/rail, siding, doors, shutters,
  garage, custom) whose effective paint's category is client-selectable and has ≥2 options; primer
  slots are never included. `applyPaintSelection(input, ref, paintId)` returns a new calc input.
- `SignFlow` holds the `FullEstimateInput` in state, recomputes `computeAll` + `calcTiers` on every
  change (pure engine → instant), and renders the breakdown, a **Choose Your Paint** section
  (dropdowns showing name + **retail $/gal** = cost×markup), the tiers, and the signature. Static
  sections (photos/notes/SOPs/terms) are passed in as `children` from the server `page.tsx`.
- Persistence: `selectPaintPublic(proposalId, ref, paintId)` (in `lib/actions/proposals.ts`) writes
  the chosen paint to the estimate's component field, after re-deriving the slot to validate
  ownership + **same-category** (anti-tamper) + not-yet-signed. So the accepted proposal, PDF, and
  budget all reflect the client's choices. Coverage differs per paint, so swapping changes gallons.

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
- Files are uploaded via `POST /api/upload` (multipart, downscaled client-side first) and written to
  `UPLOAD_DIR` (default `./uploads`, cloud `/data/uploads` on the volume). The stored `/uploads/...`
  URL is served back by **`app/uploads/[...path]/route.ts`** (NOT static `/public`, so local and cloud
  behave identically). Helpers in `lib/uploads.ts` (`UPLOAD_DIR`, `resolveUploadPath`,
  path-traversal guard). Logos use the same route via the `branding` folder; `proposalPdf.ts` reads
  images through `resolveUploadPath`. `uploads/` is gitignored (data lives on the cloud volume).
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

## Helpful Resources (client proposal pop-ups)

`BusinessSettings.resourceInteriorUrl` / `resourceExteriorUrl` hold two reference-chart images
(uploaded in **Settings → Business Settings → Helpful Resources**, stored in the `resources` upload
folder). On the client sign page (`SignFlow.tsx`), a **"Helpful Resources → Choosing a Paint Line"**
section shows **Interior/Exterior Paint Lines** as underlined links that open the chart in a
**lightbox** (portaled to `document.body`, Esc/✕/click-outside to close — no navigation). The section
and each link auto-hide when its URL is blank. Passed from the sign `page.tsx` as the `resources` prop.

## Sheens (per-surface finish)

Every painted surface stores a **sheen** (`SHEEN_OPTIONS` in `lib/types.ts`: Flat/Matte/Eggshell/
Satin/Semi-gloss/Gloss/Unsure, default "Unsure"). **Purely informational — never affects price.**
Columns live on each component model (Room `wallSheen`/`ceilingSheen`/`trimSheen`; CabinetSet,
ExteriorHouse, ExteriorDoor/Shutter/GarageDoor, CustomArea `sheen`; DeckArea `floorSheen`/`railSheen`).
A `SheenSelect` sits next to every `PaintSelect` in the builder. On the client proposal the sheen is a
dropdown beside each paint picker; `selectSheenPublic` persists it (mapping via `sheenFieldFor` in
`lib/paintSlots.ts`). Sheen is NOT threaded through the calc engine — the sign page passes a
`sheens` map keyed by the slot key (`buildSheens`).

## Invoices (`/invoices`)

`Invoice` (1—1 with an accepted `Estimate` by unique `estimateId`, **no Prisma relation** — query
separately, like BudgetEntry) + `Payment` (N per invoice). **Create Invoice** button on an Accepted
proposal → `generateInvoice(estimateId)` mints `INV-0001`, snapshots the **accepted-tier total**
(`subtotal` = full grand total, `total` = tier price) + an itemized `lineItemsJson` (the services
breakdown + overhead) so the invoice is a stable document. Default due date = +14 days (editable).
- Status is **derived** (`lib/invoiceStatus.ts`): Paid / Partial / Unpaid / Overdue from total vs.
  sum(payments) vs. due date. No status column.
- Payments are logged manually (`addPayment`: amount + date + note; supports deposit → balance and
  extra partials). Paid = Σ payments; remaining = total − paid.
- PDF: `lib/invoicePdf.ts` (pdfkit, mirrors proposalPdf) at `GET /api/invoices/[id]/pdf`. Zoho:
  `createZohoInvoiceDraft` (attaches the invoice PDF), mirroring the proposal Zoho flow.
- Actions in `lib/actions/invoices.ts`. Detail page: line items, payments, due-date + notes editors,
  ↓ PDF, Draft to Zoho, Delete.

## Cloud deployment (Railway) + auth

The app is single-user localhost by default but is **cloud-deployable to Railway** so the owner
can use it on a phone with the PC off (see `DEPLOY.md` for the click-by-click guide). Design:
- **Persistence:** keeps SQLite — a Railway **volume** mounted at `/data` holds both the DB
  (`DATABASE_URL=file:/data/dev.db`) and uploads (`UPLOAD_DIR=/data/uploads`). Redeploys never
  touch the volume; `start:prod` runs `prisma migrate deploy` (applies new migrations, no reset) then
  the **idempotent** seed (singletons via `upsert {update:{}}`; lists only seed when empty — safe to
  run every deploy) then `next start`. `postinstall` runs `prisma generate`. `tsx` is a runtime dep
  (seed runs at startup).
- **Auth:** `middleware.ts` gates the back office. **OFF when `APP_PASSWORD` is empty** (local default),
  **ON when set** (cloud). Public without login: `/login`, `/uploads/*`, `/_next/*`, and
  `/proposals/<id>/sign` (clients must reach + e-sign without an account). Login (`lib/actions/auth.ts`)
  checks the password, sets an httpOnly cookie `acres_session` = `AUTH_SECRET`; middleware compares it.
  Env is read at **runtime** (verified), so setting vars on Railway works without rebuild. Sidebar shows
  a "Sign out" button only when auth is enabled (`authEnabled()` passed from the backoffice layout).
- **Config:** `railway.json` (NIXPACKS, `startCommand: npm run start:prod`); `next.config.ts`
  `serverActions.allowedOrigins` includes `*.up.railway.app`. Code lives in git (branch `main`),
  pushed to a private GitHub repo; **deploy = git push** (Railway auto-builds).
- **Local vs cloud are separate databases** by design (dev sandbox vs. real data).

## Conventions

- Server actions return `{ success: boolean; error?: string }`; clients surface results via the
  `useToast()` provider (bottom-right toasts).
- Pages that read mutable data set `export const dynamic = "force-dynamic"`.
- Status colors / labels live in `components/StatusBadge.tsx`.
- Desktop-first; mobile is not a priority.
