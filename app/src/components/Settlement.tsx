import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Expense, Plan } from "../types";
import { won } from "../lib/util";
import { Card } from "./ui";
import { useAuth } from "../hooks/useAuth";
import { useSubCollection } from "../hooks/useCollection";

// 잔액 → 최소 송금 목록 (그리디)
function settle(balances: Record<string, number>): { from: string; to: string; amount: number }[] {
  const creditors = Object.entries(balances).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(balances).filter(([, v]) => v < -0.5).sort((a, b) => a[1] - b[1]);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  const c = creditors.map(([k, v]) => ({ k, v }));
  const d = debtors.map(([k, v]) => ({ k, v: -v }));
  while (i < d.length && j < c.length) {
    const pay = Math.min(d[i].v, c[j].v);
    out.push({ from: d[i].k, to: c[j].k, amount: Math.round(pay) });
    d[i].v -= pay; c[j].v -= pay;
    if (d[i].v < 0.5) i++;
    if (c[j].v < 0.5) j++;
  }
  return out;
}

export function SettlementCard({ plan }: { plan: Plan }) {
  const { user } = useAuth();
  const { items: expenses, add, remove } = useSubCollection<Expense>(plan.id, "expenses");
  const members = plan.members ?? [];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(members[0] ?? "");

  const { paidBy, share, balances, transfers, total } = useMemo(() => {
    const paidBy: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
    expenses.forEach((e) => { paidBy[e.payer] = (paidBy[e.payer] ?? 0) + e.amount; });
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const share = members.length ? total / members.length : 0;
    const balances: Record<string, number> = {};
    Object.keys(paidBy).forEach((m) => { balances[m] = paidBy[m] - share; });
    return { paidBy, share, balances, transfers: settle(balances), total };
  }, [expenses, members]);

  const submit = async () => {
    const amt = Math.round(Number(amount.replace(/[, ]/g, "")));
    if (!user) { alert("먼저 의견 탭에서 Google 로그인을 해주세요!"); return; }
    if (!title.trim()) { alert("무슨 지출인지 적어주세요!"); return; }
    if (!amt || amt <= 0) { alert("금액을 숫자로 입력해주세요!"); return; }
    if (!payer) { alert("누가 냈는지 골라주세요!"); return; }
    try {
      await add({ title: title.trim(), amount: amt, payer, ts: Date.now(), uid: user.uid, by: user.displayName || "" });
      setTitle(""); setAmount("");
    } catch (e: any) { alert("등록 실패: " + e.message); }
  };

  const del = async (e: Expense) => {
    if (!confirm(`"${e.title}" (${won(e.amount)}) 기록을 지울까요?`)) return;
    try { await remove(e.id); } catch (err: any) { alert("삭제 실패: " + err.message); }
  };

  return (
    <Card>
      <h2 className="mb-1 text-[1.05rem] font-bold">💸 정산 (더치페이)</h2>
      <p className="mb-3 text-xs text-muted">지출을 기록하면 1/n 정산과 송금액을 자동 계산해요.</p>

      {/* 입력 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <button key={m} onClick={() => setPayer(m)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition active:scale-95 ${
              payer === m ? "border-accent bg-accent font-semibold text-white" : "border-hairline text-ink2"}`}>
            {m}
          </button>
        ))}
        <span className="self-center text-xs text-muted">← 누가 냈나요?</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="무엇에 (예: 흑돼지 저녁)"
          className="flex-1 rounded-xl border border-hairline bg-page px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액 (원)" inputMode="numeric"
          className="w-full rounded-xl border border-hairline bg-page px-3.5 py-3 outline-none focus:ring-2 focus:ring-accent sm:w-36" />
        <button onClick={submit} className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white active:scale-95 transition">추가</button>
      </div>

      {/* 지출 목록 */}
      {expenses.length > 0 && (
        <ul className="mt-4">
          <AnimatePresence initial={false}>
            {[...expenses].reverse().map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 border-t border-hairline py-2 text-sm">
                <span className="rounded-full bg-accent-soft px-2 py-px text-xs font-bold text-accent">{e.payer}</span>
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="font-bold tabular-nums">{won(e.amount)}</span>
                {user && e.uid === user.uid && (
                  <button onClick={() => del(e)} className="rounded-full border border-hairline px-2.5 py-0.5 text-xs text-muted active:scale-95">삭제</button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* 정산 결과 */}
      {total > 0 && (
        <div className="mt-4 rounded-xl bg-page p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-bold">총 지출</span>
            <span className="text-lg font-bold tabular-nums">{won(total)} <small className="text-xs font-normal text-muted">(1인 {won(Math.round(share))})</small></span>
          </div>
          <div className="mb-3 grid gap-1">
            {members.map((m) => (
              <div key={m} className="flex justify-between text-sm">
                <span>{m} <small className="text-muted">낸 돈 {won(Math.round(paidBy[m] ?? 0))}</small></span>
                <span className={`font-semibold tabular-nums ${balances[m] > 0.5 ? "text-c4" : balances[m] < -0.5 ? "text-c6" : "text-muted"}`}>
                  {balances[m] > 0.5 ? `+${won(Math.round(balances[m]))} 받을 돈` : balances[m] < -0.5 ? `${won(Math.round(-balances[m]))} 낼 돈` : "정산 완료"}
                </span>
              </div>
            ))}
          </div>
          {transfers.length > 0 && (
            <div className="border-t border-hairline pt-2.5">
              <div className="mb-1.5 text-xs font-bold text-muted">이렇게 보내면 끝 👇</div>
              {transfers.map((t, i) => (
                <div key={i} className="py-0.5 text-sm font-semibold">
                  {t.from} → {t.to} <span className="text-accent tabular-nums">{won(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
