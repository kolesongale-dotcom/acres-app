"use client";

import { useMemo, useState, useTransition, Dispatch, SetStateAction, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import TotalsPanel from "@/components/TotalsPanel";
import { useToast } from "@/components/Toast";
import { saveEstimate } from "@/lib/actions/estimates";
import { generateProposal } from "@/lib/actions/proposals";
import { ESTIMATE_STATUSES, SIDING_MATERIALS, LINE_CATEGORIES, MaterialCatalogEntry, PaintDefaults, ItemMaterialPayload } from "@/lib/types";
import { calcEstimateTotals, calcTiers, formatCurrency, formatNumber, JobRates, PaintCatalog, ServiceRow, perimeterFeet, solvePerimeter } from "@/lib/calculations";
import {
  BuilderState, buildCalcInput, blankRoom, blankCabinet, blankDeck, blankExteriorHouse,
  blankDoor, blankShutter, blankGarage, blankCustomArea, blankSpecialProject, blankLineItem, blankOverhead, blankMaterial,
} from "@/lib/builderState";
import { Labeled, NumberField, TextField, Toggle, CardHeader, PaintSelect, PaintOption, SheenSelect } from "./builderUI";

interface CustomerOption { id: number; label: string }
interface TierConfig { midDepositPercent: number; midDepositDiscount: number; maxDepositPercent: number; maxDepositDiscount: number }

const TABS = ["Setup", "Rooms", "Cabinets", "Decks & Exteriors", "Special Projects", "Photos", "Summary"];

function warrantyEndLabel(completedAt: string, months: number): string {
  const d = new Date(completedAt + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  d.setMonth(d.getMonth() + Math.max(0, Math.round(months)));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale); height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

function listOps<T extends object>(setter: Dispatch<SetStateAction<T[]>>) {
  return {
    update: (i: number, patch: Partial<T>) => setter((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x))),
    add: (item: T) => setter((arr) => [...arr, item]),
    remove: (i: number) => setter((arr) => arr.filter((_, idx) => idx !== i)),
    move: (i: number, dir: "up" | "down") => setter((arr) => {
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
    }),
  };
}

export default function EstimateBuilder({
  estimateId, estimateNumber, initial, customers, tierConfig, hasProposal, proposalId,
  paintItems, materialItems, currentRates, defaults, warrantyMonths = 24,
}: {
  estimateId: number; estimateNumber: string; initial: BuilderState; customers: CustomerOption[];
  tierConfig: TierConfig; hasProposal: boolean; proposalId: number | null;
  paintItems: PaintOption[]; materialItems: MaterialCatalogEntry[]; currentRates: JobRates; defaults: PaintDefaults;
  warrantyMonths?: number;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [tab, setTab] = useState(0);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const [setup, setSetup] = useState(initial.setup);
  const [rates, setRates] = useState(initial.rates);
  const [rooms, setRooms] = useState(initial.rooms);
  const [cabinets, setCabinets] = useState(initial.cabinetSets);
  const [decks, setDecks] = useState(initial.deckAreas);
  const [houses, setHouses] = useState(initial.exteriorHouses);
  const [doors, setDoors] = useState(initial.exteriorDoors);
  const [shutters, setShutters] = useState(initial.exteriorShutters);
  const [garages, setGarages] = useState(initial.garageDoors);
  const [customAreas, setCustomAreas] = useState(initial.customAreas);
  const [specialProjects, setSpecialProjects] = useState(initial.specialProjects);
  const [spUploadingIdx, setSpUploadingIdx] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState(initial.lineItems);
  const [overhead, setOverhead] = useState(initial.overheadItems);
  const [photos, setPhotos] = useState(initial.photos);
  const [uploading, setUploading] = useState(false);

  const markDirty = () => setDirty(true);
  const wrap = <T,>(s: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> => (v) => { markDirty(); s(v); };

  const roomOps = listOps(wrap(setRooms));
  const cabOps = listOps(wrap(setCabinets));
  const deckOps = listOps(wrap(setDecks));
  const houseOps = listOps(wrap(setHouses));
  const doorOps = listOps(wrap(setDoors));
  const shutterOps = listOps(wrap(setShutters));
  const garageOps = listOps(wrap(setGarages));
  const caOps = listOps(wrap(setCustomAreas));
  const spOps = listOps(wrap(setSpecialProjects));
  const liOps = listOps(wrap(setLineItems));
  const ohOps = listOps(wrap(setOverhead));
  const photoOps = listOps(wrap(setPhotos));

  const setSetupField = <K extends keyof typeof setup>(k: K, v: (typeof setup)[K]) => { markDirty(); setSetup((s) => ({ ...s, [k]: v })); };

  const paintCatalog: PaintCatalog = useMemo(() => {
    const c: PaintCatalog = {};
    for (const p of paintItems) c[p.id] = { name: p.name, unitCost: p.unitCost, coverage: p.coverage, markup: p.markup, category: p.category };
    return c;
  }, [paintItems]);

  const state: BuilderState = {
    setup, rates, rooms, cabinetSets: cabinets, deckAreas: decks, exteriorHouses: houses,
    exteriorDoors: doors, exteriorShutters: shutters, garageDoors: garages,
    customAreas, specialProjects, lineItems, overheadItems: overhead, photos,
  };

  const { services, totals } = useMemo(() => calcEstimateTotals(buildCalcInput(state, paintCatalog, defaults)), [state, paintCatalog, defaults]);
  const svcByKey = useMemo(() => { const m = new Map<string, ServiceRow>(); for (const s of services) m.set(s.key, s); return m; }, [services]);
  const itemTotal = (key: string) => svcByKey.get(key)?.total ?? 0;
  const tiers = useMemo(() => calcTiers(totals.grandTotal, tierConfig), [totals.grandTotal, tierConfig]);
  const ratesDiffer = useMemo(() => JSON.stringify(rates) !== JSON.stringify(currentRates), [rates, currentRates]);

  function refreshRates() { setRates(currentRates); markDirty(); success("Rates refreshed from Settings — Save to keep."); }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          const blob = await downscaleImage(file);
          const fd = new FormData(); fd.append("file", blob, "photo.jpg");
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (res.ok && data.url) photoOps.add({ url: data.url, caption: "", sortOrder: 0 });
          else error(data.error || "Upload failed.");
        } catch { error(`Could not process ${file.name}.`); }
      }
      success("Photos added — remember to Save.");
    } finally { setUploading(false); }
  }

  async function uploadSpecialFiles(idx: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setSpUploadingIdx(idx);
    const added: { url: string; caption: string; fileType: string }[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const isImage = file.type.startsWith("image/");
          const fd = new FormData();
          fd.append("folder", "special");
          if (isImage) { const blob = await downscaleImage(file); fd.append("file", blob, "photo.jpg"); }
          else { fd.append("file", file, file.name); }
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (res.ok && data.url) added.push({ url: data.url, caption: isImage ? "" : file.name, fileType: data.fileType ?? (isImage ? "image" : "file") });
          else error(data.error || "Upload failed.");
        } catch { error(`Could not upload ${file.name}.`); }
      }
      if (added.length) {
        spOps.update(idx, { files: [...(specialProjects[idx]?.files ?? []), ...added] });
        success("Attachment(s) added — remember to Save.");
      }
    } finally { setSpUploadingIdx(null); }
  }

  function doSave(): Promise<boolean> {
    return new Promise((resolve) => {
      start(async () => {
        const res = await saveEstimate({ id: estimateId, ...state });
        if (res.success) { success("Estimate saved."); setDirty(false); router.refresh(); resolve(true); }
        else { error(res.error); resolve(false); }
      });
    });
  }
  async function handleGenerateProposal() {
    const ok = await doSave(); if (!ok) return;
    start(async () => {
      const res = await generateProposal(estimateId);
      if (res.success && res.data) router.push(`/proposals/${res.data.id}`);
      else if (!res.success) error(res.error);
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Link href="/estimates" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>← All Estimates</Link>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">{setup.projectName || "Untitled Project"}</h1>
            <StatusBadge status={setup.status} />
          </div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0" }}>
            {estimateNumber} · Grand Total <span style={{ color: "var(--accent)", fontWeight: 700 }}>{formatCurrency(totals.grandTotal)}</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={doSave} disabled={pending}>
          {pending ? <LoadingSpinner size={16} /> : dirty ? "Save" : "Saved ✓"}
        </button>
      </div>

      <div className="card card-tight" style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderColor: ratesDiffer ? "var(--warning)" : "var(--border-light)" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          💲 Snapshot of your Job Rates. {ratesDiffer ? <span style={{ color: "var(--warning)" }}>Master rates changed in Settings.</span> : <span style={{ color: "var(--text-dim)" }}>In sync.</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/settings" className="btn btn-ghost btn-sm">Edit Job Rates</Link>
          <button className="btn btn-secondary btn-sm" onClick={refreshRates} disabled={!ratesDiffer}>↻ Refresh Rates</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map((t, i) => <button key={t} className={`tab-btn ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      {paintItems.length === 0 && tab !== 0 && (
        <div className="card card-tight" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
          <span style={{ color: "var(--warning)", fontSize: 13.5 }}>⚠ No paint products in your <Link href="/price-book" style={{ color: "var(--accent)" }}>Price Book</Link> yet.</span>
        </div>
      )}

      <div className="animate-fade-in">
        {/* SETUP */}
        {tab === 0 && (
          <div className="card" style={{ maxWidth: 860 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Project Setup</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Labeled label="Customer">
                <select className="select" value={setup.customerId ?? ""} onChange={(e) => setSetupField("customerId", e.target.value ? parseInt(e.target.value, 10) : null)}>
                  <option value="">— No customer linked —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Labeled>
              <Labeled label="Project Name"><TextField value={setup.projectName} onChange={(v) => setSetupField("projectName", v)} placeholder="e.g. Whole Home Repaint" /></Labeled>
              <Labeled label="Street"><TextField value={setup.street} onChange={(v) => setSetupField("street", v)} /></Labeled>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <Labeled label="City"><TextField value={setup.city} onChange={(v) => setSetupField("city", v)} /></Labeled>
                <Labeled label="State"><TextField value={setup.state} onChange={(v) => setSetupField("state", v)} /></Labeled>
                <Labeled label="Zip"><TextField value={setup.zip} onChange={(v) => setSetupField("zip", v)} /></Labeled>
              </div>
              <Labeled label="Status">
                <select className="select" value={setup.status} onChange={(e) => setSetupField("status", e.target.value)}>
                  {ESTIMATE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Labeled>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Labeled label="Start"><input type="date" className="input" value={setup.startDate ?? ""} onChange={(e) => setSetupField("startDate", e.target.value || null)} /></Labeled>
                <Labeled label="End"><input type="date" className="input" value={setup.endDate ?? ""} onChange={(e) => setSetupField("endDate", e.target.value || null)} /></Labeled>
                <Labeled label="Days"><NumberField value={setup.durationDays} min={0} onChange={(v) => setSetupField("durationDays", v)} /></Labeled>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <Labeled label="Completed On"><input type="date" className="input" value={setup.completedAt ?? ""} onChange={(e) => setSetupField("completedAt", e.target.value || null)} /></Labeled>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <span className="label">Warranty Ends</span>
                  <div style={{ fontSize: 13.5, color: setup.completedAt ? "var(--accent)" : "var(--text-dim)", paddingTop: 6 }}>
                    {setup.completedAt ? warrantyEndLabel(setup.completedAt, warrantyMonths) : "— set completion date —"}
                  </div>
                </div>
              </div>
            </div>
            <hr className="divider" style={{ margin: "22px 0" }} />
            <h3 className="section-title" style={{ marginBottom: 12 }}>Tax &amp; Discount</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Labeled label="Tax Rate" width={140}><NumberField value={setup.taxRate} onChange={(v) => setSetupField("taxRate", v)} suffix="%" /></Labeled>
              <Labeled label="Discount Type" width={180}>
                <select className="select" value={setup.discountType} onChange={(e) => setSetupField("discountType", e.target.value)}>
                  <option value="none">None</option><option value="percent">Percentage</option><option value="flat">Flat Amount</option>
                </select>
              </Labeled>
              {setup.discountType !== "none" && (
                <Labeled label={setup.discountType === "percent" ? "Percent" : "Amount"} width={160}>
                  <NumberField value={setup.discountValue} onChange={(v) => setSetupField("discountValue", v)} suffix={setup.discountType === "percent" ? "%" : "$"} />
                </Labeled>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 14 }}>Labor rates &amp; default paints come from <Link href="/settings" style={{ color: "var(--accent)" }}>Settings → Job Rates</Link>.</p>
            <hr className="divider" style={{ margin: "22px 0" }} />
            <Labeled label="Notes"><textarea className="textarea" value={setup.notes} onChange={(e) => setSetupField("notes", e.target.value)} /></Labeled>
          </div>
        )}

        {/* ROOMS */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div>
              <SectionToolbar label={`${rooms.length} room${rooms.length === 1 ? "" : "s"}`} onAdd={() => roomOps.add({ ...blankRoom(), name: `Room ${rooms.length + 1}` })} addLabel="+ Add Room" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {rooms.map((room, i) => (
                  <div key={i} className="card">
                    <CardHeader name={room.name} onName={(v) => roomOps.update(i, { name: v })} onMoveUp={i > 0 ? () => roomOps.move(i, "up") : undefined} onMoveDown={i < rooms.length - 1 ? () => roomOps.move(i, "down") : undefined} onDelete={() => roomOps.remove(i)} />
                    <ModeToggle
                      mode={room.measureMode}
                      onSimple={() => roomOps.update(i, { measureMode: "simple" })}
                      onPerimeter={() => roomOps.update(i, { measureMode: "perimeter", walls: (room.walls?.length ?? 0) >= 3 ? room.walls : seedWallsFromRect(room.length, room.width) })}
                    />
                    {room.measureMode === "perimeter" ? (
                      <PerimeterWalls walls={room.walls ?? []} height={room.height} onWalls={(w) => roomOps.update(i, { walls: w })} onHeight={(v) => roomOps.update(i, { height: v })} />
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        <Labeled label="Length"><NumberField value={room.length} onChange={(v) => roomOps.update(i, { length: v })} suffix="ft" /></Labeled>
                        <Labeled label="Width"><NumberField value={room.width} onChange={(v) => roomOps.update(i, { width: v })} suffix="ft" /></Labeled>
                        <Labeled label="Height"><NumberField value={room.height} onChange={(v) => roomOps.update(i, { height: v })} suffix="ft" /></Labeled>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
                      <Labeled label="Manual Wall SqFt (+/-)"><NumberField value={room.wallSqftAdjust} onChange={(v) => roomOps.update(i, { wallSqftAdjust: v })} /></Labeled>
                      <Labeled label="Manual Ceiling SqFt (+/-)"><NumberField value={room.ceilingSqftAdjust} onChange={(v) => roomOps.update(i, { ceilingSqftAdjust: v })} /></Labeled>
                      <Labeled label="Manual Trim LF (+/-)"><NumberField value={room.trimLfAdjust} onChange={(v) => roomOps.update(i, { trimLfAdjust: v })} /></Labeled>
                    </div>
                    <div style={{ display: "flex", gap: 16, margin: "16px 0", flexWrap: "wrap" }}>
                      <SurfaceControl label="Walls" on={room.paintWalls} onToggle={(v) => roomOps.update(i, { paintWalls: v })} coats={room.wallCoats} onCoats={(v) => roomOps.update(i, { wallCoats: v })} paintId={room.wallPaintId} onPaint={(id, name) => roomOps.update(i, { wallPaintId: id, wallProduct: name })} paintOptions={paintItems} sheen={room.wallSheen} onSheen={(v) => roomOps.update(i, { wallSheen: v })}
                        primerPaintId={room.wallPrimerPaintId} primerCoats={room.wallPrimerCoats} primerSqftAdjust={room.wallPrimerSqftAdjust} onPrimer={(p) => roomOps.update(i, { wallPrimerPaintId: p.paintId, wallPrimerCoats: p.coats, wallPrimerSqftAdjust: p.sqftAdjust })} />
                      <SurfaceControl label="Ceiling" on={room.paintCeiling} onToggle={(v) => roomOps.update(i, { paintCeiling: v })} coats={room.ceilingCoats} onCoats={(v) => roomOps.update(i, { ceilingCoats: v })} paintId={room.ceilingPaintId} onPaint={(id, name) => roomOps.update(i, { ceilingPaintId: id, ceilingProduct: name })} paintOptions={paintItems} sheen={room.ceilingSheen} onSheen={(v) => roomOps.update(i, { ceilingSheen: v })}
                        primerPaintId={room.ceilingPrimerPaintId} primerCoats={room.ceilingPrimerCoats} primerSqftAdjust={room.ceilingPrimerSqftAdjust} onPrimer={(p) => roomOps.update(i, { ceilingPrimerPaintId: p.paintId, ceilingPrimerCoats: p.coats, ceilingPrimerSqftAdjust: p.sqftAdjust })} />
                      <SurfaceControl label="Trim" on={room.paintTrim} onToggle={(v) => roomOps.update(i, { paintTrim: v })} coats={room.trimCoats} onCoats={(v) => roomOps.update(i, { trimCoats: v })} paintId={room.trimPaintId} onPaint={(id, name) => roomOps.update(i, { trimPaintId: id, trimProduct: name })} paintOptions={paintItems} sheen={room.trimSheen} onSheen={(v) => roomOps.update(i, { trimSheen: v })}
                        primerPaintId={room.trimPrimerPaintId} primerCoats={room.trimPrimerCoats} primerSqftAdjust={room.trimPrimerSqftAdjust} onPrimer={(p) => roomOps.update(i, { trimPrimerPaintId: p.paintId, trimPrimerCoats: p.coats, trimPrimerSqftAdjust: p.sqftAdjust })} />
                    </div>
                    <Openings room={room} onChange={(d) => roomOps.update(i, { deductions: d })} />
                    <SubList title="Accent Walls" items={room.accentWalls} onAdd={() => roomOps.update(i, { accentWalls: [...room.accentWalls, { label: "Accent Wall", length: 10, height: room.height, coats: 2, product: "", paintId: null }] })} addLabel="+ Accent Wall"
                      render={(a, ai) => (<>
                        <input className="input" style={{ flex: 2, minWidth: 120 }} value={a.label} onChange={(e) => roomOps.update(i, { accentWalls: room.accentWalls.map((x, xi) => xi === ai ? { ...x, label: e.target.value } : x) })} />
                        <MiniNum value={a.length} onChange={(v) => roomOps.update(i, { accentWalls: room.accentWalls.map((x, xi) => xi === ai ? { ...x, length: v } : x) })} suffix="L" />
                        <MiniNum value={a.height} onChange={(v) => roomOps.update(i, { accentWalls: room.accentWalls.map((x, xi) => xi === ai ? { ...x, height: v } : x) })} suffix="H" />
                        <MiniNum value={a.coats} onChange={(v) => roomOps.update(i, { accentWalls: room.accentWalls.map((x, xi) => xi === ai ? { ...x, coats: Math.round(v) } : x) })} suffix="ct" />
                        <div style={{ flex: 2, minWidth: 150 }}><PaintSelect options={paintItems} value={a.paintId} onChange={(id, name) => roomOps.update(i, { accentWalls: room.accentWalls.map((x, xi) => xi === ai ? { ...x, paintId: id, product: name } : x) })} placeholder="Default (House Paint)" /></div>
                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => roomOps.update(i, { accentWalls: room.accentWalls.filter((_, xi) => xi !== ai) })}>✕</button>
                      </>)} />
                    <MaterialsEditor materials={room.materials} onChange={(m) => roomOps.update(i, { materials: m })} options={materialItems} />
                    <ItemFooter total={itemTotal(`room:${room.id ?? room.name}`)} />
                  </div>
                ))}
                {rooms.length === 0 && <EmptyHint text="No rooms yet." />}
              </div>
            </div>

            <div>
              <SectionToolbar label="Custom Areas (irregular footage)" onAdd={() => caOps.add(blankCustomArea())} addLabel="+ Add Area" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {customAreas.map((c, i) => (
                  <div key={i} className="card card-tight">
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input className="input" style={{ flex: 2, minWidth: 140 }} value={c.label} onChange={(e) => caOps.update(i, { label: e.target.value })} />
                      <select className="select" style={{ width: 130 }} value={c.measureType} onChange={(e) => caOps.update(i, { measureType: e.target.value })}>
                        <option value="area">Area (sq ft)</option><option value="trim">Trim (linear ft)</option>
                      </select>
                      <MiniNum value={c.amount} onChange={(v) => caOps.update(i, { amount: v })} suffix={c.measureType === "trim" ? "lf" : "sf"} />
                      <MiniNum value={c.rate} onChange={(v) => caOps.update(i, { rate: v })} suffix="$" />
                      <MiniNum value={c.coats} onChange={(v) => caOps.update(i, { coats: Math.round(v) })} suffix="ct" />
                      <div style={{ flex: 2, minWidth: 150 }}><PaintSelect options={paintItems} value={c.paintId} onChange={(id, name) => caOps.update(i, { paintId: id, paintProduct: name })} placeholder="— No paint —" /></div>
                      <div style={{ width: 130 }}><SheenSelect value={c.sheen} onChange={(v) => caOps.update(i, { sheen: v })} /></div>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => caOps.remove(i)}>✕</button>
                    </div>
                    <PrimerRow paintId={c.primerPaintId} coats={c.primerCoats} sqftAdjust={c.primerSqftAdjust} options={paintItems} onChange={(p) => caOps.update(i, { primerPaintId: p.paintId, primerCoats: p.coats, primerSqftAdjust: p.sqftAdjust })} />
                    <MaterialsEditor materials={c.materials} onChange={(m) => caOps.update(i, { materials: m })} options={materialItems} />
                    <ItemFooter total={itemTotal(`custom:${c.id ?? c.label}`)} />
                  </div>
                ))}
                {customAreas.length === 0 && <EmptyHint text="No custom areas." />}
              </div>
            </div>
          </div>
        )}

        {/* CABINETS */}
        {tab === 2 && (
          <div>
            <SectionToolbar label={`${cabinets.length} cabinet set${cabinets.length === 1 ? "" : "s"}`} onAdd={() => cabOps.add({ ...blankCabinet(), name: `Cabinet Set ${cabinets.length + 1}` })} addLabel="+ Add Cabinet Set" />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {cabinets.map((c, i) => (
                <div key={i} className="card">
                  <CardHeader name={c.name} onName={(v) => cabOps.update(i, { name: v })} onMoveUp={i > 0 ? () => cabOps.move(i, "up") : undefined} onMoveDown={i < cabinets.length - 1 ? () => cabOps.move(i, "down") : undefined} onDelete={() => cabOps.remove(i)} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    <Labeled label={`Doors (@ ${formatCurrency(rates.cabinetDoorRate)})`}><NumberField value={c.doorCount} min={0} onChange={(v) => cabOps.update(i, { doorCount: v })} /></Labeled>
                    <Labeled label={`Drawers (@ ${formatCurrency(rates.cabinetDrawerRate)})`}><NumberField value={c.drawerCount} min={0} onChange={(v) => cabOps.update(i, { drawerCount: v })} /></Labeled>
                    <Labeled label={`Frames (@ ${formatCurrency(rates.cabinetFrameRate)})`}><NumberField value={c.frameCount} min={0} onChange={(v) => cabOps.update(i, { frameCount: v })} /></Labeled>
                    <Labeled label="Paint Coats"><NumberField value={c.coats} min={1} onChange={(v) => cabOps.update(i, { coats: Math.round(v) })} /></Labeled>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", gap: 12, marginTop: 12 }}>
                    <Labeled label="Primer"><PaintSelect options={paintItems} value={c.primerId} onChange={(id, name) => cabOps.update(i, { primerId: id, primerProduct: name })} placeholder="— No primer —" /></Labeled>
                    <Labeled label="Paint"><PaintSelect options={paintItems} value={c.paintId} onChange={(id, name) => cabOps.update(i, { paintId: id, paintProduct: name })} /></Labeled>
                    <Labeled label="Sheen"><SheenSelect value={c.sheen} onChange={(v) => cabOps.update(i, { sheen: v })} /></Labeled>
                    <Labeled label="Primer Coats"><NumberField value={c.primerCoats} min={1} onChange={(v) => cabOps.update(i, { primerCoats: Math.round(v) })} /></Labeled>
                  </div>
                  <MaterialsEditor materials={c.materials} onChange={(m) => cabOps.update(i, { materials: m })} options={materialItems} />
                  <ItemFooter total={itemTotal(`cabinet:${c.id ?? c.name}`)} />
                </div>
              ))}
              {cabinets.length === 0 && <EmptyHint text="No cabinet sets." />}
            </div>
          </div>
        )}

        {/* DECKS & EXTERIORS */}
        {tab === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <SectionToolbar label="Exterior Houses" onAdd={() => houseOps.add({ ...blankExteriorHouse(), name: `Exterior ${houses.length + 1}` })} addLabel="+ Add Exterior" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {houses.map((h, i) => (
                  <div key={i} className="card">
                    <CardHeader name={h.name} onName={(v) => houseOps.update(i, { name: v })} onMoveUp={i > 0 ? () => houseOps.move(i, "up") : undefined} onMoveDown={i < houses.length - 1 ? () => houseOps.move(i, "down") : undefined} onDelete={() => houseOps.remove(i)} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <Labeled label="Perimeter Length"><NumberField value={h.sidingLength} onChange={(v) => houseOps.update(i, { sidingLength: v })} suffix="ft" /></Labeled>
                      <Labeled label="Width"><NumberField value={h.sidingWidth} onChange={(v) => houseOps.update(i, { sidingWidth: v })} suffix="ft" /></Labeled>
                      <Labeled label="Height"><NumberField value={h.sidingHeight} onChange={(v) => houseOps.update(i, { sidingHeight: v })} suffix="ft" /></Labeled>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                      <Labeled label="Siding Material"><select className="select" value={h.sidingMaterial} onChange={(e) => houseOps.update(i, { sidingMaterial: e.target.value })}>{SIDING_MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></Labeled>
                      <Labeled label="Coats"><NumberField value={h.coats} min={1} onChange={(v) => houseOps.update(i, { coats: Math.round(v) })} /></Labeled>
                      <Labeled label="Adjust SqFt (+/-)"><NumberField value={h.sidingSqftAdjust} onChange={(v) => houseOps.update(i, { sidingSqftAdjust: v })} /></Labeled>
                      <Labeled label="Paint"><PaintSelect options={paintItems} value={h.paintId} onChange={(id, name) => houseOps.update(i, { paintId: id, paintProduct: name })} /></Labeled>
                      <Labeled label="Sheen"><SheenSelect value={h.sheen} onChange={(v) => houseOps.update(i, { sheen: v })} /></Labeled>
                    </div>
                    <PrimerRow paintId={h.primerPaintId} coats={h.primerCoats} sqftAdjust={h.primerSqftAdjust} options={paintItems} onChange={(p) => houseOps.update(i, { primerPaintId: p.paintId, primerCoats: p.coats, primerSqftAdjust: p.sqftAdjust })} />
                    <SubList title="Deductions" items={h.deductions} onAdd={() => houseOps.update(i, { deductions: [...h.deductions, { label: "Window", width: 3, height: 4 }] })} addLabel="+ Deduction"
                      render={(d, di) => (<>
                        <input className="input" style={{ flex: 2 }} value={d.label} onChange={(e) => houseOps.update(i, { deductions: h.deductions.map((x, xi) => xi === di ? { ...x, label: e.target.value } : x) })} />
                        <MiniNum value={d.width} onChange={(v) => houseOps.update(i, { deductions: h.deductions.map((x, xi) => xi === di ? { ...x, width: v } : x) })} suffix="w" />
                        <MiniNum value={d.height} onChange={(v) => houseOps.update(i, { deductions: h.deductions.map((x, xi) => xi === di ? { ...x, height: v } : x) })} suffix="h" />
                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => houseOps.update(i, { deductions: h.deductions.filter((_, xi) => xi !== di) })}>✕</button>
                      </>)} />
                    <SubList title="Wood Replacement / Repairs" items={h.replacements} onAdd={() => houseOps.update(i, { replacements: [...h.replacements, { description: "", cost: 0 }] })} addLabel="+ Replacement"
                      render={(r, ri) => (<>
                        <input className="input" style={{ flex: 3 }} placeholder="Description" value={r.description} onChange={(e) => houseOps.update(i, { replacements: h.replacements.map((x, xi) => xi === ri ? { ...x, description: e.target.value } : x) })} />
                        <MiniNum value={r.cost} onChange={(v) => houseOps.update(i, { replacements: h.replacements.map((x, xi) => xi === ri ? { ...x, cost: v } : x) })} suffix="$" />
                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => houseOps.update(i, { replacements: h.replacements.filter((_, xi) => xi !== ri) })}>✕</button>
                      </>)} />
                    <MaterialsEditor materials={h.materials} onChange={(m) => houseOps.update(i, { materials: m })} options={materialItems} />
                    <ItemFooter total={itemTotal(`exterior:${h.id ?? h.name}`)} />
                  </div>
                ))}
                {houses.length === 0 && <EmptyHint text="No exterior houses." />}
              </div>
            </div>

            <div>
              <SectionToolbar label="Decks" onAdd={() => deckOps.add({ ...blankDeck(), name: `Deck ${decks.length + 1}` })} addLabel="+ Add Deck" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {decks.map((d, i) => (
                  <div key={i} className="card">
                    <CardHeader name={d.name} onName={(v) => deckOps.update(i, { name: v })} onMoveUp={i > 0 ? () => deckOps.move(i, "up") : undefined} onMoveDown={i < decks.length - 1 ? () => deckOps.move(i, "down") : undefined} onDelete={() => deckOps.remove(i)} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      <Labeled label="Floor Length"><NumberField value={d.floorLength} onChange={(v) => deckOps.update(i, { floorLength: v })} suffix="ft" /></Labeled>
                      <Labeled label="Floor Width"><NumberField value={d.floorWidth} onChange={(v) => deckOps.update(i, { floorWidth: v })} suffix="ft" /></Labeled>
                      <Labeled label="Steps"><NumberField value={d.stepCount} min={0} onChange={(v) => deckOps.update(i, { stepCount: v })} /></Labeled>
                      <Labeled label="Coats"><NumberField value={d.coats} min={1} onChange={(v) => deckOps.update(i, { coats: Math.round(v) })} /></Labeled>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div className="card card-tight" style={{ background: "var(--bg-secondary)" }}>
                        <Toggle checked={d.includeRailing} onChange={(v) => deckOps.update(i, { includeRailing: v })} label="Include Railing" />
                        {d.includeRailing && <div style={{ marginTop: 8 }}><Labeled label="Railing Footage (lf)"><NumberField value={d.railingLinFt} onChange={(v) => deckOps.update(i, { railingLinFt: v })} suffix="lf" /></Labeled></div>}
                      </div>
                      <div className="card card-tight" style={{ background: "var(--bg-secondary)" }}>
                        <Toggle checked={d.includeLattice} onChange={(v) => deckOps.update(i, { includeLattice: v })} label="Include Lattice" />
                        {d.includeLattice && <div style={{ marginTop: 8 }}><Labeled label="Lattice (sqft)"><NumberField value={d.latticeSqFt} onChange={(v) => deckOps.update(i, { latticeSqFt: v })} suffix="sf" /></Labeled></div>}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                      <Labeled label="Floor Stain"><PaintSelect options={paintItems} value={d.floorStainId} onChange={(id) => deckOps.update(i, { floorStainId: id })} placeholder="Default floor stain" /></Labeled>
                      <Labeled label="Floor Sheen"><SheenSelect value={d.floorSheen} onChange={(v) => deckOps.update(i, { floorSheen: v })} /></Labeled>
                      <Labeled label="Rail Stain"><PaintSelect options={paintItems} value={d.railStainId} onChange={(id) => deckOps.update(i, { railStainId: id })} placeholder="Default rail stain" /></Labeled>
                      <Labeled label="Rail Sheen"><SheenSelect value={d.railSheen} onChange={(v) => deckOps.update(i, { railSheen: v })} /></Labeled>
                      <Labeled label="Power Wash ($)"><NumberField value={d.powerWashCost} onChange={(v) => deckOps.update(i, { powerWashCost: v })} suffix="$" /></Labeled>
                      <Labeled label="Wood Repl. ($)"><NumberField value={d.woodReplCost} onChange={(v) => deckOps.update(i, { woodReplCost: v })} suffix="$" /></Labeled>
                    </div>
                    <PrimerRow paintId={d.primerPaintId} coats={d.primerCoats} sqftAdjust={d.primerSqftAdjust} options={paintItems} onChange={(p) => deckOps.update(i, { primerPaintId: p.paintId, primerCoats: p.coats, primerSqftAdjust: p.sqftAdjust })} />
                    <MaterialsEditor materials={d.materials} onChange={(m) => deckOps.update(i, { materials: m })} options={materialItems} />
                    <ItemFooter total={itemTotal(`deck:${d.id ?? d.name}`)} />
                  </div>
                ))}
                {decks.length === 0 && <EmptyHint text="No decks." />}
              </div>
            </div>

            <UnitSection title="Exterior Doors" items={doors} ops={doorOps} addLabel="+ Add Door" blank={() => ({ ...blankDoor(), name: `Door ${doors.length + 1}` })} paintItems={paintItems} materialItems={materialItems} itemTotal={itemTotal} keyPrefix="door" kind="door" />
            <UnitSection title="Shutters" items={shutters} ops={shutterOps} addLabel="+ Add Shutters" blank={() => ({ ...blankShutter(), name: `Shutters ${shutters.length + 1}` })} paintItems={paintItems} materialItems={materialItems} itemTotal={itemTotal} keyPrefix="shutter" kind="shutter" rates={rates} />
            <UnitSection title="Garage Doors" items={garages} ops={garageOps} addLabel="+ Add Garage Door" blank={() => ({ ...blankGarage(), name: `Garage Door ${garages.length + 1}` })} paintItems={paintItems} materialItems={materialItems} itemTotal={itemTotal} keyPrefix="garage" kind="garage" />
          </div>
        )}

        {/* SPECIAL PROJECTS */}
        {tab === 4 && (
          <div>
            <SectionToolbar label={`${specialProjects.length} special project${specialProjects.length === 1 ? "" : "s"}`} onAdd={() => spOps.add({ ...blankSpecialProject(), name: `Special Project ${specialProjects.length + 1}` })} addLabel="+ Add Special Project" />
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px" }}>One-off work priced as a flat amount — no rates or markup. The price drops straight into the estimate total and the proposal.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {specialProjects.map((sp, i) => (
                <div key={i} className="card">
                  <CardHeader name={sp.name} onName={(v) => spOps.update(i, { name: v })} onMoveUp={i > 0 ? () => spOps.move(i, "up") : undefined} onMoveDown={i < specialProjects.length - 1 ? () => spOps.move(i, "down") : undefined} onDelete={() => spOps.remove(i)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>
                    <Labeled label="Description (shown on proposal)"><textarea className="textarea" style={{ minHeight: 70 }} value={sp.description} onChange={(e) => spOps.update(i, { description: e.target.value })} placeholder="What this project covers…" /></Labeled>
                    <Labeled label="Price (flat)"><NumberField value={sp.price} onChange={(v) => spOps.update(i, { price: v })} suffix="$" /></Labeled>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Labeled label="Internal Notes (not shown to client)"><textarea className="textarea" style={{ minHeight: 50 }} value={sp.notes} onChange={(e) => spOps.update(i, { notes: e.target.value })} placeholder="Private notes…" /></Labeled>
                  </div>
                  <MaterialsEditor materials={sp.materials} onChange={(m) => spOps.update(i, { materials: m })} options={materialItems} />
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                      <span className="section-title">Attachments ({sp.files.length})</span>
                      <label className="btn btn-ghost btn-sm" style={{ cursor: spUploadingIdx === i ? "wait" : "pointer" }}>
                        {spUploadingIdx === i ? <LoadingSpinner size={14} /> : "+ Add Photos / Files"}
                        <input type="file" multiple style={{ display: "none" }} disabled={spUploadingIdx === i} onChange={(e) => { uploadSpecialFiles(i, e.target.files); e.target.value = ""; }} />
                      </label>
                    </div>
                    {sp.files.length === 0 ? (
                      <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>No attachments yet.</span>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                        {sp.files.map((f, fi) => (
                          <div key={fi} className="card card-tight" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {f.fileType === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={f.url} alt={f.caption || "attachment"} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, background: "var(--bg-secondary)" }} />
                            ) : (
                              <a href={f.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 120, borderRadius: 8, background: "var(--bg-secondary)", color: "var(--accent)", textDecoration: "none", fontSize: 13, padding: 10, textAlign: "center", overflow: "hidden", wordBreak: "break-word" }}>📄 {f.caption || "Open file"}</a>
                            )}
                            <input className="input" style={{ fontSize: 12.5 }} placeholder="Caption…" value={f.caption} onChange={(e) => spOps.update(i, { files: sp.files.map((x, xi) => (xi === fi ? { ...x, caption: e.target.value } : x)) })} />
                            <button className="btn btn-icon btn-danger btn-sm" style={{ alignSelf: "flex-end" }} onClick={() => spOps.update(i, { files: sp.files.filter((_, xi) => xi !== fi) })}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <ItemFooter total={itemTotal(`special:${sp.id ?? sp.name}`)} />
                </div>
              ))}
              {specialProjects.length === 0 && <EmptyHint text="No special projects." />}
            </div>
          </div>
        )}

        {/* PHOTOS */}
        {tab === 5 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Project Photos ({photos.length})</h2>
              <label className="btn btn-secondary" style={{ cursor: uploading ? "wait" : "pointer" }}>
                {uploading ? <LoadingSpinner size={16} /> : "+ Add Photos"}
                <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={uploading} onChange={(e) => { uploadPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 16px" }}>Reference photos with captions appear on the proposal and the client&apos;s signing page.</p>
            {photos.length === 0 ? <EmptyHint text="No photos yet." /> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {photos.map((p, i) => (
                  <div key={i} className="card card-tight" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || "photo"} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, background: "var(--bg-secondary)" }} />
                    <textarea className="textarea" style={{ minHeight: 56, fontSize: 13 }} placeholder="Caption…" value={p.caption} onChange={(e) => photoOps.update(i, { caption: e.target.value })} />
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn btn-icon btn-ghost btn-sm" disabled={i === 0} onClick={() => photoOps.move(i, "up")}>↑</button>
                      <button className="btn btn-icon btn-ghost btn-sm" disabled={i === photos.length - 1} onClick={() => photoOps.move(i, "down")}>↓</button>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => photoOps.remove(i)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUMMARY (grouped services, name + total) */}
        {tab === 6 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)" }}>
                  <h2 className="section-title">Services Breakdown</h2>
                </div>
                {services.length === 0 ? (
                  <p style={{ padding: 20, color: "var(--text-dim)", margin: 0 }}>Add work in the other tabs.</p>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Description of Service</th><th>Qty</th><th style={{ textAlign: "right" }}>Line Total</th></tr></thead>
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.key}>
                          <td style={{ maxWidth: 460 }}>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</div>
                            {s.subtitle && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, fontStyle: "italic", lineHeight: 1.5 }}>{s.subtitle}</div>}
                          </td>
                          <td style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{s.qtyLabel}</td>
                          <td style={{ textAlign: "right", color: "var(--accent)", fontWeight: 700 }}>{formatCurrency(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                  <h2 className="section-title">Project-Wide Items (added to every option)</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => liOps.add(blankLineItem())}>+ Line Item</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lineItems.map((li, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="input" style={{ flex: 3 }} placeholder="Description" value={li.description} onChange={(e) => liOps.update(i, { description: e.target.value })} />
                      <select className="select" style={{ flex: 1, minWidth: 110 }} value={li.category} onChange={(e) => liOps.update(i, { category: e.target.value })}>{LINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                      <MiniNum value={li.quantity} onChange={(v) => liOps.update(i, { quantity: v })} suffix="qty" />
                      <MiniNum value={li.unitCost} onChange={(v) => liOps.update(i, { unitCost: v })} suffix="$" />
                      <MiniNum value={li.markup} onChange={(v) => liOps.update(i, { markup: v })} suffix="%" />
                      <span style={{ width: 78, textAlign: "right", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{formatCurrency(li.quantity * li.unitCost * (1 + li.markup / 100))}</span>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => liOps.remove(i)}>✕</button>
                    </div>
                  ))}
                  {lineItems.length === 0 && <EmptyHint text="No project-wide line items. (Per-item materials live on each item.)" />}
                </div>
              </div>

              <div className="card">
                <SectionToolbar label="Overhead (applies to whole job)" onAdd={() => ohOps.add(blankOverhead())} addLabel="+ Add Overhead" tight />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {overhead.map((o, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="input" style={{ flex: 3 }} placeholder="Permits, equipment, dump fees…" value={o.description} onChange={(e) => ohOps.update(i, { description: e.target.value })} />
                      <MiniNum value={o.cost} onChange={(v) => ohOps.update(i, { cost: v })} suffix="$" />
                      <MiniNum value={o.markup} onChange={(v) => ohOps.update(i, { markup: v })} suffix="%" />
                      <span style={{ width: 78, textAlign: "right", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{formatCurrency(o.cost * (1 + o.markup / 100))}</span>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => ohOps.remove(i)}>✕</button>
                    </div>
                  ))}
                  {overhead.length === 0 && <EmptyHint text="No overhead items." />}
                </div>
              </div>
            </div>

            <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card"><h2 className="section-title" style={{ marginBottom: 14 }}>Totals</h2><TotalsPanel totals={totals} /></div>
              <div className="card">
                <h2 className="section-title" style={{ marginBottom: 14 }}>Deposit Tiers</h2>
                <TierRow label="Full Price" total={tiers.full.total} />
                <TierRow label={`${tiers.mid.depositPercent}% Deposit · save ${tiers.mid.discountPercent}%`} total={tiers.mid.total} deposit={tiers.mid.deposit} />
                <TierRow label={`${tiers.max.depositPercent}% Deposit · save ${tiers.max.discountPercent}%`} total={tiers.max.total} deposit={tiers.max.deposit} />
              </div>
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="btn btn-primary" onClick={handleGenerateProposal} disabled={pending}>{pending ? <LoadingSpinner size={16} /> : hasProposal ? "Save & Open Proposal" : "Generate Proposal"}</button>
                {hasProposal && proposalId && <Link href={`/proposals/${proposalId}`} className="btn btn-secondary" style={{ width: "100%" }}>View Proposal</Link>}
                <a href={`/api/estimates/${estimateId}/shopping-list`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ width: "100%" }}>↓ Shopping List (PDF)</a>
                <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Reflects the last <strong>saved</strong> estimate. Save first to include recent edits.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */
type PrimerVal = { paintId: number | null; coats: number; sqftAdjust: number };

function SectionToolbar({ label, onAdd, addLabel, tight }: { label: string; onAdd: () => void; addLabel: string; tight?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tight ? 0 : 16 }}>
      <h2 className={tight ? "section-title" : ""} style={tight ? {} : { fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{label}</h2>
      <button className="btn btn-secondary btn-sm" onClick={onAdd}>{addLabel}</button>
    </div>
  );
}

function SurfaceControl({ label, on, onToggle, coats, onCoats, paintId, onPaint, paintOptions, sheen, onSheen, primerPaintId, primerCoats, primerSqftAdjust, onPrimer }: {
  label: string; on: boolean; onToggle: (v: boolean) => void; coats: number; onCoats: (v: number) => void;
  paintId: number | null; onPaint: (id: number | null, name: string) => void; paintOptions: PaintOption[];
  sheen: string; onSheen: (v: string) => void;
  primerPaintId: number | null; primerCoats: number; primerSqftAdjust: number; onPrimer: (p: PrimerVal) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 240, background: "var(--bg-secondary)", borderRadius: 9, padding: 12, border: "1px solid var(--border-light)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Toggle checked={on} onChange={onToggle} label={label} />
        {on && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Coats</span><div style={{ width: 56 }}><MiniNum value={coats} onChange={(v) => onCoats(Math.round(v))} /></div></div>}
      </div>
      {on && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <PaintSelect options={paintOptions} value={paintId} onChange={onPaint} placeholder="Default (House Paint)" />
          <Labeled label="Sheen"><SheenSelect value={sheen} onChange={onSheen} /></Labeled>
          <PrimerRow paintId={primerPaintId} coats={primerCoats} sqftAdjust={primerSqftAdjust} options={paintOptions} onChange={onPrimer} compact />
        </div>
      )}
    </div>
  );
}

function PrimerRow({ paintId, coats, sqftAdjust, options, onChange, compact }: {
  paintId: number | null; coats: number; sqftAdjust: number; options: PaintOption[]; onChange: (p: PrimerVal) => void; compact?: boolean;
}) {
  const on = paintId != null;
  return (
    <div style={{ marginTop: compact ? 0 : 12, paddingTop: compact ? 0 : 12, borderTop: compact ? "none" : "1px solid var(--border-light)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 160 }}>
          <label className="label">Primer</label>
          <PaintSelect options={options} value={paintId} onChange={(id) => onChange({ paintId: id, coats, sqftAdjust })} placeholder="— No primer —" />
        </div>
        {on && (
          <>
            <div style={{ width: 70 }}><label className="label">Coats</label><MiniNum value={coats} onChange={(v) => onChange({ paintId, coats: Math.round(v), sqftAdjust })} /></div>
            <div style={{ width: 90 }}><label className="label">+/- sqft</label><MiniNum value={sqftAdjust} onChange={(v) => onChange({ paintId, coats, sqftAdjust: v })} /></div>
          </>
        )}
      </div>
    </div>
  );
}

function MaterialsEditor({ materials, onChange, options }: { materials: ItemMaterialPayload[]; onChange: (m: ItemMaterialPayload[]) => void; options: MaterialCatalogEntry[] }) {
  function addFromBook(id: number) {
    const m = options.find((x) => x.id === id);
    if (!m) return;
    onChange([...materials, { priceBookItemId: m.id, name: `${m.brand ? m.brand + " — " : ""}${m.name}`, unit: m.unit, quantity: 1, unitCost: m.unitCost, markup: m.markup }]);
  }
  const upd = (i: number, patch: Partial<ItemMaterialPayload>) => onChange(materials.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <span className="section-title">Materials for this item</span>
        <div style={{ display: "flex", gap: 6 }}>
          <select className="select" style={{ maxWidth: 230, fontSize: 13 }} value="" onChange={(e) => { if (e.target.value) addFromBook(parseInt(e.target.value, 10)); e.target.value = ""; }}>
            <option value="">+ Add from Price Book…</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.brand ? `${m.brand} — ` : ""}{m.name} ({formatCurrency(m.unitCost)}/{m.unit})</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange([...materials, blankMaterial()])}>+ Custom</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {materials.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 3, minWidth: 140 }} placeholder="Material" value={m.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <MiniNum value={m.quantity} onChange={(v) => upd(i, { quantity: v })} suffix="qty" />
            <MiniNum value={m.unitCost} onChange={(v) => upd(i, { unitCost: v })} suffix="$" />
            <MiniNum value={m.markup} onChange={(v) => upd(i, { markup: v })} suffix="%" />
            <span style={{ width: 78, textAlign: "right", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{formatCurrency(m.quantity * m.unitCost * (1 + m.markup / 100))}</span>
            <button className="btn btn-icon btn-danger btn-sm" onClick={() => onChange(materials.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        {materials.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>No materials on this item.</span>}
      </div>
    </div>
  );
}

function UnitSection({ title, items, ops, addLabel, blank, paintItems, materialItems, itemTotal, keyPrefix, kind, rates }: {
  title: string; items: any[]; ops: ReturnType<typeof listOps<any>>; addLabel: string; blank: () => any;
  paintItems: PaintOption[]; materialItems: MaterialCatalogEntry[]; itemTotal: (k: string) => number; keyPrefix: string; kind: "door" | "shutter" | "garage"; rates?: JobRates;
}) {
  return (
    <div>
      <SectionToolbar label={title} onAdd={() => ops.add(blank())} addLabel={addLabel} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((u, i) => (
          <div key={i} className="card">
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Labeled label="Name" width={150}><input className="input" value={u.name} onChange={(e) => ops.update(i, { name: e.target.value })} /></Labeled>
              {kind === "shutter" ? (
                <>
                  <Labeled label={`1st (@${rates ? formatCurrency(rates.shutterStory1Rate) : ""})`} width={110}><MiniNum value={u.story1} onChange={(v) => ops.update(i, { story1: Math.round(v) })} /></Labeled>
                  <Labeled label={`2nd (@${rates ? formatCurrency(rates.shutterStory2Rate) : ""})`} width={110}><MiniNum value={u.story2} onChange={(v) => ops.update(i, { story2: Math.round(v) })} /></Labeled>
                  <Labeled label={`3rd (@${rates ? formatCurrency(rates.shutterStory3Rate) : ""})`} width={110}><MiniNum value={u.story3} onChange={(v) => ops.update(i, { story3: Math.round(v) })} /></Labeled>
                  <Labeled label="Custom Qty" width={90}><MiniNum value={u.customQty} onChange={(v) => ops.update(i, { customQty: Math.round(v) })} /></Labeled>
                  <Labeled label="Custom $/ea" width={90}><MiniNum value={u.customRate} onChange={(v) => ops.update(i, { customRate: v })} suffix="$" /></Labeled>
                </>
              ) : (
                <>
                  <Labeled label="Count" width={70}><MiniNum value={u.count} onChange={(v) => ops.update(i, { count: Math.round(v) })} /></Labeled>
                  <Labeled label="Width" width={80}><MiniNum value={u.width} onChange={(v) => ops.update(i, { width: v })} suffix="ft" /></Labeled>
                  <Labeled label="Height" width={80}><MiniNum value={u.height} onChange={(v) => ops.update(i, { height: v })} suffix="ft" /></Labeled>
                  {kind === "door" && <Labeled label="Sides" width={130}><select className="select" value={u.paintedSides} onChange={(e) => ops.update(i, { paintedSides: parseInt(e.target.value, 10) })}><option value={1}>1 (Exterior)</option><option value={2}>2 Sides</option></select></Labeled>}
                </>
              )}
              <Labeled label="Coats" width={70}><MiniNum value={u.coats} onChange={(v) => ops.update(i, { coats: Math.round(v) })} /></Labeled>
              <Labeled label="Paint" width={170}><PaintSelect options={paintItems} value={u.paintId} onChange={(id, name) => ops.update(i, { paintId: id, paintProduct: name })} /></Labeled>
              <Labeled label="Sheen" width={120}><SheenSelect value={u.sheen} onChange={(v) => ops.update(i, { sheen: v })} /></Labeled>
              <button className="btn btn-icon btn-danger btn-sm" onClick={() => ops.remove(i)}>✕</button>
            </div>
            <PrimerRow paintId={u.primerPaintId} coats={u.primerCoats} sqftAdjust={u.primerSqftAdjust} options={paintItems} onChange={(p) => ops.update(i, { primerPaintId: p.paintId, primerCoats: p.coats, primerSqftAdjust: p.sqftAdjust })} />
            <MaterialsEditor materials={u.materials} onChange={(m) => ops.update(i, { materials: m })} options={materialItems} />
            <ItemFooter total={itemTotal(`${keyPrefix}:${u.id ?? u.name}`)} />
          </div>
        ))}
        {items.length === 0 && <EmptyHint text={`No ${title.toLowerCase()} added.`} />}
      </div>
    </div>
  );
}

// --- Perimeter Walk ---
type WallSeg = { feet: number; inches: number };

function ftToSeg(v: number): WallSeg {
  const val = Number.isFinite(v) ? Math.max(0, v) : 0;
  let feet = Math.floor(val);
  let inches = Math.round((val - feet) * 12);
  if (inches >= 12) { feet += 1; inches = 0; }
  return { feet, inches };
}
/** Seed a rectangle (L, W, L, W) when first switching a room into perimeter mode. */
function seedWallsFromRect(length: number, width: number): WallSeg[] {
  return [ftToSeg(length), ftToSeg(width), ftToSeg(length), ftToSeg(width)];
}

function ModeToggle({ mode, onSimple, onPerimeter }: { mode: string; onSimple: () => void; onPerimeter: () => void }) {
  const isPerim = mode === "perimeter";
  const btn = (active: boolean) => ({
    padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 7,
    border: "none", background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-dim)",
  } as const);
  return (
    <div style={{ display: "inline-flex", gap: 4, marginBottom: 12, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 9 }}>
      <button type="button" onClick={onSimple} style={btn(!isPerim)}>Simple</button>
      <button type="button" onClick={onPerimeter} style={btn(isPerim)}>Perimeter Walk</button>
    </div>
  );
}

function PerimeterWalls({ walls, height, onWalls, onHeight }: {
  walls: WallSeg[]; height: number; onWalls: (w: WallSeg[]) => void; onHeight: (v: number) => void;
}) {
  const perim = perimeterFeet(walls);
  const { closes, area } = solvePerimeter(walls);
  const setWall = (idx: number, patch: Partial<WallSeg>) => onWalls(walls.map((w, wi) => (wi === idx ? { ...w, ...patch } : w)));
  const addWall = () => onWalls([...walls, { feet: 0, inches: 0 }]);
  const removeWall = (idx: number) => { if (walls.length <= 3) return; onWalls(walls.filter((_, wi) => wi !== idx)); };
  const atMin = walls.length <= 3;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <Labeled label="Ceiling Height"><NumberField value={height} onChange={onHeight} suffix="ft" /></Labeled>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <span className="section-title">Perimeter Walls</span>
        <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Walk the room and enter each wall in order</span>
        <button className="btn btn-ghost btn-sm" onClick={addWall} style={{ marginLeft: "auto" }}>+ Add Wall</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {walls.map((w, wi) => (
          <div key={wi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 56, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>Wall {wi + 1}</span>
            <div style={{ flex: 1 }}><MiniNum value={w.feet} onChange={(v) => setWall(wi, { feet: Math.max(0, Math.round(v)) })} suffix="ft" /></div>
            <div style={{ flex: 1 }}><MiniNum value={w.inches} onChange={(v) => setWall(wi, { inches: Math.max(0, v) })} suffix="in" /></div>
            <button className="btn btn-icon btn-danger btn-sm" onClick={() => removeWall(wi)} disabled={atMin} title={atMin ? "Minimum 3 walls" : "Delete wall"}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid var(--border-light)", display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ color: "var(--text-dim)" }}>Perimeter <strong style={{ color: "var(--text-primary)" }}>{formatNumber(perim, 1)} lf</strong></span>
        <span style={{ color: "var(--text-dim)" }}>Ceiling area <strong style={{ color: "var(--accent)" }}>{closes ? `${formatNumber(area, 1)} sq ft` : "—"}</strong></span>
        <span style={{ color: "var(--text-dim)" }}>Walls <strong style={{ color: "var(--text-primary)" }}>{formatNumber(perim * (Number.isFinite(height) ? height : 0), 0)} sq ft</strong></span>
      </div>
      {!closes && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 12.5, color: "var(--warning, #f59e0b)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <span>These walls don&apos;t close — check your measurements.</span>
        </div>
      )}
    </div>
  );
}

function Openings({ room, onChange }: { room: any; onChange: (d: any[]) => void }) {
  const ded = room.deductions as { label: string; kind: string; width: number; height: number; includeTrim: boolean }[];
  return (
    <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <span className="section-title">Deductions / Openings</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange([...ded, { label: "Door", kind: "door", width: 3, height: 7, includeTrim: true }])}>+ Door (21 sf)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange([...ded, { label: "Window", kind: "window", width: 3, height: 5, includeTrim: false }])}>+ Window (15 sf)</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ded.map((d, di) => {
          const trim = d.kind === "door" ? d.width + 2 * d.height : 2 * (d.width + d.height);
          return (
            <div key={di} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="select" style={{ width: 110 }} value={d.kind} onChange={(e) => onChange(ded.map((x, xi) => xi === di ? { ...x, kind: e.target.value } : x))}>
                <option value="door">Door</option><option value="window">Window</option><option value="custom">Custom</option>
              </select>
              <input className="input" style={{ flex: 1, minWidth: 100 }} value={d.label} onChange={(e) => onChange(ded.map((x, xi) => xi === di ? { ...x, label: e.target.value } : x))} />
              <MiniNum value={d.width} onChange={(v) => onChange(ded.map((x, xi) => xi === di ? { ...x, width: v } : x))} suffix="w" />
              <MiniNum value={d.height} onChange={(v) => onChange(ded.map((x, xi) => xi === di ? { ...x, height: v } : x))} suffix="h" />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: d.includeTrim ? "var(--accent)" : "var(--text-dim)", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={d.includeTrim} onChange={(e) => onChange(ded.map((x, xi) => xi === di ? { ...x, includeTrim: e.target.checked } : x))} />
                + trim ({formatNumber(trim)} lf)
              </label>
              <button className="btn btn-icon btn-danger btn-sm" onClick={() => onChange(ded.filter((_, xi) => xi !== di))}>✕</button>
            </div>
          );
        })}
        {ded.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>No openings.</span>}
      </div>
    </div>
  );
}

function SubList<T>({ title, items, onAdd, addLabel, render }: { title: string; items: T[]; onAdd: () => void; addLabel: string; render: (item: T, i: number) => ReactNode }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="section-title">{title}</span>
        <button className="btn btn-ghost btn-sm" onClick={onAdd}>{addLabel}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{render(item, i)}</div>)}
        {items.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>None</span>}
      </div>
    </div>
  );
}

function MiniNum({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div style={{ position: "relative", width: "100%", minWidth: 60 }}>
      <input className="input" type="number" step="any" value={Number.isFinite(value) ? value : 0} onFocus={(e) => e.target.select()} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} style={{ padding: "8px", paddingRight: suffix ? 26 : 8, fontSize: 13 }} />
      {suffix && <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-dim)" }}>{suffix}</span>}
    </div>
  );
}

function ItemFooter({ total }: { total: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
      <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" }}>Item Total</span>
      <span className="font-display" style={{ fontSize: 22, color: "var(--accent)" }}>{formatCurrency(total)}</span>
    </div>
  );
}

function TierRow({ label, total, deposit }: { label: string; total: number; deposit?: number }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{formatCurrency(total)}</span>
        {deposit !== undefined && <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>deposit {formatCurrency(deposit)}</span>}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ padding: "20px", textAlign: "center", color: "var(--text-dim)", fontSize: 13.5, border: "1px dashed var(--border)", borderRadius: 9 }}>{text}</div>;
}
