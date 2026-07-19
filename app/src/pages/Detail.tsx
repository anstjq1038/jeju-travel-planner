import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PLANS } from "../data/plans";
import type { Plan, PlanDay } from "../types";
import { TYPE_COLORS, dateText, ddayOf, fmtDate, won } from "../lib/util";
import { Card, MapLink, StatusBadge, Tag } from "../components/ui";
import { AuthCard, CommentsCard } from "../components/Comments";
import { SettlementCard } from "../components/Settlement";
import { DayMap } from "../components/DayMap";
import { PhotosPane } from "../components/Photos";
import { useComments } from "../hooks/useComments";

const PANES = [
  { key: "overview", label: "개요", icon: "📋" },
  { key: "days", label: "일정", icon: "📅" },
  { key: "info", label: "정보", icon: "🔎" },
  { key: "prep", label: "준비", icon: "🎒" },
  { key: "photos", label: "사진", icon: "📷" },
  { key: "talk", label: "의견", icon: "💬" },
] as const;
type PaneKey = (typeof PANES)[number]["key"];

function paneAvailable(p: Plan, key: PaneKey): boolean {
  switch (key) {
    case "overview": return true;
    case "days": return !!p.days?.length;
    case "info": return !!(p.cars || p.stays || p.foods || p.links);
    case "prep": return !!(p.budget || p.checklist || p.members?.length);
    case "photos": return !p.isSample;
    case "talk": return true;
  }
}

export default function Detail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const plan = PLANS.find((p) => p.id === id);
  // ?pane=days 처럼 특정 탭을 바로 열 수 있음 (링크 공유용)
  const initialPane = (PANES.some((x) => x.key === searchParams.get("pane"))
    ? searchParams.get("pane") : "overview") as PaneKey;
  const [pane, setPane] = useState<PaneKey>(initialPane);
  const [dir, setDir] = useState(1); // 전환 방향 (스와이프 모션용)
  const { comments } = useComments(plan?.id ?? "none");

  if (!plan) return <Navigate to="/" replace />;
  const panes = PANES.filter((x) => paneAvailable(plan, x.key));

  const go = (next: PaneKey) => {
    const a = panes.findIndex((x) => x.key === pane);
    const b = panes.findIndex((x) => x.key === next);
    setDir(b > a ? 1 : -1);
    setPane(next);
    window.scrollTo({ top: 0 });
  };

  // 스와이프로 탭 이동
  const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    const i = panes.findIndex((x) => x.key === pane);
    if (power < -80 && i < panes.length - 1) go(panes[i + 1].key);
    else if (power > 80 && i > 0) go(panes[i - 1].key);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <Link to="/" className="sticky top-0 z-40 -mx-4 block bg-page/85 px-4 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] text-sm font-semibold text-accent backdrop-blur-md">
        ← 전체 계획
      </Link>

      <header className="px-1 pb-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-c4/15 px-2.5 py-1 text-xs font-semibold text-c4">실시간 공유 중</span>
          <span className="rounded-full border border-hairline px-2.5 py-1 text-xs font-bold text-ink2">{plan.emoji} {plan.type}</span>
          <StatusBadge status={plan.status} />
        </div>
        <h1 className="mt-2 bg-gradient-to-r from-ink from-30% to-accent bg-clip-text text-[1.7rem] font-extrabold tracking-tight text-transparent">
          {plan.title}
        </h1>
        <p className="mt-1 text-sm text-ink2">{dateText(plan)}{plan.members?.length ? ` · ${plan.members.join(", ")}` : ""}</p>
      </header>

      {plan.isSample && (
        <div className="mb-4 rounded-xl bg-c3/15 px-3.5 py-3 text-sm text-c3">
          이건 <b>구조를 보여드리는 예시</b>입니다. 실제 내용을 알려주시면 채워드려요.
        </div>
      )}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={pane} custom={dir}
          initial={{ opacity: 0, x: 40 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 * dir }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.12} onDragEnd={onDragEnd}
        >
          {pane === "overview" && <Overview p={plan} />}
          {pane === "days" && <Days p={plan} />}
          {pane === "info" && <Info p={plan} />}
          {pane === "prep" && <Prep p={plan} />}
          {pane === "photos" && <PhotosPane planId={plan.id} />}
          {pane === "talk" && (<><AuthCard /><CommentsCard planId={plan.id} /></>)}
        </motion.div>
      </AnimatePresence>

      {/* 하단 탭 */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center gap-0.5 border-t border-hairline bg-surface px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-2px_10px_rgba(11,11,11,0.06)]">
        {panes.map((x) => {
          const active = x.key === pane;
          return (
            <button key={x.key} onClick={() => go(x.key)}
              className={`flex max-w-[110px] flex-1 select-none flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 ${active ? "text-accent" : "text-muted"}`}>
              <motion.span animate={active ? { y: -2, scale: 1.12 } : { y: 0, scale: 1 }} className="relative text-xl leading-none">
                {x.icon}
                {x.key === "talk" && comments.length > 0 && (
                  <span className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-c6 px-1 text-[0.62rem] font-bold text-white">
                    {comments.length > 99 ? "99+" : comments.length}
                  </span>
                )}
              </motion.span>
              <span className={`text-[0.68rem] ${active ? "font-bold" : ""}`}>{x.label}</span>
              {active && <motion.span layoutId="nav-underline" className="h-0.5 w-4 rounded bg-accent" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ───────── 개요 ───────── */
function Overview({ p }: { p: Plan }) {
  const dd = ddayOf(p);
  const total = p.budget?.reduce((s, b) => s + b.amount, 0);
  const tiles = [
    dd ? { label: "출발까지", value: dd, accent: true } : { label: "날짜", value: "미정", accent: true },
    ...(p.nights ? [{ label: "일정", value: `${p.nights}박 ${p.totalDays}일` }] : []),
    { label: "인원", value: `${p.members?.length ?? 0}명` },
    ...(total ? [{ label: p.budgetLabel || "예산", value: won(total) }] : []),
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-ink/10 bg-surface px-4 py-3.5 dark:border-white/10">
            <div className="text-xs text-muted">{t.label}</div>
            <div className={`text-xl font-bold tracking-tight ${"accent" in t && t.accent ? "text-accent" : ""}`}>{t.value}</div>
          </motion.div>
        ))}
      </div>

      {p.decided && (
        <Card className="border-l-4 border-l-c3">
          <h2 className="mb-3 text-[1.05rem] font-bold">✅ 확정안 (이유 포함)</h2>
          {p.decided.map((d) => (
            <div key={d.item} className="border-b border-hairline py-2.5 last:border-0 last:pb-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full border border-hairline bg-page px-2 py-px text-[0.72rem] font-bold text-muted">{d.item}</span>
                <span className="text-[0.95rem] font-bold text-accent">{d.choice}</span>
              </div>
              <div className="mt-1 text-[0.82rem] text-ink2">{d.why}</div>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted">바꾸고 싶은 게 있으면 의견 탭에 남겨주세요 👉💬</p>
        </Card>
      )}

      {p.todos && (
        <Card className="border-l-4 border-l-c6">
          <h2 className="mb-3 text-[1.05rem] font-bold">📋 할 일</h2>
          <ul>
            {p.todos.map((t) => (
              <li key={t} className="relative border-b border-hairline py-1.5 pl-5 text-sm last:border-0 before:absolute before:left-0 before:font-bold before:text-c3 before:content-['?']">{t}</li>
            ))}
          </ul>
        </Card>
      )}

      {p.infoCard && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">{p.infoCard.icon} {p.infoCard.title}</h2>
          {p.infoCard.rows.map((r) => (
            <div key={r.k} className="grid grid-cols-[56px_1fr] gap-2.5 border-b border-hairline py-1.5 text-sm last:border-0">
              <span className="text-[0.82rem] text-muted">{r.k}</span><span className="min-w-0">{r.v}</span>
            </div>
          ))}
          {p.infoCard.note && <p className="mt-2 text-xs text-muted">{p.infoCard.note}</p>}
        </Card>
      )}
    </>
  );
}

/* ───────── 일정 ───────── */
function Days({ p }: { p: Plan }) {
  const [i, setI] = useState(0);
  const d: PlanDay = p.days![i];
  return (
    <Card>
      <h2 className="mb-3 text-[1.05rem] font-bold">📅 일정</h2>
      {p.days!.length > 1 && (
        <nav className="sticky top-[calc(40px+env(safe-area-inset-top))] z-10 -my-1 mb-2 flex flex-wrap gap-1.5 bg-surface py-2">
          {p.days!.map((x, j) => (
            <button key={x.label} onClick={() => setI(j)}
              className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${
                i === j ? "border-accent bg-accent font-semibold text-white" : "border-hairline text-ink2"}`}>
              {x.label}
            </button>
          ))}
        </nav>
      )}
      <p className="mb-3.5 text-sm text-ink2">{d.date ? `${fmtDate(d.date)} — ${d.theme}` : d.theme}</p>
      <ol>
        {d.events.map((e, n) => {
          const color = TYPE_COLORS[e.type] || "var(--color-muted)";
          return (
            <motion.li key={`${i}-${n}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.045 }}
              className="grid grid-cols-[44px_12px_1fr] gap-2 pb-4 last:pb-0">
              <span className="pt-0.5 text-right text-xs tabular-nums text-muted">{e.time}</span>
              <span className="relative">
                <span className="relative top-1 z-10 block h-2.5 w-2.5 rounded-full border-2 border-surface outline outline-1 outline-hairline" style={{ background: color }} />
                {n < d.events.length - 1 && <span className="absolute bottom-[-8px] left-1 top-4 w-0.5 bg-hairline" />}
              </span>
              <div className="min-w-0">
                <div className="text-[0.95rem] font-semibold">
                  {e.title}
                  <span className="ml-1.5 rounded-full px-2 py-px align-middle text-[0.68rem] font-semibold text-white" style={{ background: color }}>{e.type}</span>
                </div>
                {e.note && <div className="text-[0.82rem] text-ink2">{e.note}</div>}
                {e.map && <MapLink q={e.map} />}
              </div>
            </motion.li>
          );
        })}
      </ol>
      <DayMap key={i} events={d.events} />
    </Card>
  );
}

/* ───────── 정보 ───────── */
function Info({ p }: { p: Plan }) {
  return (
    <>
      {p.cars && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🚗 렌터카 비교</h2>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {p.cars.map((c) => (
              <div key={c.name} className={`min-w-0 rounded-xl border p-3 ${c.pick ? "border-2 border-accent" : "border-hairline"} ${c.unknown ? "border-dashed" : ""}`}>
                <div className="text-sm font-bold">{c.name} {c.pick && <Tag tone="pick">추천</Tag>}</div>
                <div className="mt-1 text-[0.95rem] font-bold text-accent">{c.price}</div>
                <div className="mt-0.5 text-xs text-ink2">{c.extra}</div>
                <div className="mt-1.5 text-xs text-muted">{c.note}</div>
              </div>
            ))}
          </div>
          {p.evNotes && (<><h3 className="mb-2 mt-5 text-sm text-ink2">⚡ 제주 전기차 충전, 실제로 어떤가</h3>
            <ul>{p.evNotes.map((n) => <li key={n} className="relative py-1 pl-4 text-[0.85rem] text-ink2 before:absolute before:left-1 before:font-bold before:text-muted before:content-['·']">{n}</li>)}</ul></>)}
          {p.rentalTips && (<><h3 className="mb-2 mt-5 text-sm text-ink2">✅ 업체 고를 때</h3>
            <ul>{p.rentalTips.map((n) => <li key={n} className="relative py-1 pl-4 text-[0.85rem] text-ink2 before:absolute before:left-1 before:font-bold before:text-muted before:content-['·']">{n}</li>)}</ul></>)}
        </Card>
      )}
      {p.stays && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🏠 숙소 후보</h2>
          {p.stays.map((s) => (
            <div key={s.name} className={`border-b border-hairline py-3 last:border-0 first:pt-0 ${s.pick ? "rounded-xl bg-accent-soft/50 px-3" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.95rem] font-bold">{s.name}</span>
                {s.pick && <Tag tone="pick">추천</Tag>}
                <Tag>{s.area}</Tag>
              </div>
              <div className="mt-0.5 text-[0.82rem] text-ink2">{s.rooms}</div>
              <div className="mt-0.5 text-[0.82rem] text-muted">{s.note}</div>
              <MapLink q={`${s.name} 제주`} label="📍 지도·후기 보기" />
            </div>
          ))}
        </Card>
      )}
      {p.foods && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🍖 맛집 리스트</h2>
          {p.foods.map((f) => (
            <div key={f.name} className="border-b border-hairline py-3 first:pt-0 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.95rem] font-bold">{f.name}</span><Tag>{f.cat}</Tag>
              </div>
              <div className="mt-0.5 text-[0.82rem] text-ink2">{f.area}</div>
              <div className="mt-0.5 text-[0.82rem] text-muted">{f.note}</div>
              <MapLink q={`${f.name} ${f.area}`} label="📍 지도·후기 보기" />
            </div>
          ))}
        </Card>
      )}
      {p.links && (
        <Card>
          <h2 className="mb-1 text-[1.05rem] font-bold">🔗 예약 & 참고 링크</h2>
          {[...new Set(p.links.map((l) => l.group))].map((g) => (
            <div key={g}>
              <h3 className="mb-2 mt-4 text-sm text-ink2">{g}</h3>
              {p.links!.filter((l) => l.group === g).map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="mb-1.5 flex items-center gap-2 rounded-xl border border-hairline px-3.5 py-3 transition active:scale-[0.99]">
                  <span className="whitespace-nowrap text-sm font-semibold">{l.label}</span>
                  <span className="min-w-0 flex-1 text-xs text-muted">{l.desc}</span>
                  <span className="font-bold text-accent">↗</span>
                </a>
              ))}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ───────── 준비 ───────── */
function Prep({ p }: { p: Plan }) {
  const total = p.budget?.reduce((s, b) => s + b.amount, 0) ?? 0;
  const max = Math.max(...(p.budget?.map((b) => b.amount) ?? [1]));
  const colors = ["var(--color-c1)", "var(--color-c2)", "var(--color-c3)", "var(--color-c4)", "var(--color-c5)", "var(--color-c6)"];
  const [checked, setChecked] = useState<Set<number>>(() =>
    new Set(JSON.parse(localStorage.getItem("trip-check-" + p.id) || "[]")));
  const toggle = (i: number) => {
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    setChecked(next);
    localStorage.setItem("trip-check-" + p.id, JSON.stringify([...next]));
  };
  return (
    <>
      {p.budget && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">💰 {p.budgetLabel || "예산"}</h2>
          <p className="mb-3.5 text-2xl font-bold">{won(total)} <small className="text-xs font-normal text-muted">/ {p.budgetLabel || "총액"}</small></p>
          {p.budget.map((b, i) => (
            <div key={b.category} className="mb-2.5">
              <div className="mb-1 flex justify-between text-[0.82rem]">
                <span>{b.category}</span><span className="tabular-nums text-ink2">{won(b.amount)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-hairline">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(b.amount / max) * 100}%` }}
                  transition={{ delay: i * 0.07, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                  className="h-full rounded-full" style={{ background: colors[i % colors.length] }} />
              </div>
            </div>
          ))}
        </Card>
      )}
      {!p.isSample && !!p.members?.length && <SettlementCard plan={p} />}
      {p.checklist && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🎒 준비물</h2>
          <ul>
            {p.checklist.map((item, i) => (
              <li key={item} className="mb-1.5">
                <label className="flex cursor-pointer items-start gap-2.5 py-1 text-sm">
                  <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)}
                    className="mt-0.5 h-4 w-4 accent-accent" />
                  <span className={checked.has(i) ? "text-muted line-through" : ""}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">체크 상태는 각자 브라우저에 저장돼요.</p>
        </Card>
      )}
    </>
  );
}
