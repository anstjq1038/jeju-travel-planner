// ============================================================
// 플래너 에이전트용 댓글 도구 (관리자 권한)
//
// Firestore 규칙이 "로그인 필수"라 공개 REST로는 못 쓰므로,
// 로컬에 로그인된 Firebase CLI의 인증을 재사용해 IAM 권한으로 접근한다.
// (IAM 인증 요청은 보안 규칙의 적용을 받지 않음 — 프로젝트 소유자 전용)
//
// 사용법:
//   node tools/agent.mjs list  <planId>
//   node tools/agent.mjs post  <planId> <텍스트>
//   node tools/agent.mjs reply <planId> <부모문서ID> <텍스트>
//   node tools/agent.mjs del   <planId> <문서ID> [문서ID...]
//
// ⚠️ 이 파일에 비밀값은 없다. client_id/secret은 firebase-tools
//    오픈소스에 포함된 공개 상수이고, 실제 자격증명(refresh token)은
//    이 PC의 ~/.config/configstore/firebase-tools.json 에만 있다.
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT = "travelplanner-a4a1c";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// firebase-tools의 공개 OAuth 클라이언트 상수 (오픈소스에 그대로 들어있음)
const CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

async function accessToken() {
  const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const rt = cfg.tokens && cfg.tokens.refresh_token;
  if (!rt) throw new Error("firebase CLI 로그인이 필요합니다: firebase login");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: rt, grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("토큰 교환 실패: " + JSON.stringify(j));
  return j.access_token;
}

const wrap = (v) => {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (typeof v === "boolean") return { booleanValue: v };
  throw new Error("unsupported type");
};
const unwrap = (f) =>
  f.stringValue ?? (f.integerValue != null ? +f.integerValue : f.booleanValue);

async function main() {
  const [cmd, planId, ...rest] = process.argv.slice(2);
  if (!cmd || !planId) {
    console.log("사용법: node tools/agent.mjs <list|post|reply|del> <planId> ...");
    process.exit(1);
  }
  const token = await accessToken();
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const col = `${BASE}/trips/${planId}/comments`;

  if (cmd === "list") {
    const r = await fetch(`${col}?pageSize=300`, { headers: H });
    const j = await r.json();
    const docs = (j.documents || []).map((d) => ({
      id: d.name.split("/").pop(),
      ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, unwrap(v)])),
    })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    for (const c of docs) {
      const tag = c.agent ? " 🤖" : "";
      const re = c.replyTo ? `  (↳ ${c.replyTo})` : "";
      console.log(`${c.id}\t[${c.name}${tag}] ${String(c.text).replace(/\n/g, " ")}${re}`);
    }
    console.log(`--- 총 ${docs.length}건`);
    return;
  }

  if (cmd === "post" || cmd === "reply") {
    const [parentOrText, maybeText] = rest;
    const replyToId = cmd === "reply" ? parentOrText : null;
    const text = cmd === "reply" ? maybeText : parentOrText;
    if (!text) throw new Error("텍스트가 없습니다");
    const fields = {
      name: wrap("여행 플래너"),
      text: wrap(text),
      ts: wrap(Date.now()),
      agent: wrap(true),
    };
    if (replyToId) fields.replyTo = wrap(replyToId);
    const r = await fetch(col, { method: "POST", headers: H, body: JSON.stringify({ fields }) });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    console.log("등록됨:", j.name.split("/").pop());
    return;
  }

  if (cmd === "del") {
    for (const id of rest) {
      const r = await fetch(`${col}/${id}`, { method: "DELETE", headers: H });
      console.log(r.status === 200 ? `삭제됨: ${id}` : `실패(${r.status}): ${id}`);
    }
    return;
  }

  throw new Error("알 수 없는 명령: " + cmd);
}

main().catch((e) => { console.error("오류:", e.message); process.exit(1); });
