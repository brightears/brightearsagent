"use client";

// Direct-to-R2 photo uploader (June 2026). Picks files, gets a presigned PUT
// from /api/uploads/presign, and uploads straight to the bucket with progress.
// Concurrency-safe: it appends via onAdd (a functional setState in the parent),
// so two photos finishing in the same tick never clobber each other.
import { useId, useRef, useState } from "react";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, MAX_PHOTOS } from "@/lib/uploads/limits";

type InFlight = { id: string; progress: number; error?: string };

export function PhotoUploader({
  value,
  onAdd,
  onRemove,
  max = MAX_PHOTOS,
}: {
  value: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  max?: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inflight, setInflight] = useState<InFlight[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const slotsLeft = Math.max(0, max - value.length - inflight.length);

  function patch(id: string, p: Partial<InFlight>) {
    setInflight((f) => f.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function drop(id: string) {
    setInflight((f) => f.filter((x) => x.id !== id));
  }

  async function uploadOne(file: File) {
    const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
    setInflight((f) => [...f, { id, progress: 0 }]);
    try {
      const res = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!res.ok) {
        patch(id, { error: res.status === 503 ? "Uploads aren't switched on yet" : "Couldn't start upload" });
        setTimeout(() => drop(id), 4000);
        return;
      }
      const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) patch(id, { progress: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status)));
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(file);
      });

      onAdd(publicUrl); // functional update in parent → safe under concurrency
      drop(id);
    } catch {
      patch(id, { error: "Upload failed — try again" });
      setTimeout(() => drop(id), 4000);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setNotice(null);
    let accepted = 0;
    for (const file of Array.from(files)) {
      if (accepted >= slotsLeft) {
        setNotice(`That's the max of ${max} photos — remove one to add more.`);
        break;
      }
      if (!ALLOWED_IMAGE_TYPES[file.type]) {
        setNotice("Images only — JPG, PNG, WebP or GIF.");
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setNotice("Each photo needs to be under 8 MB.");
        continue;
      }
      accepted++;
      void uploadOne(file);
    }
    if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
  }

  const tile =
    "relative aspect-square overflow-hidden rounded-xl border border-cream bg-cream/40";

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {value.map((url) => (
          <div key={url} className={tile}>
            {/* External R2 URLs — plain img, not next/image (matches the EPK). */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-stage/70 text-sm font-bold text-white transition-colors hover:bg-ink-stage"
            >
              ×
            </button>
          </div>
        ))}

        {inflight.map((f) => (
          <div key={f.id} className={`${tile} flex items-center justify-center`}>
            {f.error ? (
              <span className="px-2 text-center text-[11px] font-semibold text-red-600">{f.error}</span>
            ) : (
              <span className="font-mono text-xs font-bold text-ink-stage/60">{f.progress}%</span>
            )}
          </div>
        ))}

        {slotsLeft > 0 && (
          <label
            htmlFor={inputId}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-stage/30 bg-white text-ink-stage/55 transition-colors hover:border-brand-cyan hover:text-brand-cyan"
          >
            <span aria-hidden className="text-2xl leading-none">+</span>
            <span className="text-[11px] font-semibold">Add photos</span>
          </label>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {notice && <p className="mt-2 text-xs text-red-600">{notice}</p>}
    </div>
  );
}
