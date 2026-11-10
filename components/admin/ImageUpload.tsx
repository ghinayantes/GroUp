"use client";

import { useEffect, useRef, useState } from "react";
import { BATCH_IMAGE_BUCKET, imageInputError } from "@/lib/batch-image";
import { resizeToWebp } from "@/lib/resize-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = { value: string | null; onChange: (path: string | null) => void; onBusyChange: (busy: boolean) => void };

class UploadError extends Error {}

async function uploadBlob(blob: Blob) {
  const response = await fetch("/api/uploads/batch-image", { method: "POST" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new UploadError(result.error || "Upload gagal.");
  const { error } = await createSupabaseBrowserClient().storage.from(BATCH_IMAGE_BUCKET).uploadToSignedUrl(result.path, result.token, blob, { contentType: "image/webp" });
  if (error) throw new UploadError("Upload gagal.");
  return result.path as string;
}

export default function ImageUpload({ value, onChange, onBusyChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onBusyChange(busy || pending !== null);
  }, [busy, pending, onBusyChange]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function upload(blob: Blob) {
    setBusy(true); setError("");
    try {
      const path = await uploadBlob(blob);
      setPending(null);
      onChange(path);
    } catch (cause) {
      setPending(blob);
      setError(cause instanceof UploadError ? cause.message : "Upload gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    const invalid = imageInputError(file);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    let blob: Blob;
    try {
      blob = await resizeToWebp(file);
    } catch {
      setError("Foto tidak dapat dibaca. Coba foto lain.");
      setBusy(false);
      return;
    }
    setPreview(URL.createObjectURL(blob));
    onChange(null);
    await upload(blob);
  }

  function clear() {
    setPreview(null); setPending(null); setError("");
    onChange(null);
  }

  const shown = preview && (value !== null || busy || pending !== null) ? preview : null;

  return <div className="image-upload">
    {shown ? <div className="image-upload-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shown} alt="Pratinjau foto bahan" />
      <div className="image-upload-actions">
        {busy && <small role="status">Mengupload…</small>}
        {!busy && value && <small role="status">Terupload ✓</small>}
        {!busy && pending && <button type="button" className="link-button" onClick={() => upload(pending)}>Coba lagi</button>}
        <button type="button" className="link-button" disabled={busy} onClick={() => input.current?.click()}>Ganti</button>
        <button type="button" className="link-button" disabled={busy} onClick={clear}>Hapus</button>
      </div>
    </div> : <button type="button" className={dragging ? "image-upload-drop is-dragging" : "image-upload-drop"} disabled={busy}
      onClick={() => input.current?.click()}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files[0]); }}>
      {busy ? "Memproses…" : "Tarik foto ke sini atau pilih dari perangkat"}
    </button>}
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
