import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useComments } from "../hooks/useComments";
import { fmtWhen } from "../lib/util";
import type { Comment } from "../types";
import { Card } from "./ui";

export function AuthCard() {
  const { user, ready, login, logout } = useAuth();
  return (
    <Card>
      <h2 className="mb-3 text-[1.05rem] font-bold">🙋 참여하기</h2>
      {!ready ? (
        <p className="text-sm text-muted">확인 중…</p>
      ) : user ? (
        <div className="flex items-center gap-3">
          {user.photoURL
            ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="h-11 w-11 rounded-full border border-hairline object-cover" />
            : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-bold text-white">{(user.displayName || "?")[0]}</span>}
          <div className="min-w-0 flex-1">
            <div className="font-bold">{user.displayName || "이름 없음"}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
          <button onClick={logout} className="rounded-xl border border-hairline px-4 py-2.5 text-sm font-semibold active:scale-95 transition">로그아웃</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink2">의견을 남기려면 Google 계정으로 로그인해주세요.</p>
          <button onClick={login}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white active:scale-95 transition">
            <svg width="16" height="16" viewBox="0 0 48 48" className="rounded-sm bg-white p-px">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            Google로 로그인
          </button>
        </>
      )}
      {user && <p className="mt-2 text-xs text-muted">본인이 쓴 의견만 삭제할 수 있어요.</p>}
    </Card>
  );
}

function CommentItem({ c, isReply, parentName, mine, onReply, onDelete }: {
  c: Comment; isReply?: boolean; parentName?: string; mine: boolean;
  onReply?: () => void; onDelete?: () => void;
}) {
  const avatar = c.photo
    ? <img src={c.photo} referrerPolicy="no-referrer" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    : <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${c.agent ? "bg-accent" : "bg-muted"}`}>
        {c.agent ? "🤖" : (c.name || "?")[0]}
      </span>;
  return (
    <motion.li
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className={`flex items-start gap-2.5 py-2 ${isReply ? "ml-9" : ""}`}>
      {avatar}
      <div className="min-w-0 flex-1">
        <div className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 ${c.agent ? "bg-accent-soft/70" : "bg-page"}`}>
          <div className="flex flex-wrap items-center gap-1.5 text-[0.8rem]">
            <span className="font-bold">{c.name}</span>
            {c.agent && <span className="rounded-full bg-accent px-2 py-px text-[0.62rem] font-bold text-white">플래너</span>}
            {isReply && parentName && <span className="text-[0.72rem] font-semibold text-accent">→ {parentName}님께</span>}
            <span className="text-[0.68rem] text-muted">{fmtWhen(c.ts)}</span>
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink2">{c.text}</div>
        </div>
        <div className="mt-1 flex gap-3 pl-1.5">
          {onReply && <button onClick={onReply} className="text-xs font-semibold text-muted active:scale-95 transition">답글</button>}
          {mine && onDelete && <button onClick={onDelete} className="text-xs font-semibold text-muted active:scale-95 transition">삭제</button>}
        </div>
      </div>
    </motion.li>
  );
}

export function CommentsCard({ planId }: { planId: string }) {
  const { user } = useAuth();
  const { comments, add, remove } = useComments(planId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [shown, setShown] = useState(10); // 페이징: 처음 10개 스레드만

  const { roots, byParent } = useMemo(() => {
    const roots = comments.filter((c) => !c.replyTo).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const byParent: Record<string, Comment[]> = {};
    comments.filter((c) => c.replyTo).forEach((c) => {
      (byParent[c.replyTo!] = byParent[c.replyTo!] || []).push(c);
    });
    Object.values(byParent).forEach((a) => a.sort((x, y) => (x.ts || 0) - (y.ts || 0)));
    return { roots, byParent };
  }, [comments]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (!user) { alert("먼저 위에서 Google 로그인을 해주세요!"); return; }
    const c: Omit<Comment, "id"> = { name: user.displayName || "이름 없음", text: t, ts: Date.now(), uid: user.uid };
    if (user.photoURL) c.photo = user.photoURL;
    if (replyTo) c.replyTo = replyTo.id;
    try {
      await add(c);
      setText(""); setReplyTo(null);
    } catch (e: any) { alert("등록에 실패했어요: " + e.message); }
  };

  const del = async (id: string) => {
    const replies = (byParent[id] || []).map((x) => x.id);
    const msg = replies.length
      ? `이 의견과 달린 답글 ${replies.length}개가 함께 삭제됩니다. 지울까요?`
      : "이 의견을 삭제할까요?";
    if (!confirm(msg)) return;
    try {
      await remove(id, replies);
      if (replyTo && (replyTo.id === id || replies.includes(replyTo.id))) setReplyTo(null);
    } catch (e: any) { alert("삭제에 실패했어요: " + e.message); }
  };

  const mine = (c: Comment) => !!(user && c.uid && c.uid === user.uid);

  return (
    <Card>
      <h2 className="mb-3 text-[1.05rem] font-bold">💬 의견 남기기</h2>
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink2">
          <span><b>{replyTo.name}</b>님에게 답글 다는 중</span>
          <button onClick={() => setReplyTo(null)} className="font-semibold text-accent underline">취소</button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="날짜, 장소, 가고 싶은 곳 등 자유롭게!"
          className="flex-1 resize-y rounded-xl border border-hairline bg-page px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent" />
        <button onClick={send} className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white active:scale-95 transition">남기기</button>
      </div>
      <ul className="mt-4">
        {roots.length === 0 && <li className="py-2 text-sm text-muted">아직 의견이 없어요. 첫 의견을 남겨보세요!</li>}
        <AnimatePresence initial={false}>
          {roots.slice(0, shown).map((r) => (
            <FragmentThread key={r.id} root={r} replies={byParent[r.id] || []}
              mine={mine} onReply={(c) => setReplyTo({ id: c.id, name: c.name })} onDelete={del} />
          ))}
        </AnimatePresence>
      </ul>
      {roots.length > shown && (
        <button onClick={() => setShown((s) => s + 20)}
          className="mt-2 w-full rounded-xl border border-hairline py-2.5 text-sm font-semibold text-ink2 transition active:scale-[0.98]">
          의견 더 보기 ({roots.length - shown}개 남음)
        </button>
      )}
    </Card>
  );
}

function FragmentThread({ root, replies, mine, onReply, onDelete }: {
  root: Comment; replies: Comment[]; mine: (c: Comment) => boolean;
  onReply: (c: Comment) => void; onDelete: (id: string) => void;
}) {
  return (
    <>
      <CommentItem c={root} mine={mine(root)} onReply={() => onReply(root)} onDelete={() => onDelete(root.id)} />
      {replies.map((x) => (
        <CommentItem key={x.id} c={x} isReply parentName={root.name} mine={mine(x)} onDelete={() => onDelete(x.id)} />
      ))}
    </>
  );
}
