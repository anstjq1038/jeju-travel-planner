// ============================================================
// 여행 플래너 대시보드
// - plan-data.js 의 TRIP_PLAN 을 화면에 렌더링
// - 투표/댓글: Firebase 설정 시 실시간 공유, 아니면 로컬 모드
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
      onVotes(cb) {
        base.collection("votes").onSnapshot((snap) => {
          const votes = {};
          snap.forEach((d) => (votes[d.id] = d.data()));
          cb(votes); // { pollId: { optionId: [names] } }
        });
      },
      async vote(pollId, optionId, name) {
        const ref = base.collection("votes").doc(pollId);
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(ref);
          const data = doc.exists ? doc.data() : {};
          // 한 사람은 질문당 한 표: 기존 표 제거 후 새 표
          for (const k of Object.keys(data)) {
            data[k] = (data[k] || []).filter((n) => n !== name);
          }
          data[optionId] = [...(data[optionId] || []), name];
          tx.set(ref, data);
        });
      },
      onComments(cb) {
        base.collection("comments").orderBy("ts", "desc").limit(50)
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
    const load = () =>
      JSON.parse(localStorage.getItem(KEY) || '{"votes":{},"comments":[]}');
    const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
    let voteCb = null, commentCb = null;

    store = {
      mode: "local",
      onVotes(cb) { voteCb = cb; cb(load().votes); },
      async vote(pollId, optionId, name) {
        const d = load();
        const poll = d.votes[pollId] || {};
        for (const k of Object.keys(poll)) {
          poll[k] = (poll[k] || []).filter((n) => n !== name);
        }
        poll[optionId] = [...(poll[optionId] || []), name];
        d.votes[pollId] = poll;
        save(d);
        if (voteCb) voteCb(d.votes);
      },
      onComments(cb) { commentCb = cb; cb(load().comments); },
      async addComment(c) {
        const d = load();
        d.comments.unshift(c);
        save(d);
        if (commentCb) commentCb(d.comments);
      },
    };
  }

  // ---------- 헤더 & 요약 타일 ----------
  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일(${"일월화수목금토"[d.getDay()]})`;
  }

  function renderHeader() {
    document.title = P.title;
    $("trip-title").textContent = P.title;
    $("trip-sub").textContent =
      `${P.destination} · ${fmtDate(P.startDate)} ~ ${fmtDate(P.endDate)} · ${P.members.join(", ")}`;

    const badge = $("storage-badge");
    if (store.mode === "live") {
      badge.textContent = "실시간 공유 중";
      badge.classList.add("live");
    } else {
      badge.textContent = "로컬 모드 (미리보기)";
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(P.startDate + "T00:00:00");
    const end = new Date(P.endDate + "T00:00:00");
    const diff = Math.round((start - today) / 86400000);
    const nights = Math.round((end - start) / 86400000);
    let dday;
    if (diff > 0) dday = "D-" + diff;
    else if (today <= end) dday = "여행 중!";
    else dday = "여행 끝";

    const total = P.budget.reduce((s, b) => s + b.amount, 0);
    $("stat-row").innerHTML = `
      <div class="stat"><div class="label">출발까지</div><div class="value accent">${dday}</div></div>
      <div class="stat"><div class="label">일정</div><div class="value">${nights}박 ${nights + 1}일</div></div>
      <div class="stat"><div class="label">인원</div><div class="value">${P.members.length}명</div></div>
      <div class="stat"><div class="label">1인 예산</div><div class="value">${won(total)}</div></div>`;
  }

  // ---------- 일정 ----------
  let activeDay = 0;

  function renderTabs() {
    $("day-tabs").innerHTML = P.days.map((d, i) =>
      `<button class="day-tab ${i === activeDay ? "active" : ""}" data-i="${i}">
        Day ${i + 1}</button>`).join("");
    $("day-tabs").querySelectorAll(".day-tab").forEach((b) =>
      b.addEventListener("click", () => {
        activeDay = Number(b.dataset.i);
        renderTabs(); renderDay();
      }));
  }

  function renderDay() {
    const d = P.days[activeDay];
    $("day-theme").textContent = `${fmtDate(d.date)} — ${d.theme}`;
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

  // ---------- 체크리스트 (개인별 localStorage) ----------
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
        `<p class="greeting">안녕하세요, <b>${esc(name)}</b>님! 이제 투표할 수 있어요 👇</p>`);
    }
  }

  $("save-name").addEventListener("click", () => {
    const v = $("user-name").value.trim();
    if (!v) { alert("이름을 입력해주세요!"); return; }
    localStorage.setItem(NAME_KEY, v);
    renderName();
  });

  // ---------- 투표 ----------
  let voteState = {};

  function renderPolls() {
    const me = getName();
    $("polls").innerHTML = P.polls.map((poll) => {
      const votes = voteState[poll.id] || {};
      const counts = poll.options.map((o) => (votes[o.id] || []).length);
      const totalVotes = counts.reduce((a, b) => a + b, 0);
      return `<div class="poll">
        <p class="q">${esc(poll.question)}</p>
        ${poll.options.map((o, i) => {
          const voters = votes[o.id] || [];
          const pct = totalVotes ? (counts[i] / totalVotes) * 100 : 0;
          const mine = me && voters.includes(me);
          return `<button class="poll-option ${mine ? "mine" : ""}"
                    data-poll="${poll.id}" data-opt="${o.id}">
            <span class="bar" style="transform:scaleX(${pct / 100})"></span>
            <span class="inner">
              <span>${esc(o.label)}
                ${voters.length ? `<span class="voters">— ${esc(voters.join(", "))}</span>` : ""}
              </span>
              <span class="count">${counts[i]}표</span>
            </span>
          </button>`;
        }).join("")}
      </div>`;
    }).join("");

    $("polls").querySelectorAll(".poll-option").forEach((btn) =>
      btn.addEventListener("click", () => {
        const name = getName();
        if (!name) {
          alert("먼저 위에서 이름을 저장해주세요!");
          $("user-name").focus();
          return;
        }
        store.vote(btn.dataset.poll, btn.dataset.opt, name);
      }));
  }

  // ---------- 댓글 ----------
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
  renderTabs();
  renderDay();
  renderBudget();
  renderChecklist();
  renderName();
  renderPolls();          // Firebase 응답 전에도 먼저 그려두기
  renderComments([]);
  store.onVotes((v) => { voteState = v; renderPolls(); });
  store.onComments(renderComments);
})();
