// ============================================================
// 계획 대시보드 — 홈(목록) + 상세, 해시 라우팅
// 의견(댓글): Firebase 설정 시 실시간 공유, 아니면 로컬 모드
// ============================================================

(function () {
  "use strict";

  const TYPE_COLORS = {
    "이동": "var(--c1)", "식사": "var(--c3)", "관광": "var(--c2)",
    "액티비티": "var(--c5)", "숙소": "var(--c4)", "카페": "var(--c6)",
  };
  const STATUS_CLASS = {
    "계획중": "s-plan", "예약중": "s-booking", "확정": "s-done", "완료": "s-past",
  };

  const won = (n) => "₩" + n.toLocaleString("ko-KR");
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mapUrl = (q) => "https://map.naver.com/p/search/" + encodeURIComponent(q);
  const show = (id, on) => { $(id).hidden = !on; };

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
  }

  // 계획의 날짜 표현 (미정이면 dateLabel)
  function dateText(p) {
    if (!p.startDate) return p.dateLabel || "날짜 미정";
    return p.endDate && p.endDate !== p.startDate
      ? `${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}`
      : fmtDate(p.startDate);
  }

  // D-day (날짜 없으면 null)
  function ddayOf(p) {
    if (!p.startDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(p.startDate + "T00:00:00");
    const end = new Date((p.endDate || p.startDate) + "T00:00:00");
    const diff = Math.round((start - today) / 86400000);
    if (diff > 0) return "D-" + diff;
    if (today <= end) return "진행 중!";
    return "완료";
  }

  // ---------- 저장소 ----------
  const firebaseReady =
    typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.projectId &&
    typeof firebase !== "undefined";

  let store;

  if (firebaseReady) {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.firestore();
    // 경로는 기존과 동일하게 유지 (기존 댓글 보존)
    const planDoc = (id) => db.collection("trips").doc(id);

    store = {
      mode: "live",
      onComments(planId, cb) {
        return planDoc(planId).collection("comments").orderBy("ts", "asc").limit(300)
          .onSnapshot((snap) => {
            const list = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            cb(list);
          });
      },
      async addComment(planId, c) {
        await planDoc(planId).collection("comments").add(c);
      },
    };
  } else {
    const key = (id) => "trip-" + id;
    const load = (id) => JSON.parse(localStorage.getItem(key(id)) || '{"comments":[]}');
    const save = (id, d) => localStorage.setItem(key(id), JSON.stringify(d));
    const cbs = {};

    store = {
      mode: "local",
      onComments(planId, cb) {
        cbs[planId] = cb;
        cb(load(planId).comments);
        return () => { delete cbs[planId]; };
      },
      async addComment(planId, c) {
        const d = load(planId);
        d.comments.push({ id: "local-" + Date.now(), ...c });
        save(planId, d);
        if (cbs[planId]) cbs[planId](d.comments);
      },
    };
  }

  function setBadges() {
    const txt = store.mode === "live" ? "실시간 공유 중" : "로컬 모드 (미리보기)";
    ["storage-badge", "storage-badge-2"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = txt;
      if (store.mode === "live") el.classList.add("live");
    });
  }

  // ══════════════════════════════════════════
  // 홈 화면
  // ══════════════════════════════════════════
  let filter = "전체";

  function renderHome() {
    const upcoming = PLANS
      .filter((p) => p.startDate && ddayOf(p) && ddayOf(p).startsWith("D-"))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    $("home-sub").textContent = upcoming
      ? `총 ${PLANS.length}개 · 가장 가까운 일정은 "${upcoming.title}" (${ddayOf(upcoming)})`
      : `총 ${PLANS.length}개의 계획`;

    const types = ["전체", ...new Set(PLANS.map((p) => p.type))];
    $("filter-tabs").innerHTML = types.map((t) =>
      `<button class="day-tab ${t === filter ? "active" : ""}" data-t="${esc(t)}">
        ${esc(t)}${t === "전체" ? ` (${PLANS.length})` : ` (${PLANS.filter((p) => p.type === t).length})`}
      </button>`).join("");
    $("filter-tabs").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { filter = b.dataset.t; renderHome(); }));

    const list = filter === "전체" ? PLANS : PLANS.filter((p) => p.type === filter);
    $("plan-grid").innerHTML = list.map((p) => {
      const dd = ddayOf(p);
      return `<a class="plan-card" href="#/p/${encodeURIComponent(p.id)}">
        <div class="pc-top">
          <span class="pc-emoji">${p.emoji || "🗓️"}</span>
          <span class="status ${STATUS_CLASS[p.status] || ""}">${esc(p.status || "")}</span>
        </div>
        <div class="pc-title">${esc(p.title)}${p.isSample ? `<span class="tag sample-tag">예시</span>` : ""}</div>
        <div class="pc-summary">${esc(p.summary || "")}</div>
        <div class="pc-foot">
          <span class="pc-date">${esc(dateText(p))}</span>
          ${dd ? `<span class="pc-dday">${esc(dd)}</span>` : ""}
        </div>
        <div class="pc-members">${esc((p.members || []).join(", "))}</div>
      </a>`;
    }).join("") || `<p class="hint">해당 분류의 계획이 없어요.</p>`;
  }

  // ══════════════════════════════════════════
  // 상세 화면
  // ══════════════════════════════════════════
  let activeDay = 0;
  let unsubscribe = null;
  let currentPlan = null;

  function renderDetail(p) {
    currentPlan = p;
    activeDay = 0;

    document.title = p.title;
    $("trip-title").textContent = p.title;
    $("detail-type").textContent = `${p.emoji || ""} ${p.type}`;
    const bits = [dateText(p)];
    if (p.members && p.members.length) bits.push(p.members.join(", "));
    $("trip-sub").textContent = bits.join(" · ");

    // 예시 안내
    if (p.isSample) {
      $("sample-note").hidden = false;
      $("sample-note").innerHTML =
        `이건 <b>구조를 보여드리는 예시</b>입니다. 실제 모임 내용을 알려주시면 채워드리고, 필요 없으면 지워달라고 하세요.`;
    } else {
      $("sample-note").hidden = true;
    }

    renderStats(p);
    renderDecided(p);
    renderTodos(p);
    renderInfo(p);
    renderDays(p);
    renderCars(p);
    renderStays(p);
    renderFoods(p);
    renderBudget(p);
    renderChecklist(p);
    renderLinks(p);

    // 의견
    renderName();
    renderComments([]);
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    unsubscribe = store.onComments(p.id, renderComments);
  }

  function renderStats(p) {
    const dd = ddayOf(p);
    const tiles = [];
    if (dd) tiles.push(`<div class="stat"><div class="label">출발까지</div><div class="value accent">${esc(dd)}</div></div>`);
    else tiles.push(`<div class="stat"><div class="label">날짜</div><div class="value accent">미정</div></div>`);
    if (p.nights) tiles.push(`<div class="stat"><div class="label">일정</div><div class="value">${p.nights}박 ${p.totalDays}일</div></div>`);
    tiles.push(`<div class="stat"><div class="label">인원</div><div class="value">${(p.members || []).length}명</div></div>`);
    if (p.budget) {
      const total = p.budget.reduce((s, b) => s + b.amount, 0);
      tiles.push(`<div class="stat"><div class="label">${esc(p.budgetLabel || "예산")}</div><div class="value">${won(total)}</div></div>`);
    }
    $("stat-row").innerHTML = tiles.join("");
  }

  function renderDecided(p) {
    show("sec-decided", !!p.decided);
    if (!p.decided) return;
    $("decided").innerHTML = p.decided.map((d) => `
      <div class="decision">
        <div class="decision-head">
          <span class="decision-item">${esc(d.item)}</span>
          <span class="decision-choice">${esc(d.choice)}</span>
        </div>
        <div class="decision-why">${esc(d.why)}</div>
      </div>`).join("");
  }

  function renderTodos(p) {
    show("sec-todos", !!p.todos);
    if (!p.todos) return;
    $("todos").innerHTML = p.todos.map((t) => `<li>${esc(t)}</li>`).join("");
  }

  function renderInfo(p) {
    show("sec-info", !!p.infoCard);
    if (!p.infoCard) return;
    const c = p.infoCard;
    $("info-title").textContent = `${c.icon || "ℹ️"} ${c.title}`;
    $("info-rows").innerHTML =
      c.rows.map((r) => `<div class="kv"><span class="k">${esc(r.k)}</span><span class="v">${esc(r.v)}</span></div>`).join("") +
      (c.note ? `<p class="hint">${esc(c.note)}</p>` : "");
  }

  function renderDays(p) {
    show("sec-days", !!(p.days && p.days.length));
    if (!p.days || !p.days.length) return;
    $("day-tabs").innerHTML = p.days.map((d, i) =>
      `<button class="day-tab ${i === activeDay ? "active" : ""}" data-i="${i}">${esc(d.label)}</button>`).join("");
    $("day-tabs").querySelectorAll(".day-tab").forEach((b) =>
      b.addEventListener("click", () => { activeDay = Number(b.dataset.i); renderDays(p); }));
    $("day-tabs").hidden = p.days.length < 2;

    const d = p.days[activeDay];
    $("day-theme").textContent = d.date ? `${fmtDate(d.date)} — ${d.theme}` : d.theme;
    $("timeline").innerHTML = d.events.map((e) => {
      const color = TYPE_COLORS[e.type] || "var(--muted)";
      return `<li>
        <span class="time">${esc(e.time)}</span>
        <span class="dotcol"><span class="dot" style="--dot:${color}"></span></span>
        <div class="body">
          <div class="title">${esc(e.title)}<span class="type-chip" style="--chip:${color}">${esc(e.type)}</span></div>
          ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
          ${e.map ? `<a class="map-link" href="${esc(mapUrl(e.map))}" target="_blank" rel="noopener noreferrer">📍 지도에서 보기</a>` : ""}
        </div>
      </li>`;
    }).join("");
  }

  function renderCars(p) {
    show("sec-cars", !!p.cars);
    if (!p.cars) return;
    $("cars").innerHTML = p.cars.map((c) => `
      <div class="car ${c.unknown ? "unknown" : ""} ${c.pick ? "pick" : ""}">
        <div class="car-name">${esc(c.name)}${c.pick ? `<span class="tag pick-tag">추천</span>` : ""}</div>
        <div class="car-price">${esc(c.price)}</div>
        <div class="car-extra">${esc(c.extra)}</div>
        <div class="car-note">${esc(c.note)}</div>
      </div>`).join("");
    show("ev-wrap", !!p.evNotes);
    if (p.evNotes) $("ev-notes").innerHTML = p.evNotes.map((n) => `<li>${esc(n)}</li>`).join("");
    show("tips-wrap", !!p.rentalTips);
    if (p.rentalTips) $("rental-tips").innerHTML = p.rentalTips.map((n) => `<li>${esc(n)}</li>`).join("");
  }

  function renderStays(p) {
    show("sec-stays", !!p.stays);
    if (!p.stays) return;
    $("stays").innerHTML = p.stays.map((s) => `
      <div class="listing ${s.pick ? "pick" : ""}">
        <div class="listing-head">
          <span class="listing-name">${esc(s.name)}</span>
          ${s.pick ? `<span class="tag pick-tag">추천</span>` : ""}
          <span class="tag">${esc(s.area)}</span>
        </div>
        <div class="listing-sub">${esc(s.rooms)}</div>
        <div class="listing-note">${esc(s.note)}</div>
        <a class="map-link" href="${esc(mapUrl(s.name + " 제주"))}" target="_blank" rel="noopener noreferrer">📍 지도·후기 보기</a>
      </div>`).join("");
  }

  function renderFoods(p) {
    show("sec-foods", !!p.foods);
    if (!p.foods) return;
    $("foods").innerHTML = p.foods.map((f) => `
      <div class="listing">
        <div class="listing-head">
          <span class="listing-name">${esc(f.name)}</span>
          <span class="tag">${esc(f.cat)}</span>
        </div>
        <div class="listing-sub">${esc(f.area)}</div>
        <div class="listing-note">${esc(f.note)}</div>
        <a class="map-link" href="${esc(mapUrl(f.name + " " + f.area))}" target="_blank" rel="noopener noreferrer">📍 지도·후기 보기</a>
      </div>`).join("");
  }

  function renderBudget(p) {
    show("sec-budget", !!p.budget);
    if (!p.budget) return;
    $("budget-title").textContent = `💰 ${p.budgetLabel || "예산"}`;
    const total = p.budget.reduce((s, b) => s + b.amount, 0);
    const max = Math.max(...p.budget.map((b) => b.amount));
    const colors = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
    $("budget-total").innerHTML = `${won(total)} <small>/ ${esc(p.budgetLabel || "총액")}</small>`;
    $("budget-bars").innerHTML = p.budget.map((b, i) => `
      <div class="budget-row">
        <div class="meta"><span>${esc(b.category)}</span><span class="amt">${won(b.amount)}</span></div>
        <div class="budget-track">
          <div class="budget-fill" style="width:${(b.amount / max) * 100}%; --fill:${colors[i % colors.length]}"></div>
        </div>
      </div>`).join("");
  }

  function renderChecklist(p) {
    show("sec-checklist", !!p.checklist);
    if (!p.checklist) return;
    const KEY = "trip-check-" + p.id;
    const checked = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
    $("checklist").innerHTML = p.checklist.map((item, i) => `
      <li><label>
        <input type="checkbox" data-i="${i}" ${checked.has(i) ? "checked" : ""}/>
        <span>${esc(item)}</span>
      </label></li>`).join("");
    $("checklist").querySelectorAll("input").forEach((cb) =>
      cb.addEventListener("change", () => {
        const i = Number(cb.dataset.i);
        cb.checked ? checked.add(i) : checked.delete(i);
        localStorage.setItem(KEY, JSON.stringify([...checked]));
      }));
  }

  function renderLinks(p) {
    show("sec-links", !!p.links);
    if (!p.links) return;
    const groups = [...new Set(p.links.map((l) => l.group))];
    $("links").innerHTML = groups.map((g) => `
      <div class="link-group">
        <h3 class="sub-h">${esc(g)}</h3>
        ${p.links.filter((l) => l.group === g).map((l) => `
          <a class="link-row" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
            <span class="link-label">${esc(l.label)}</span>
            <span class="link-desc">${esc(l.desc)}</span>
            <span class="link-arrow">↗</span>
          </a>`).join("")}
      </div>`).join("");
  }

  // ---------- 이름 ----------
  const NAME_KEY = "trip-username";
  const getName = () => localStorage.getItem(NAME_KEY) || "";

  function renderName() {
    const name = getName();
    const card = document.querySelector(".name-card");
    const old = card.querySelector(".greeting");
    if (old) old.remove();
    if (name) {
      $("user-name").value = name;
      card.insertAdjacentHTML("beforeend",
        `<p class="greeting">안녕하세요, <b>${esc(name)}</b>님! 의견을 남겨보세요 👇</p>`);
    }
  }

  $("save-name").addEventListener("click", () => {
    const v = $("user-name").value.trim();
    if (!v) { alert("이름을 입력해주세요!"); return; }
    localStorage.setItem(NAME_KEY, v);
    renderName();
  });

  // ---------- 의견 (대댓글) ----------
  let replyTo = null;

  const fmtWhen = (ts) => ts ? new Date(ts).toLocaleString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "";

  function commentHTML(c, isReply, parentName) {
    const agent = c.agent ? `<span class="agent-badge">플래너</span>` : "";
    const to = isReply && parentName ? `<span class="reply-to">→ ${esc(parentName)}님께</span>` : "";
    return `<li class="${isReply ? "reply" : ""} ${c.agent ? "from-agent" : ""}">
      <div class="c-head">
        <span class="who">${esc(c.name)}</span>${agent}${to}
        <span class="when">${fmtWhen(c.ts)}</span>
      </div>
      <div class="txt">${esc(c.text)}</div>
      ${isReply ? "" : `<button class="reply-btn" data-id="${esc(c.id)}" data-name="${esc(c.name)}">답글</button>`}
    </li>`;
  }

  function renderComments(list) {
    const box = $("comments");
    if (!list.length) {
      box.innerHTML = `<li class="empty">아직 의견이 없어요. 첫 의견을 남겨보세요!</li>`;
      return;
    }
    const roots = list.filter((c) => !c.replyTo).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const byParent = {};
    list.filter((c) => c.replyTo).forEach((c) => {
      (byParent[c.replyTo] = byParent[c.replyTo] || []).push(c);
    });
    Object.values(byParent).forEach((arr) => arr.sort((a, b) => (a.ts || 0) - (b.ts || 0)));

    box.innerHTML = roots.map((r) =>
      commentHTML(r, false) + (byParent[r.id] || []).map((x) => commentHTML(x, true, r.name)).join("")
    ).join("");

    box.querySelectorAll(".reply-btn").forEach((b) =>
      b.addEventListener("click", () => {
        replyTo = { id: b.dataset.id, name: b.dataset.name };
        renderReplyBar();
        $("comment-text").focus();
      }));
  }

  function renderReplyBar() {
    const bar = $("reply-bar");
    if (!replyTo) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false;
    bar.innerHTML = `<span><b>${esc(replyTo.name)}</b>님에게 답글 다는 중</span>
      <button id="cancel-reply" class="link-btn">취소</button>`;
    $("cancel-reply").addEventListener("click", () => { replyTo = null; renderReplyBar(); });
  }

  $("send-comment").addEventListener("click", async () => {
    const name = getName();
    const text = $("comment-text").value.trim();
    if (!name) { alert("먼저 위에서 이름을 저장해주세요!"); return; }
    if (!text || !currentPlan) return;
    const c = { name, text, ts: Date.now() };
    if (replyTo) c.replyTo = replyTo.id;
    await store.addComment(currentPlan.id, c);
    $("comment-text").value = "";
    replyTo = null;
    renderReplyBar();
  });

  // ══════════════════════════════════════════
  // 라우터
  // ══════════════════════════════════════════
  function route() {
    const m = location.hash.match(/^#\/p\/(.+)$/);
    const plan = m ? PLANS.find((p) => p.id === decodeURIComponent(m[1])) : null;

    if (plan) {
      show("view-home", false);
      show("view-detail", true);
      renderDetail(plan);
    } else {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      currentPlan = null;
      show("view-detail", false);
      show("view-home", true);
      document.title = "우리 계획";
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  setBadges();
  route();
})();
