// ============================================================
// 서비스 워커 — 오프라인 지원
// 전략: 네트워크 우선(항상 최신), 실패 시 캐시(오프라인일 때 마지막 본 화면)
// Firestore 실시간 통신은 건드리지 않음 (same-origin GET만 캐시)
// ============================================================

const CACHE = "plan-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 우리 사이트의 GET 요청만 처리 (Firestore·외부 CDN은 브라우저 기본 동작)
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) =>
          hit ||
          // 페이지 이동 요청이 캐시에 없으면 앱 셸로
          (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
