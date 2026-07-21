"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  updateJobProgress,
  addWorkerJobPhoto,
  deleteWorkerJobPhoto,
} from "@/lib/actions/workers";

interface Photo {
  id: number;
  url: string;
  caption: string;
}

export default function JobProgressClient({
  estimateId,
  initialNotes,
  completed,
  photos,
}: {
  estimateId: number;
  initialNotes: string;
  completed: boolean;
  photos: Photo[];
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [uploading, setUploading] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveNotes() {
    start(async () => {
      const res = await updateJobProgress(estimateId, { workerNotes: notes });
      if (res.success) { success("Notes saved."); router.refresh(); } else error(res.error);
    });
  }

  function toggleComplete(nextValue: boolean) {
    start(async () => {
      const res = await updateJobProgress(estimateId, { completed: nextValue });
      if (res.success) {
        success(nextValue ? "Job marked complete." : "Job marked incomplete.");
        router.refresh();
      } else error(res.error);
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "estimates");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      const addRes = await addWorkerJobPhoto(estimateId, { url: data.url });
      if (!addRes.success) throw new Error(addRes.error);
      success("Photo added.");
      router.refresh();
    } catch (e) {
      error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function confirmDeletePhoto() {
    if (deletePhotoId === null) return;
    const id = deletePhotoId;
    setDeletePhotoId(null);
    start(async () => {
      const res = await deleteWorkerJobPhoto(estimateId, id);
      if (res.success) { success("Photo removed."); router.refresh(); } else error(res.error);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>Job Status</div>
          <span
            className="badge"
            style={completed ? { background: "#166534", color: "#22c55e" } : { background: "#374151", color: "#d1d5db" }}
          >
            {completed ? "Complete" : "In Progress"}
          </span>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 12, width: "100%" }}
          disabled={pending}
          onClick={() => (completed ? toggleComplete(false) : setConfirmComplete(true))}
        >
          {completed ? "Mark as Not Complete" : "Mark Job Complete"}
        </button>
      </div>

      <div className="card">
        <label className="label" htmlFor="workerNotes">Job Notes</label>
        <textarea
          id="workerNotes"
          className="input"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Progress notes, issues on site, anything the office should know…"
        />
        <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={pending} onClick={saveNotes}>
          Save Notes
        </button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Job Photos</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || "Job photo"} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
              <button
                type="button"
                onClick={() => setDeletePhotoId(p.id)}
                style={{
                  position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", lineHeight: "22px",
                }}
                aria-label="Delete photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <button className="btn" style={{ width: "100%" }} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Add Photo"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmComplete}
        title="Mark job complete?"
        message="This will mark the job as finished."
        confirmLabel="Mark Complete"
        onConfirm={() => { setConfirmComplete(false); toggleComplete(true); }}
        onCancel={() => setConfirmComplete(false)}
      />
      <ConfirmDialog
        open={deletePhotoId !== null}
        title="Delete this photo?"
        message="This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeletePhoto}
        onCancel={() => setDeletePhotoId(null)}
      />
    </div>
  );
}
