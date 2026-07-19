import { useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PLANS } from "../data/plans";
import type { Plan, PlanDay } from "../types";
import { TYPE_COLORS, dateText, ddayOf, fmtDate, mapUrl, won } from "../lib/util";
import { Card, MapLink, StatusBadge, Tag } from "../components/ui";
import { AuthCard, CommentsCard } from "../components/Comments";
import { DayMap, type DayMapHandle } from "../components/DayMap";
import { PhotosPane } from "../components/Photos";
import { useComments } from "../hooks/useComments";

const PANES = [
  { key: "overview", label: "개요", icon: "📋" },
  { key: "days", label: "일정", icon: "📅" },
  { key: "info", label: "정보", icon: "🔎" },
  { key: "settle", label: "정산", icon: "💳" },
  { key: "photos", label: "사진", icon: "📷" },
  { key: "talk", label: "의견", icon: "💬" },
] as const;
type PaneKey = (typeof PANES)[number]["key"];

function paneAvailable(p: Plan, key: PaneKey): boolean {
  switch (key) {
    case "overview": return true;
    case "days": return !!p.days?.length;
    case "info": return !!(p.cars || p.stays || p.foods || p.links);
    case "settle": return !!(p.budget || p.settlement);
    case "photos": return !p.isSample;
    case "talk": return true;
  }
}

export default function Detail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const plan = PLANS.find((p) => p.id === id);
  const initialPane = (PANES.some((x) => x.key === searchParams.get("pane"))
    ? searchParams.get("pane") : "overview") as PaneKey;
  const [pane, setPane] = useState<PaneKey>(initialPane);
  const [dir, setDir] = useState(1);
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
          {pane === "settle" && <Settle p={plan} />}
          {pane === "photos" && <PhotosPane planId={plan.id} />}
          {pane === "talk" && (<><AuthCard /><CommentsCard planId={plan.id} /></>)}
        </motion.div>
      </AnimatePresence>

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

/* ───────── 공용: 링크 그룹 (관련 카드 바로 아래 배치용) ───────── */
function LinksGroup({ p, groups, title }: { p: Plan; groups: string[]; title?: string }) {
  const links = (p.links ?? []).filter((l) => groups.includes(l.group));
  if (!links.length) return null;
  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {title && <div className="mb-2 text-xs font-bold text-muted">{title}</div>}
      {links.map((l) => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
          className="mb-1.5 flex items-center gap-2 rounded-xl bg-page px-3.5 py-3 transition active:scale-[0.99]">
          <span className="whitespace-nowrap text-sm font-semibold">{l.label}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{l.desc}</span>
          <span className="font-bold text-accent">↗</span>
        </a>
      ))}
    </div>
  );
}

/* ───────── 개요 (토스 스타일: 아이콘 행 + 펼치기) ───────── */
const DECIDE_ICON: Record<string, string> = {
  "날짜": "📅", "렌터카": "🚗", "숙소": "🏠", "Day 2 오후": "⛴️", "전체 동선": "🧭",
};

function Overview({ p }: { p: Plan }) {
  const [open, setOpen] = useState<number | null>(null);
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
        <Card>
          <h2 className="mb-1 text-[1.05rem] font-bold">한눈에 보기</h2>
          {p.decided.map((d, i) => (
            <div key={d.item} className="border-b border-hairline last:border-0">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center gap-3 py-3.5 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-page text-xl">
                  {DECIDE_ICON[d.item] ?? "📍"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{d.item}</span>
                  <span className="block truncate text-[0.95rem] font-bold">{d.choice}</span>
                </span>
                <motion.span animate={{ rotate: open === i ? 180 : 0 }} className="text-muted">⌄</motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <p className="mb-3.5 rounded-xl bg-page p-3.5 text-[0.85rem] leading-relaxed text-ink2">{d.why}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted">눌러서 이유 보기 · 바꾸고 싶으면 의견 탭에 💬</p>
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
          <LinksGroup p={p} groups={["항공권"]} title="바로 예약" />
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

      {p.checklist && <ChecklistCard p={p} />}
    </>
  );
}

function ChecklistCard({ p }: { p: Plan }) {
  const [checked, setChecked] = useState<Set<number>>(() =>
    new Set(JSON.parse(localStorage.getItem("trip-check-" + p.id) || "[]")));
  const toggle = (i: number) => {
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    setChecked(next);
    localStorage.setItem("trip-check-" + p.id, JSON.stringify([...next]));
  };
  return (
    <Card>
      <h2 className="mb-3 text-[1.05rem] font-bold">🎒 준비물</h2>
      <ul>
        {p.checklist!.map((item, i) => (
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
  );
}

/* ───────── 일정 ───────── */
function Days({ p }: { p: Plan }) {
  const [i, setI] = useState(0);
  const d: PlanDay = p.days![i];
  const mapApi = useRef<DayMapHandle>(null);
  const gmapsUrl = (q: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
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
      <DayMap key={i} ref={mapApi} events={d.events} />
      <ol>
        {d.events.map((e, n) => {
          const color = TYPE_COLORS[e.type] || "var(--color-muted)";
          return (
            <motion.li key={`${i}-${n}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.045 }}
              onClick={e.geo ? () => mapApi.current?.focusEvent(n) : undefined}
              className={`grid grid-cols-[44px_12px_1fr] gap-2 pb-4 last:pb-0 ${e.geo ? "cursor-pointer rounded-lg transition active:bg-page" : ""}`}>
              <span className="pt-0.5 text-right text-xs tabular-nums text-muted">{e.time}</span>
              <span className="relative">
                <span className="relative top-1 z-10 block h-2.5 w-2.5 rounded-full border-2 border-surface outline outline-1 outline-hairline" style={{ background: color }} />
                {n < d.events.length - 1 && <span className="absolute bottom-[-8px] left-1 top-4 w-0.5 bg-hairline" />}
              </span>
              <div className="min-w-0">
                <div className="text-[0.95rem] font-semibold">
                  {e.title}
                  <span className="ml-1.5 rounded-full px-2 py-px align-middle text-[0.68rem] font-semibold text-white" style={{ background: color }}>{e.type}</span>
                  {e.geo && <span className="ml-1 align-middle text-[0.7rem] text-muted">🧭</span>}
                </div>
                {e.note && <div className="text-[0.82rem] text-ink2">{e.note}</div>}
                {e.map && (
                  <div className="mt-1.5 flex gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                    <a href={mapUrl(e.map)} target="_blank" rel="noopener noreferrer"
                      className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-[#03c75a] active:scale-95 transition">네이버지도 ↗</a>
                    <a href={gmapsUrl(e.map)} target="_blank" rel="noopener noreferrer"
                      className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-accent active:scale-95 transition">구글지도 ↗</a>
                  </div>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ───────── 정보 (간결화 + 관련 링크 인라인) ───────── */
function Info({ p }: { p: Plan }) {
  return (
    <>
      {p.cars && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🚗 렌터카</h2>
          <div className="grid gap-2.5">
            {p.cars.map((c) => (
              <div key={c.name} className={`flex items-center gap-3 rounded-xl p-3.5 ${c.pick ? "bg-accent-soft/60" : "bg-page"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {c.name} {c.pick && <Tag tone="pick">추천</Tag>}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted">{c.note}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[0.95rem] font-bold text-accent">{c.price}</div>
                  <div className="text-[0.68rem] text-muted">{c.extra}</div>
                </div>
              </div>
            ))}
          </div>
          {(p.evNotes || p.rentalTips) && (
            <details className="mt-3 rounded-xl bg-page p-3.5">
              <summary className="cursor-pointer text-sm font-semibold text-ink2">⚡ 전기차·업체 선택 팁 자세히</summary>
              {p.evNotes && (<><h3 className="mb-1 mt-3 text-xs font-bold text-muted">전기차 충전 실태</h3>
                <ul>{p.evNotes.map((n) => <li key={n} className="relative py-0.5 pl-3.5 text-[0.82rem] text-ink2 before:absolute before:left-0.5 before:text-muted before:content-['·']">{n}</li>)}</ul></>)}
              {p.rentalTips && (<><h3 className="mb-1 mt-3 text-xs font-bold text-muted">업체 고를 때</h3>
                <ul>{p.rentalTips.map((n) => <li key={n} className="relative py-0.5 pl-3.5 text-[0.82rem] text-ink2 before:absolute before:left-0.5 before:text-muted before:content-['·']">{n}</li>)}</ul></>)}
            </details>
          )}
          <LinksGroup p={p} groups={["렌터카"]} title="렌터카 예약 · 가격비교" />
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
              <MapLink q={`${s.name} 제주`} label="📍 지도 보기" />
            </div>
          ))}
        </Card>
      )}

      {p.foods && (
        <Card>
          <h2 className="mb-3 text-[1.05rem] font-bold">🍖 맛집 리스트</h2>
          {p.foods.map((f) => (
            <div key={f.name} className="border-b border-hairline py-3.5 first:pt-0 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.95rem] font-bold">{f.name}</span><Tag>{f.cat}</Tag>
                <span className="text-xs text-muted">{f.area}</span>
              </div>
              {f.why && <p className="mt-1.5 rounded-xl bg-page px-3 py-2 text-[0.85rem] leading-relaxed text-ink2">💬 {f.why}</p>}
              <div className="mt-1 text-[0.78rem] text-muted">{f.note}</div>
              <MapLink q={`${f.name} ${f.area}`} label="📍 지도 보기" />
            </div>
          ))}
          <LinksGroup p={p} groups={["우도 배편", "참고"]} title="함께 보면 좋은 링크" />
        </Card>
      )}
    </>
  );
}

/* ───────── 정산 (예산 + 모임통장 리포트) ───────── */
function Settle({ p }: { p: Plan }) {
  const s = p.settlement;
  const budgetTotal = p.budget?.reduce((x, b) => x + b.amount, 0) ?? 0;
  const max = Math.max(
    ...(p.budget?.map((b) => b.amount) ?? [1]),
    ...(s?.items.map((x) => x.actual) ?? [0]),
  );
  const colors = ["var(--color-c1)", "var(--color-c2)", "var(--color-c3)", "var(--color-c4)", "var(--color-c5)", "var(--color-c6)"];

  return (
    <>
      {p.budget && (
        <Card>
          <h2 className="mb-1 text-[1.05rem] font-bold">💰 {p.budgetLabel || "예산"}</h2>
          <p className="mb-3.5 text-2xl font-bold">{won(budgetTotal)}</p>
          {p.budget.map((b, i) => {
            const actual = s?.items.find((x) => x.category === b.category)?.actual;
            return (
              <div key={b.category} className="mb-3">
                <div className="mb-1 flex justify-between text-[0.82rem]">
                  <span>{b.category}</span>
                  <span className="tabular-nums text-ink2">
                    {won(b.amount)}{actual != null && <b className={actual > b.amount ? "text-c6" : "text-c4"}> → 실제 {won(actual)}</b>}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-hairline">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(b.amount / max) * 100}%` }}
                    transition={{ delay: i * 0.06, duration: 0.6 }}
                    className="h-full rounded-full" style={{ background: colors[i % colors.length] }} />
                </div>
                {actual != null && (
                  <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-hairline">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(actual / max) * 100}%` }}
                      transition={{ delay: i * 0.06 + 0.2, duration: 0.6 }}
                      className="h-full rounded-full opacity-45" style={{ background: colors[i % colors.length] }} />
                  </div>
                )}
              </div>
            );
          })}
          {s && <p className="text-xs text-muted">진한 막대 = 예산 · 연한 막대 = 실제 사용</p>}
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-[1.05rem] font-bold">🧾 정산 내역</h2>
        {s ? (
          <>
            <p className="mb-3 text-xs text-muted">{s.updated}</p>
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-page px-4 py-3">
                <div className="text-xs text-muted">실제 총 지출</div>
                <div className="text-xl font-bold">{won(s.totalActual)}</div>
              </div>
              <div className="rounded-xl bg-page px-4 py-3">
                <div className="text-xs text-muted">1인 부담</div>
                <div className="text-xl font-bold text-accent">{s.perPerson != null ? won(s.perPerson) : "-"}</div>
              </div>
            </div>
            {s.note && <p className="mb-3 rounded-xl bg-page p-3.5 text-[0.85rem] text-ink2">{s.note}</p>}
            {s.transfers && s.transfers.length > 0 && (
              <div className="rounded-xl bg-page p-3.5">
                <div className="mb-1.5 text-xs font-bold text-muted">이렇게 보내면 끝 👇</div>
                {s.transfers.map((t, i) => (
                  <div key={i} className="py-0.5 text-sm font-semibold">
                    {t.from} → {t.to} <span className="tabular-nums text-accent">{won(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="text-4xl">🧾</div>
            <p className="mt-2 text-sm font-semibold">아직 정산 내역이 없어요</p>
            <p className="mx-auto mt-1.5 max-w-72 text-[0.82rem] leading-relaxed text-muted">
              여행은 모임통장으로! 다녀온 뒤 <b className="text-ink2">체크카드 사용내역(캡처·파일)을 Claude에게 올리면</b>,
              분석해서 예산 대비 실제 지출 비교와 정산 결과를 여기에 띄워드려요.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
