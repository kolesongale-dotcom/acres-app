"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  updateCompanyProfile,
  updateBusinessSettings,
  updateProposalEmailTemplate,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  reorderProcedure,
} from "@/lib/actions/settings";
import { connectZoho, updateZohoConfig, disconnectZoho, testZoho } from "@/lib/actions/zoho";
import { updateJobRates } from "@/lib/actions/settings";
import { JobRates } from "@/lib/calculations";
import { PaintDefaults } from "@/lib/types";

export type JobRatesData = JobRates & PaintDefaults;
export interface PaintOpt { id: number; label: string }

const ZOHO_REGIONS = [
  { value: "com", label: "United States (.com)" },
  { value: "eu", label: "Europe (.eu)" },
  { value: "in", label: "India (.in)" },
  { value: "com.au", label: "Australia (.com.au)" },
  { value: "jp", label: "Japan (.jp)" },
  { value: "ca", label: "Canada (.ca)" },
  { value: "sa", label: "Saudi Arabia (.sa)" },
];

export interface ZohoData {
  connected: boolean;
  region: string;
  fromAddress: string;
  accountId: string;
  hasClientId: boolean;
}

export interface Company {
  name: string; email: string; phone: string; address: string; website: string; tagline: string; logoUrl: string;
}
export interface Business {
  globalTaxRate: number; globalMarkupDefault: number; standardTerms: string; standardExclusions: string;
  midDepositPercent: number; midDepositDiscount: number; maxDepositPercent: number; maxDepositDiscount: number;
  publicBaseUrl: string;
  proposalEmailTemplate: string;
  resourceInteriorUrl: string;
  resourceExteriorUrl: string;
  warrantyMonths: number;
}
export interface Procedure {
  id: number; category: string; title: string; description: string; isDefault: boolean; sortOrder: number;
}

const TABS = ["Company Profile", "Business Settings", "Job Rates", "Proposal Email", "Procedures", "Zoho Mail", "Data Export"];

export default function SettingsClient({
  company,
  business,
  procedures,
  zoho,
  jobRates,
  paintOptions,
}: {
  company: Company;
  business: Business;
  procedures: Procedure[];
  zoho: ZohoData;
  jobRates: JobRatesData;
  paintOptions: PaintOpt[];
}) {
  const [tab, setTab] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {TABS.map((t, i) => (
          <button key={t} className={`tab-btn ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <CompanyTab company={company} />}
      {tab === 1 && <BusinessTab business={business} />}
      {tab === 2 && <JobRatesTab jobRates={jobRates} paintOptions={paintOptions} />}
      {tab === 3 && <EmailTab template={business.proposalEmailTemplate} />}
      {tab === 4 && <ProceduresTab procedures={procedures} />}
      {tab === 5 && <ZohoTab zoho={zoho} />}
      {tab === 6 && <ExportTab />}
    </div>
  );
}

function JobRatesTab({ jobRates, paintOptions }: { jobRates: JobRatesData; paintOptions: PaintOpt[] }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(jobRates);
  const num = (k: keyof JobRatesData, v: string) => setForm((f) => ({ ...f, [k]: parseFloat(v) || 0 }));
  const pid = (k: keyof JobRatesData, v: string) => setForm((f) => ({ ...f, [k]: v ? parseInt(v, 10) : null }));

  function save() {
    start(async () => {
      const res = await updateJobRates(form as any);
      if (res.success) { success("Job rates saved."); router.refresh(); } else error(res.error);
    });
  }

  const Rate = ({ label, k, suffix }: { label: string; k: keyof JobRatesData; suffix?: string }) => (
    <F label={label}>
      <div style={{ position: "relative" }}>
        <input type="number" step="any" className="input" value={(form[k] as number) ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => num(k, e.target.value)} style={suffix ? { paddingRight: 40 } : undefined} />
        {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-dim)" }}>{suffix}</span>}
      </div>
    </F>
  );
  const PaintDefault = ({ label, k }: { label: string; k: keyof JobRatesData }) => (
    <F label={label}>
      <select className="select" value={(form[k] as number | null) ?? ""} onChange={(e) => pid(k, e.target.value)}>
        <option value="">— None —</option>
        {paintOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    </F>
  );

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 860 }}>
      <h2 className="section-title" style={{ marginBottom: 6 }}>Job Rates</h2>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 18 }}>
        These labor rates drive every estimate. Each estimate captures a snapshot when built, so changing a rate here only affects new estimates (or existing ones after you hit “Refresh Rates”).
      </p>

      <h3 className="section-title" style={{ marginBottom: 12 }}>Interior</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Rate label="Wall" k="wallRate" suffix="/sf" />
        <Rate label="Ceiling" k="ceilingRate" suffix="/sf" />
        <Rate label="Trim" k="trimRate" suffix="/lf" />
        <Rate label="Labor Markup" k="laborMarkup" suffix="%" />
      </div>

      <h3 className="section-title" style={{ margin: "20px 0 12px" }}>Cabinets</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Rate label="Per Door" k="cabinetDoorRate" suffix="$" />
        <Rate label="Per Drawer" k="cabinetDrawerRate" suffix="$" />
        <Rate label="Per Frame" k="cabinetFrameRate" suffix="$" />
      </div>

      <h3 className="section-title" style={{ margin: "20px 0 12px" }}>Decks</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Rate label="Floor" k="deckFloorRate" suffix="/sf" />
        <Rate label="Railing" k="deckRailingRate" suffix="/lf" />
        <Rate label="Per Step" k="deckStepRate" suffix="$" />
        <Rate label="Lattice" k="deckLatticeRate" suffix="/sf" />
      </div>

      <h3 className="section-title" style={{ margin: "20px 0 12px" }}>Exterior</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Rate label="Siding" k="sidingRate" suffix="/sf" />
        <Rate label="Power Wash" k="powerWashRate" suffix="/sf" />
        <Rate label="Door" k="doorRate" suffix="/sf" />
        <Rate label="Garage Door" k="garageRate" suffix="/sf" />
      </div>

      <h3 className="section-title" style={{ margin: "20px 0 12px" }}>Prep</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Rate label="Primer Application" k="primerRate" suffix="/sf" />
      </div>

      <h3 className="section-title" style={{ margin: "20px 0 12px" }}>Shutters</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Rate label="1st Story (each)" k="shutterStory1Rate" suffix="$" />
        <Rate label="2nd Story (each)" k="shutterStory2Rate" suffix="$" />
        <Rate label="3rd Story (each)" k="shutterStory3Rate" suffix="$" />
        <Rate label="SqFt per Shutter" k="shutterSqFtEach" suffix="sf" />
      </div>

      <hr className="divider" style={{ margin: "24px 0" }} />
      <h3 className="section-title" style={{ marginBottom: 6 }}>Default Paints &amp; Stains</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 0, marginBottom: 14 }}>
        Estimates inherit these unless you pick a specific paint on an item. Manage products in the{" "}
        <a href="/price-book" style={{ color: "var(--accent)" }}>Price Book</a>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <PaintDefault label="House / Wall Paint" k="defaultWallPaintId" />
        <PaintDefault label="Ceiling Paint" k="defaultCeilingPaintId" />
        <PaintDefault label="Trim Paint" k="defaultTrimPaintId" />
        <PaintDefault label="Siding Paint" k="defaultSidingPaintId" />
        <PaintDefault label="Door Paint" k="defaultDoorPaintId" />
        <PaintDefault label="Garage Paint" k="defaultGaragePaintId" />
        <PaintDefault label="Shutter Paint" k="defaultShutterPaintId" />
        <PaintDefault label="Deck Floor Stain" k="defaultDeckFloorStainId" />
        <PaintDefault label="Deck Rail Stain" k="defaultDeckRailStainId" />
      </div>

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-primary" disabled={pending} onClick={save}>{pending ? <LoadingSpinner size={16} /> : "Save Job Rates"}</button>
      </div>
    </div>
  );
}

function ZohoTab({ zoho }: { zoho: ZohoData }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ region: zoho.region || "com", clientId: "", clientSecret: "", code: "", redirectUri: "" });
  const [fromAddress, setFromAddress] = useState(zoho.fromAddress);

  function connect() {
    if (!form.clientId.trim() || !form.clientSecret.trim() || !form.code.trim()) {
      error("Client ID, Client Secret, and the authorization code are required.");
      return;
    }
    start(async () => {
      const res = await connectZoho(form);
      if (res.success) { success("Connected to Zoho Mail."); router.refresh(); }
      else error(res.error);
    });
  }

  if (zoho.connected) {
    return (
      <div className="card animate-fade-in" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="badge" style={{ background: "#166534", color: "#22c55e" }}>● Connected</span>
          <h2 className="section-title" style={{ margin: 0 }}>Zoho Mail</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 0 }}>
          Proposals can now be drafted straight into your Zoho mailbox. Open the proposal, click{" "}
          <strong>Draft to Zoho</strong>, then review &amp; send from Zoho.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 }}>
          <F label="Region"><input className="input" readOnly value={zoho.region} /></F>
          <F label="Account ID"><input className="input" readOnly value={zoho.accountId || "—"} /></F>
        </div>
        <div style={{ marginTop: 14 }}>
          <F label="Send From (your Zoho address)">
            <input className="input" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
          </F>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
            const res = await updateZohoConfig({ fromAddress });
            if (res.success) { success("Saved."); router.refresh(); } else error(res.error);
          })}>{pending ? <LoadingSpinner size={16} /> : "Save Send Address"}</button>
          <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => {
            const res = await testZoho();
            if (res.success) success("Zoho connection works ✓"); else error(res.error);
          })}>Test Connection</button>
          <button className="btn btn-danger" disabled={pending} onClick={() => start(async () => {
            const res = await disconnectZoho();
            if (res.success) { success("Disconnected."); router.refresh(); } else error(res.error);
          })}>Disconnect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 720 }}>
      <h2 className="section-title" style={{ marginBottom: 12 }}>Connect Zoho Mail</h2>
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-primary)" }}>One-time setup (~3 minutes):</strong>
        <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li>Go to <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>api-console.zoho.com</a> and create a <strong>Self Client</strong>.</li>
          <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below.</li>
          <li>In the console&apos;s <strong>Generate Code</strong> tab, paste this scope:
            <code style={{ display: "block", margin: "4px 0", color: "var(--accent)", background: "var(--bg-primary)", padding: "6px 10px", borderRadius: 6 }}>ZohoMail.accounts.READ,ZohoMail.messages.CREATE</code>
            pick a 10-minute duration, click <strong>Create</strong>, and copy the generated code.</li>
          <li>Pick your region, paste the code below, and click <strong>Connect</strong> (codes expire fast — do this promptly).</li>
        </ol>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Data Center / Region">
          <select className="select" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
            {ZOHO_REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </F>
        <F label="Redirect URI (optional)"><input className="input" value={form.redirectUri} onChange={(e) => setForm({ ...form, redirectUri: e.target.value })} placeholder="leave blank for Self Client" /></F>
        <F label="Client ID"><input className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} /></F>
        <F label="Client Secret"><input className="input" type="password" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} /></F>
        <F label="Authorization Code" full><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="paste the generated code" /></F>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={pending} onClick={connect}>
        {pending ? <LoadingSpinner size={16} /> : "Connect Zoho Mail"}
      </button>
    </div>
  );
}

function ExportTab() {
  const exports = [
    { type: "customers", label: "Customer List", desc: "All contacts with status, lead source, and estimate counts." },
    { type: "estimates", label: "Estimate List", desc: "All estimates with project, customer, status, and grand total." },
    { type: "proposals", label: "Proposal List", desc: "All proposals with status, selected tier, totals, and signatures." },
    { type: "invoices", label: "Invoice List", desc: "Invoice #, customer, project, total, amount paid, balance due, due date, status." },
    { type: "payments", label: "Payment History", desc: "Every recorded payment: invoice #, customer, amount, date, and note." },
    { type: "changeorders", label: "Change Order List", desc: "Change order #, estimate/project, description, total, status, signed date." },
    { type: "colorsheets", label: "Color Sheets", desc: "Client color picks: estimate #, customer, project, surface, color name/code, provider." },
    { type: "pricebook", label: "Price Book", desc: "All paint & material items: type, name, brand, unit, cost, markup, coverage, category." },
    { type: "budget", label: "Budget Summary", desc: "Estimated vs. actual revenue, labor, paint, and materials per job." },
    { type: "followups", label: "Follow-Up Reminders", desc: "Customer, due date, note, and completed status." },
    { type: "all", label: "Everything (one workbook)", desc: "Every record type above as separate sheets in one file." },
  ];
  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
    <DataBackupSection />
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 6 }}>Export Data to Excel</h2>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 18 }}>
        Download your records as .xlsx spreadsheets for backup or accounting.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {exports.map((e) => (
          <div key={e.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 2 }}>{e.desc}</div>
            </div>
            <a className="btn btn-secondary" href={`/api/export?type=${e.type}`}>↓ Download</a>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

const BACKUP_TABLE_LABELS: Record<string, string> = {
  companyProfile: "Company Profile", businessSettings: "Business Settings", jobRateSettings: "Job Rates",
  zohoConfig: "Zoho Config", procedureTemplates: "Procedures (SOPs)", priceBookItems: "Price Book",
  customers: "Customers", estimates: "Estimates", rooms: "Rooms", roomDeductions: "Room Openings",
  accentWalls: "Accent Walls", cabinetSets: "Cabinet Sets", deckAreas: "Decks", exteriorHouses: "Exterior Houses",
  exteriorDeductions: "Exterior Openings", exteriorReplacements: "Exterior Replacements", exteriorDoors: "Exterior Doors",
  exteriorShutters: "Shutters", garageDoors: "Garage Doors", overheadItems: "Overhead Items", customAreas: "Custom Areas",
  specialProjects: "Special Projects", specialProjectFiles: "Special Project Files",
  estimateLineItems: "Line Items", estimatePhotos: "Photos", followUpReminders: "Follow-ups", proposals: "Proposals",
  budgetEntries: "Budget Entries", invoices: "Invoices", payments: "Payments", changeOrders: "Change Orders",
  colorSelections: "Color Selections",
};

interface ImportSummary { counts: Record<string, number>; total: number; schemaVersion: string | null; schemaMatch: boolean }

function DataBackupSection() {
  const { success, error } = useToast();
  const router = useRouter();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    try { setLastBackup(localStorage.getItem("acres:lastBackup")); } catch {}
  }, []);

  function markExported() {
    const iso = new Date().toISOString();
    try { localStorage.setItem("acres:lastBackup", iso); } catch {}
    setLastBackup(iso);
  }

  function pickFile(file: File | null | undefined) {
    if (!file) return;
    setSummary(null);
    setPendingFile(file);
    setConfirmOpen(true);
  }

  async function runImport() {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", pendingFile, pendingFile.name);
      const res = await fetch("/api/admin/import", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data as ImportSummary);
        success(`Restored ${data.total} records from backup.`);
        router.refresh();
      } else {
        error(data.error || "Import failed.");
      }
    } catch {
      error("Import failed — could not reach the server.");
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  }

  const restoredRows = summary
    ? Object.entries(summary.counts).filter(([, n]) => n > 0)
    : [];

  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 6 }}>Data Backup</h2>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 18 }}>
        Download a complete copy of your entire database as a single JSON file, or restore from one.
        Keep regular backups — this is your safety net against data loss.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a className="btn btn-primary" href="/api/admin/export" download onClick={markExported}>↓ Export All Data</a>
        <label className="btn btn-secondary" style={{ cursor: importing ? "wait" : "pointer" }}>
          {importing ? <LoadingSpinner size={16} /> : "↑ Import from Backup…"}
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            disabled={importing}
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 12 }}>
        {lastBackup
          ? `Last export on this device: ${new Date(lastBackup).toLocaleString()}`
          : "No backup exported from this device yet."}
      </div>

      {summary && (
        <div style={{ marginTop: 18, padding: "14px 16px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Restored {summary.total} records
            {!summary.schemaMatch && summary.schemaVersion && (
              <span style={{ fontWeight: 500, color: "var(--warning, #f59e0b)", fontSize: 12.5, marginLeft: 8 }}>
                ⚠ backup version {summary.schemaVersion} differs from this app — verify your data.
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "2px 16px" }}>
            {restoredRows.map(([key, n]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-secondary)", padding: "2px 0" }}>
                <span>{BACKUP_TABLE_LABELS[key] ?? key}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{n}</span>
              </div>
            ))}
            {restoredRows.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>No records in this backup.</span>}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        danger
        title="Restore from backup?"
        confirmLabel="Overwrite & Restore"
        message={`This will restore records from "${pendingFile?.name ?? "the file"}" and OVERWRITE any existing records with the same IDs. This cannot be undone. Export a fresh backup first if you're unsure. Continue?`}
        onConfirm={runImport}
        onCancel={() => { setConfirmOpen(false); setPendingFile(null); }}
      />
    </div>
  );
}

function CompanyTab({ company }: { company: Company }) {
  const { success, error } = useToast();
  const [form, setForm] = useState(company);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const set = (k: keyof Company, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function uploadLogo(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { error("Please choose an image file."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("folder", "branding");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) { set("logoUrl", data.url); success("Logo uploaded — click Save Profile to keep it."); }
      else error(data.error || "Upload failed.");
    } catch {
      error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 720 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>Company Profile</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Company Name" full><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></F>
        <F label="Tagline" full><input className="input" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} /></F>
        <F label="Email"><input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} /></F>
        <F label="Phone"><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></F>
        <F label="Website"><input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} /></F>
        <F label="Address"><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></F>
        <F label="Logo" full>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="logo" style={{ height: 56, maxWidth: 200, objectFit: "contain", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 8, padding: 6 }} />
            ) : (
              <div style={{ height: 56, width: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: "var(--text-dim)", background: "var(--bg-secondary)", border: "1px dashed var(--border-light)", borderRadius: 8 }}>No logo</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 220px", minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <label className="btn btn-secondary" style={{ cursor: uploading ? "wait" : "pointer" }}>
                  {uploading ? <LoadingSpinner size={16} /> : form.logoUrl ? "Replace…" : "Upload Logo…"}
                  <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {form.logoUrl && (
                  <button type="button" className="btn btn-ghost" onClick={() => set("logoUrl", "")}>Remove</button>
                )}
              </div>
              <input className="input" placeholder="…or paste an image URL" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
            </div>
          </div>
        </F>
      </div>
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const res = await updateCompanyProfile(form);
          if (res.success) { success("Company profile saved."); router.refresh(); } else error(res.error);
        })}>
          {pending ? <LoadingSpinner size={16} /> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}

function BusinessTab({ business }: { business: Business }) {
  const { success, error } = useToast();
  const [form, setForm] = useState(business);
  const [pending, start] = useTransition();
  const router = useRouter();
  const num = (k: keyof Business, v: string) => setForm((f) => ({ ...f, [k]: parseFloat(v) || 0 }));
  const str = (k: keyof Business, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 760 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>Business Settings</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Default Tax Rate (%)"><input type="number" step="0.01" className="input" value={form.globalTaxRate} onChange={(e) => num("globalTaxRate", e.target.value)} /></F>
        <F label="Default Markup (%)"><input type="number" step="0.01" className="input" value={form.globalMarkupDefault} onChange={(e) => num("globalMarkupDefault", e.target.value)} /></F>
      </div>
      <div style={{ marginTop: 14 }}>
        <F label="Standard Terms"><textarea className="textarea" style={{ minHeight: 110 }} value={form.standardTerms} onChange={(e) => str("standardTerms", e.target.value)} /></F>
      </div>
      <div style={{ marginTop: 14 }}>
        <F label="Standard Exclusions"><textarea className="textarea" style={{ minHeight: 110 }} value={form.standardExclusions} onChange={(e) => str("standardExclusions", e.target.value)} /></F>
      </div>
      <hr className="divider" style={{ margin: "20px 0" }} />
      <h3 className="section-title" style={{ marginBottom: 12 }}>Deposit Discount Tiers</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Mid Deposit (%)"><input type="number" step="0.01" className="input" value={form.midDepositPercent} onChange={(e) => num("midDepositPercent", e.target.value)} /></F>
        <F label="Mid Deposit Discount (%)"><input type="number" step="0.01" className="input" value={form.midDepositDiscount} onChange={(e) => num("midDepositDiscount", e.target.value)} /></F>
        <F label="Max Deposit (%)"><input type="number" step="0.01" className="input" value={form.maxDepositPercent} onChange={(e) => num("maxDepositPercent", e.target.value)} /></F>
        <F label="Max Deposit Discount (%)"><input type="number" step="0.01" className="input" value={form.maxDepositDiscount} onChange={(e) => num("maxDepositDiscount", e.target.value)} /></F>
      </div>
      <hr className="divider" style={{ margin: "20px 0" }} />
      <h3 className="section-title" style={{ marginBottom: 12 }}>Warranty</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Warranty Period (months)"><input type="number" step="1" className="input" value={form.warrantyMonths} onChange={(e) => setForm((f) => ({ ...f, warrantyMonths: Math.max(0, Math.round(parseFloat(e.target.value) || 0)) }))} /></F>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8, marginBottom: 0 }}>
        Warranty runs from a job&apos;s completion date. You&apos;ll get a follow-up reminder 30 days before it expires.
      </p>

      <hr className="divider" style={{ margin: "20px 0" }} />
      <h3 className="section-title" style={{ marginBottom: 6 }}>Client Proposal URL</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 0, marginBottom: 10 }}>
        Public base URL where this app is reachable by clients (e.g. your hosted domain or an ngrok/Cloudflare
        tunnel). The proposal email uses it to link the client to the live, clickable &amp; signable proposal.
        Leave blank to send the PDF only. Example: <code style={{ color: "var(--accent)" }}>https://acres.example.com</code>
      </p>
      <F label="Public Base URL"><input className="input" placeholder="https://…" value={form.publicBaseUrl} onChange={(e) => str("publicBaseUrl", e.target.value)} /></F>

      <hr className="divider" style={{ margin: "20px 0" }} />
      <h3 className="section-title" style={{ marginBottom: 6 }}>Helpful Resources</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 0, marginBottom: 14 }}>
        Reference charts clients can open as a pop-up on their proposal, under &ldquo;Choosing a Paint Line.&rdquo;
        Upload an image for each. Leave blank to hide that link.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ResourceUploadRow label="Interior Paint Lines chart" value={form.resourceInteriorUrl} onChange={(url) => str("resourceInteriorUrl", url)} />
        <ResourceUploadRow label="Exterior Paint Lines chart" value={form.resourceExteriorUrl} onChange={(url) => str("resourceExteriorUrl", url)} />
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const { proposalEmailTemplate, ...rest } = form;
          const res = await updateBusinessSettings(rest);
          if (res.success) { success("Business settings saved."); router.refresh(); } else error(res.error);
        })}>
          {pending ? <LoadingSpinner size={16} /> : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function EmailTab({ template }: { template: string }) {
  const { success, error } = useToast();
  const [value, setValue] = useState(template);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="section-title">Proposal Email Template</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, marginTop: 0, marginBottom: 16 }}>
        This template appears in every proposal. Edit it here to change your default outreach email.
        Variables like <code style={{ color: "var(--accent)" }}>[Project Name]</code> and{" "}
        <code style={{ color: "var(--accent)" }}>[Client Name]</code> are shown as placeholders — fill them in before sending.
      </p>
      {preview ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-body)",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 18,
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--text-secondary)",
            minHeight: 280,
          }}
        >
          {value}
        </pre>
      ) : (
        <textarea className="textarea" style={{ minHeight: 320, fontFamily: "var(--font-body)" }} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const res = await updateProposalEmailTemplate(value);
          if (res.success) { success("Email template saved."); router.refresh(); } else error(res.error);
        })}>
          {pending ? <LoadingSpinner size={16} /> : "Save Template"}
        </button>
      </div>
    </div>
  );
}

function ProceduresTab({ procedures }: { procedures: Procedure[] }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ category: "Preparation", title: "", description: "", isDefault: true });
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function add() {
    if (!form.title.trim()) { error("Title is required."); return; }
    start(async () => {
      const res = await createProcedure(form);
      if (res.success) { success("Procedure added."); setForm({ category: "Preparation", title: "", description: "", isDefault: true }); router.refresh(); }
      else error(res.error);
    });
  }

  return (
    <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-light)" }}>
          <h2 className="section-title">Standard Operating Procedures ({procedures.length})</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {procedures.map((p, i) => (
            <ProcedureRow key={p.id} p={p} first={i === 0} last={i === procedures.length - 1} onDelete={() => setConfirmId(p.id)} />
          ))}
          {procedures.length === 0 && (
            <p style={{ padding: 24, color: "var(--text-dim)", margin: 0 }}>No procedures yet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="section-title" style={{ marginBottom: 14 }}>Add New Procedure</h2>
        <F label="Category">
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {["Preparation", "Application", "Protection", "Cleanup", "General"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </F>
        <div style={{ marginTop: 12 }}>
          <F label="Title"><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></F>
        </div>
        <div style={{ marginTop: 12 }}>
          <F label="Description"><textarea className="textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></F>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
          Pre-select on new proposals
        </label>
        <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} disabled={pending} onClick={add}>
          {pending ? <LoadingSpinner size={16} /> : "+ Add Procedure"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete procedure?"
        message="This removes the SOP from your library. Proposals that already reference it keep their saved selection."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          if (confirmId === null) return;
          const res = await deleteProcedure(confirmId);
          if (res.success) success("Procedure deleted."); else error(res.error);
          setConfirmId(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ProcedureRow({ p, first, last, onDelete }: { p: Procedure; first: boolean; last: boolean; onDelete: () => void }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(p);
  const [, start] = useTransition();

  function move(direction: "up" | "down") {
    start(async () => { await reorderProcedure(p.id, direction); router.refresh(); });
  }
  function saveEdit() {
    start(async () => {
      const res = await updateProcedure(p.id, { category: form.category, title: form.title, description: form.description, isDefault: form.isDefault });
      if (res.success) { success("Procedure updated."); setEditing(false); router.refresh(); } else error(res.error);
    });
  }

  return (
    <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border-light)" }}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <select className="select" style={{ maxWidth: 170 }} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {["Preparation", "Application", "Protection", "Cleanup", "General"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <textarea className="textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} /> Default
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm(p); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>{p.category}</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.title}</span>
              {p.isDefault && <span style={{ fontSize: 11, color: "var(--accent)" }}>• default</span>}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "5px 0 0", lineHeight: 1.5 }}>{p.description}</p>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button className="btn btn-icon btn-ghost btn-sm" disabled={first} onClick={() => move("up")} title="Move up">↑</button>
            <button className="btn btn-icon btn-ghost btn-sm" disabled={last} onClick={() => move("down")} title="Move down">↓</button>
            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setEditing(true)} title="Edit">✎</button>
            <button className="btn btn-icon btn-danger btn-sm" onClick={onDelete} title="Delete">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceUploadRow({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const { success, error } = useToast();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { error("Please choose an image file."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("folder", "resources");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) { onChange(data.url); success(`${label} uploaded — click Save Settings to keep it.`); }
      else error(data.error || "Upload failed.");
    } catch {
      error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} style={{ height: 64, maxWidth: 220, objectFit: "contain", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: 8, padding: 6 }} />
      ) : (
        <div style={{ height: 64, width: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: "var(--text-dim)", background: "var(--bg-secondary)", border: "1px dashed var(--border-light)", borderRadius: 8 }}>No image</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? <LoadingSpinner size={14} /> : value ? "Replace…" : "Upload…"}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
