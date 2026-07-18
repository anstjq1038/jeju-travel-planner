// ============================================================
// 여행 플래너 대시보드
// - plan-data.js 의 TRIP_PLAN 을 화면에 렌더링
// - 의견(댓글): Firebase 설정 시 실시간 공유, 아니면 로컬 모드
// ============================================================

(function () {
  "use strict";

  const P = TRIP_PLAN;
  const TYPE_COLORS = {
    "이동": "var(--c1)",
    "식사": "var(--c3)",
    "관광": "var(--c2)",
    "액티비티": "var(--c5)",
    "숙소": "var(--c4)",
    "카페": "var(--c6)",
  };
  const won = (n) => "₩" + n.toLocaleString("ko-KR");
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- 저장소 (Firebase or localStorage) ----------
  const firebaseReady =
    typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.projectId &&
    typeof firebase !== "undefined";

  let store;

  if (firebaseReady) {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.firestore();
    const base = db.collection("trips").doc(P.id);

    store = {
      mode: "live",
      onComments(cb) {
        base.collection("comments").orderBy("ts", "desc").limit(100)
          .onSnapshot((snap) => {
            const list = [];
            snap.forEach((d) => list.push(d.data()));
            cb(list);
          });
      },
      async addComment(c) {
        await base.collection("comments").add(c);
      },
    };
  } else {
    // 로컬 모드: 이 브라우저에만 저장 (미리보기용)
    const KEY = "trip-" + P.id;
    const load = () => JSON.parse(localStorage.getItem(KEY) || '{"comments":[]}');
    const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
    let commentCb = null;

    store = {
      mode: "local",
      onComments(cb) { commentCb = cb; cb(load().comments); },
      async addComment(c) {
        const d = load();
        d.comments.unshift(c);
        save(d);
        if (commentCb) commentCb(d.comments);
      },
    };
  }

  // ---------- 헤더 & 요약 ----------
  function renderHeader() {
    document.title = P.title;
    $("trip-title").textContent = P.title;
    $("trip-sub").textContent =
      `${P.destination} · ${P.origin} 출발 · ${P.members.join(", ")}`;

    const badge = $("storage-badge");
    if (store.mode === "live") {
      badge.textContent = "실시간 공유 중";
      badge.classList.add("live");
    } else {
      badge.textContent = "로컬 모드 (미리보기)";
    }

    const total = P.budget.reduce((s, b) => s + b.amount, 0);
    $("stat-row").innerHTML = `
      <div class="stat"><div class="label">날짜</div><div class="value accent">${P.datesConfirmed ? "확정" : "미정"}</div></div>
      <div class="stat"><div class="label">일정</div><div class="value">${P.nights}박 ${P.totalDays}일</div></div>
      <div class="stat"><div class="label">인원</div><div class="value">${P.members.length}명</div></div>
      <div class="stat"><div class="label">1인 예산</div><div class="value">${won(total)}</div></div>`;
  }

  // ---------- 아직 안 정한 것 ----------
  function renderOpen() {
    $("open-questions").innerHTML = P.openQuestions
      .map((q) => `<li>${esc(q)}</li>`).join("");
  }

  // ---------- 항공편 ----------
  function renderFlight() {
    const f = P.flight;
    $("flight").innerHTML = `
      <div class="kv"><span class="k">노선</span><span class="v">${esc(f.route)}</span></div>
      <div class="kv"><span class="k">소요</span><span class="v">${esc(f.duration)}</span></div>
      <div class="kv"><span class="k">운항</span><span class="v">${esc(f.frequency)}</span></div>
      <div class="kv"><span class="k">요금</span><span class="v">${esc(f.price)}</span></div>
      <p class="hint">${esc(f.note)}</p>`;
  }

  // ---------- 일정 ----------
  let activeDay = 0;

  function renderTabs() {
    $("day-tabs").innerHTML = P.days.map((d, i) =>
      `<button class="day-tab ${i === activeDay ? "active" : ""}" data-i="${i}">
        ${esc(d.label)}</button>`).join("");
    $("day-tabs").querySelectorAll(".day-tab").forEach((b) =>
      b.addEventListener("click", () => {
        activeDay = Number(b.dataset.i);
        renderTabs(); renderDay();
      }));
  }

  function renderDay() {
    const d = P.days[activeDay];
    $("day-theme").textContent = d.theme;
    $("timeline").innerHTML = d.events.map((e) => {
      const color = TYPE_COLORS[e.type] || "var(--muted)";
      return `<li>
        <span class="time">${esc(e.time)}</span>
        <span class="dotcol"><span class="dot" style="--dot:${color}"></span></span>
        <div class="body">
          <div class="title">${esc(e.title)}<span class="type-chip" style="--chip:${color}">${esc(e.type)}</span></div>
          ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
        </div>
      </li>`;
    }).join("");
  }

  // ---------- 렌터카 ----------
  function renderCars() {
    $("cars").innerHTML = P.cars.map((c) => `
      <div class="car ${c.status === "unknown" ? "unknown" : ""}">
        <div class="car-name">${esc(c.name)}</div>
        <div class="car-price">${esc(c.price)}</div>
        <div class="car-extra">${esc(c.extra)}</div>
        <div class="car-note">${esc(c.note)}</div>
      </div>`).join("");
    $("ev-notes").innerHTML = P.evNotes.map((n) => `<li>${esc(n)}</li>`).join("");
    $("rental-tips").innerHTML = P.rentalTips.map((n) => `<li>${esc(n)}</li>`).join("");
  }

  // ---------- 숙소 ----------
  function renderStays() {
    $("stays").innerHTML = P.stays.map((s) => `
      <div class="listing">
        <div class="listing-head">
          <span class="listing-name">${esc(s.name)}</span>
          <span class="tag">${esc(s.area)}</span>
        </div>
        <div class="listing-sub">${esc(s.rooms)}</div>
        <div class="listing-note">${esc(s.note)}</div>
      </div>`).join("");
  }

  // ---------- 맛집 ----------
  function renderFoods() {
    $("foods").innerHTML = P.foods.map((f) => `
      <div class="listing">
        <div class="listing-head">
          <span class="listing-name">${esc(f.name)}</span>
          <span class="tag">${esc(f.cat)}</span>
        </div>
        <div class="listing-sub">${esc(f.area)}</div>
        <div class="listing-note">${esc(f.note)}</div>
      </div>`).join("");
  }

  // ---------- 예산 ----------
  function renderBudget() {
    const total = P.budget.reduce((s, b) => s + b.amount, 0);
    const max = Math.max(...P.budget.map((b) => b.amount));
    const colors = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
    $("budget-total").innerHTML = `${won(total)} <small>/ 1인 총액</small>`;
    $("budget-bars").innerHTML = P.budget.map((b, i) => `
      <div class="budget-row">
        <div class="meta"><span>${esc(b.category)}</span><span class="amt">${won(b.amount)}</span></div>
        <div class="budget-track">
          <div class="budget-fill" style="width:${(b.amount / max) * 100}%; --fill:${colors[i % colors.length]}"></div>
        </div>
      </div>`).join("");
  }

  // ---------- 준비물 ----------
  function renderChecklist() {
    const KEY = "trip-check-" + P.id;
    const checked = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
    $("checklist").innerHTML = P.checklist.map((item, i) => `
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

  // ---------- 의견 ----------
  function renderComments(list) {
    if (!list.length) {
      $("comments").innerHTML = `<li class="empty">아직 의견이 없어요. 첫 의견을 남겨보세요!</li>`;
      return;
    }
    $("comments").innerHTML = list.map((c) => {
      const when = c.ts ? new Date(c.ts).toLocaleString("ko-KR", {
        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      }) : "";
      return `<li>
        <span class="who">${esc(c.name)}</span><span class="when">${when}</span>
        <div class="txt">${esc(c.text)}</div>
      </li>`;
    }).join("");
  }

  $("send-comment").addEventListener("click", async () => {
    const name = getName();
    const text = $("comment-text").value.trim();
    if (!name) { alert("먼저 위에서 이름을 저장해주세요!"); return; }
    if (!text) return;
    await store.addComment({ name, text, ts: Date.now() });
    $("comment-text").value = "";
  });

  // ---------- 시작 ----------
  renderHeader();
  renderOpen();
  renderFlight();
  renderTabs();
  renderDay();
  renderCars();
  renderStays();
  renderFoods();
  renderBudget();
  renderChecklist();
  renderName();
  renderComments([]);
  store.onComments(renderComments);
})();
