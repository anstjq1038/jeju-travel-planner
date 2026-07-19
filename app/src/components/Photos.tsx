import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Photo } from "../types";
import { fmtWhen } from "../lib/util";
import { Card } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useSubCollection } from "../hooks/useCollection";

// 이미지 파일 → 압축된 JPEG dataURL (Firestore 1MB 문서 한도 안쪽으로)
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  for (const [maxDim, quality] of [[1280, 0.8], [1024, 0.65], [800, 0.5]] as const) {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < 900_000) return url;
  }
  throw new Error("사진이 너무 커서 압축에 실패했어요");
}

export function PhotosPane({ planId }: { planId: string }) {
  const { user, login } = useAuth();
  const { items: photos, add, remove } = useSubCollection<Photo>(planId, "photos", 200);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Photo | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!user) { alert("사진을 올리려면 로그인해주세요!"); await login(); return; }
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, 10)) {
        const data = await compress(f);
        await add({ data, name: user.displayName || "이름 없음", uid: user.uid, ts: Date.now() });
      }
    } catch (e: any) {
      alert("업로드 실패: " + e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const del = async (p: Photo) => {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try { await remove(p.id); setViewer(null); }
    catch (e: any) { alert("삭제 실패: " + e.message); }
  };

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold">📷 사진첩</h2>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50">
            {busy ? "올리는 중…" : "+ 사진 올리기"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => upload(e.target.files)} />
        </div>

        {photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            아직 사진이 없어요. 여행 가서 찍은 사진을 올려 추억을 모아보세요! 📸
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <AnimatePresence initial={false}>
              {[...photos].reverse().map((p) => (
                <motion.button key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setViewer(p)} className="aspect-square overflow-hidden rounded-lg">
                  <img src={p.data} alt="" className="h-full w-full object-cover" loading="lazy" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
        <p className="mt-3 text-[0.7rem] text-muted">사진은 자동 압축돼 저장돼요 (무료 용량 보호). 본인이 올린 사진만 삭제할 수 있어요.</p>
      </Card>

      {/* 라이트박스 */}
      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4"
            onClick={() => setViewer(null)}>
            <motion.img initial={{ scale: 0.92 }} animate={{ scale: 1 }} src={viewer.data} alt=""
              className="max-h-[78vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
            <div className="mt-3 flex items-center gap-3 text-sm text-white/90" onClick={(e) => e.stopPropagation()}>
              <span className="font-semibold">{viewer.name}</span>
              <span className="text-white/60">{fmtWhen(viewer.ts)}</span>
              {user && viewer.uid === user.uid && (
                <button onClick={() => del(viewer)} className="rounded-full border border-white/40 px-3 py-1 text-xs active:scale-95">삭제</button>
              )}
              <button onClick={() => setViewer(null)} className="rounded-full border border-white/40 px-3 py-1 text-xs active:scale-95">닫기</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
