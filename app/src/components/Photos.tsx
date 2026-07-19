import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Photo, PhotoComment, PhotoLike } from "../types";
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
  const { items: likes } = useSubCollection<PhotoLike>(planId, "photoLikes", 1000);
  const { items: pComments, add: addPc, remove: removePc } = useSubCollection<PhotoComment>(planId, "photoComments", 1000);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const likesBy = useMemo(() => {
    const m: Record<string, PhotoLike[]> = {};
    likes.forEach((l) => (m[l.photoId] = m[l.photoId] || []).push(l));
    return m;
  }, [likes]);
  const commentsBy = useMemo(() => {
    const m: Record<string, PhotoComment[]> = {};
    pComments.forEach((c) => (m[c.photoId] = m[c.photoId] || []).push(c));
    return m;
  }, [pComments]);

  const viewer = photos.find((p) => p.id === viewerId) ?? null;

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

  const toggleLike = async (p: Photo) => {
    if (!user) { alert("좋아요는 로그인 후에!"); return; }
    const likeId = `${p.id}_${user.uid}`;
    const mine = (likesBy[p.id] || []).some((l) => l.uid === user.uid);
    try {
      if (mine) await deleteDoc(doc(db, "trips", planId, "photoLikes", likeId));
      else await setDoc(doc(db, "trips", planId, "photoLikes", likeId),
        { photoId: p.id, uid: user.uid, name: user.displayName || "", ts: Date.now() });
    } catch (e: any) { alert("실패: " + e.message); }
  };

  const sendComment = async () => {
    const t = text.trim();
    if (!t || !viewer) return;
    if (!user) { alert("댓글은 로그인 후에!"); return; }
    try {
      await addPc({ photoId: viewer.id, uid: user.uid, name: user.displayName || "이름 없음", text: t, ts: Date.now() });
      setText("");
    } catch (e: any) { alert("실패: " + e.message); }
  };

  const share = async (p: Photo) => {
    try {
      const blob = await (await fetch(p.data)).blob();
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "우리 계획 📷" });
      } else if (navigator.share) {
        await navigator.share({ title: "우리 계획", url: location.href });
      } else {
        await navigator.clipboard.writeText(location.href);
        alert("링크를 복사했어요!");
      }
    } catch { /* 사용자가 공유 취소 */ }
  };

  const delPhoto = async (p: Photo) => {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try { await remove(p.id); setViewerId(null); }
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
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>

        {photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            아직 사진이 없어요. 여행 가서 찍은 사진을 올려 추억을 모아보세요! 📸
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <AnimatePresence initial={false}>
              {[...photos].reverse().map((p) => {
                const lc = (likesBy[p.id] || []).length;
                const cc = (commentsBy[p.id] || []).length;
                return (
                  <motion.button key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }} whileTap={{ scale: 0.96 }}
                    onClick={() => setViewerId(p.id)} className="relative aspect-square overflow-hidden rounded-lg">
                    <img src={p.data} alt="" className="h-full w-full object-cover" loading="lazy" />
                    {(lc > 0 || cc > 0) && (
                      <span className="absolute bottom-1 left-1 flex gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                        {lc > 0 && <span>♥ {lc}</span>}{cc > 0 && <span>💬 {cc}</span>}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <p className="mt-3 text-[0.7rem] text-muted">사진은 자동 압축돼 저장돼요. 눌러서 좋아요·댓글·공유!</p>
      </Card>

      {/* 인스타 스타일 뷰어 */}
      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 sm:items-center"
            onClick={() => setViewerId(null)}>
            <motion.div
              initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface sm:max-w-md sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}>

              {/* 헤더 */}
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {(viewer.name || "?")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{viewer.name}</div>
                  <div className="text-[0.7rem] text-muted">{fmtWhen(viewer.ts)}</div>
                </div>
                {user && viewer.uid === user.uid && (
                  <button onClick={() => delPhoto(viewer)} className="text-xs text-muted underline">삭제</button>
                )}
                <button onClick={() => setViewerId(null)} className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-muted">닫기</button>
              </div>

              <img src={viewer.data} alt="" className="max-h-[45vh] w-full bg-black object-contain" />

              {/* 액션 바 */}
              <div className="flex items-center gap-4 px-4 py-2.5">
                <button onClick={() => toggleLike(viewer)} className="flex items-center gap-1.5 text-sm font-bold active:scale-90 transition">
                  <motion.span
                    key={(likesBy[viewer.id] || []).some((l) => user && l.uid === user.uid) ? "on" : "off"}
                    initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                    className={`text-xl ${(likesBy[viewer.id] || []).some((l) => user && l.uid === user.uid) ? "" : "grayscale opacity-60"}`}>
                    ❤️
                  </motion.span>
                  {(likesBy[viewer.id] || []).length || ""}
                </button>
                <span className="text-sm text-muted">💬 {(commentsBy[viewer.id] || []).length}</span>
                <button onClick={() => share(viewer)} className="ml-auto flex items-center gap-1 text-sm font-semibold text-ink2 active:scale-95 transition">
                  공유 <span className="text-base">↗</span>
                </button>
              </div>
              {(likesBy[viewer.id] || []).length > 0 && (
                <p className="px-4 pb-1 text-xs text-muted">
                  {(likesBy[viewer.id] || []).map((l) => l.name).filter(Boolean).join(", ")}님이 좋아해요
                </p>
              )}

              {/* 사진 댓글 */}
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-hairline px-4 py-2">
                {(commentsBy[viewer.id] || []).length === 0 && (
                  <p className="py-2 text-center text-xs text-muted">첫 댓글을 남겨보세요!</p>
                )}
                {(commentsBy[viewer.id] || []).map((c) => (
                  <div key={c.id} className="flex items-start gap-2 py-1.5 text-sm">
                    <b className="shrink-0">{c.name}</b>
                    <span className="min-w-0 flex-1 text-ink2">{c.text}</span>
                    {user && c.uid === user.uid && (
                      <button onClick={() => removePc(c.id)} className="text-[0.68rem] text-muted">삭제</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-hairline p-3">
                <input value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder="댓글 달기…"
                  className="min-w-0 flex-1 rounded-full border border-hairline bg-page px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent" />
                <button onClick={sendComment} className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white active:scale-95 transition">게시</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
