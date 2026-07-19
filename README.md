# 🗓️ 우리 계획 — 여행 & 모임 플래너

Claude Code와 대화하며 여행·모임 계획을 짜고, 친구들과 웹 대시보드로 공유하는 프로젝트.

**공개 주소**: https://anstjq1038.github.io/jeju-travel-planner/

## 화면 구성

```
홈 (#/)                    계획 카드 목록, 여행/모임 분류 필터
 └─ 상세 (#/p/{계획ID})     일정·정보·예산·준비물·링크·의견
```

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 골격 (홈 + 상세) |
| `js/plans.js` | **모든 계획 데이터** — 여기만 고치면 화면이 바뀜 |
| `js/app.js` | 라우팅 + 렌더링 + 의견 기능 |
| `js/firebase-config.js` | Firebase 설정 (공개 가능한 값) |
| `css/style.css` | 스타일 (라이트/다크 자동, 모바일 반응형) |
| `og.png` | 카톡 공유 시 뜨는 미리보기 카드 |

## 새 계획 추가하는 법

`js/plans.js`의 `PLANS` 배열에 객체를 하나 추가하면 끝입니다.
**섹션은 "데이터가 있는 것만" 화면에 그려지므로**, 필요 없는 키는 빼면 됩니다.

```js
{
  id: "busan-2027",        // 고유 ID (댓글 저장 경로 — 한번 정하면 바꾸지 말 것!)
  type: "여행",             // "여행" | "모임"  → 홈 화면 분류
  emoji: "🌊",
  title: "부산 1박 2일",
  summary: "카드에 뜰 한 줄 설명",
  status: "계획중",         // 계획중 | 예약중 | 확정 | 완료
  members: ["장문섭", "최지웅"],
  startDate: "2027-05-01",  // 미정이면 null + dateLabel 사용
  endDate: "2027-05-02",

  // ↓ 아래는 전부 선택 사항 (없으면 그 섹션이 안 나옴)
  infoCard: { icon:"✈️", title:"항공편", rows:[{k:"노선",v:"..."}], note:"..." },
  decided:  [{ item:"날짜", choice:"...", why:"..." }],
  todos:    ["예약하기"],
  days:     [{ label:"Day 1", date:"2027-05-01", theme:"...", events:[
              { time:"09:00", type:"이동", title:"출발", note:"", map:"검색어" }
            ]}],
  cars: [], evNotes: [], rentalTips: [],   // 렌터카 (여행용)
  stays: [], foods: [],
  budgetLabel: "1인 예산", budget: [{category:"교통", amount:50000}],
  checklist: ["신분증"],
  links: [{ group:"항공권", label:"...", url:"https://...", desc:"..." }],
}
```

일정 `type` 값에 따라 색이 정해집니다: `이동`(파랑) `식사`(노랑) `관광`(초록) `액티비티`(보라) `숙소`(진초록) `카페`(빨강)

`map` 을 넣으면 "📍 지도에서 보기" 링크가 자동 생성됩니다 (네이버 지도 검색).

## 의견 (댓글 + 대댓글)

- 친구들이 이름을 저장하면 의견을 남길 수 있습니다
- 각 의견에 **답글**을 달 수 있고, 플래너(Claude)의 답글은 파란 배지로 구분됩니다
- Firestore 경로: `trips/{계획ID}/comments` — 계획마다 독립적으로 저장됩니다

## 배포

```bash
git add . && git commit -m "계획 수정" && git push
```
GitHub Pages가 1~2분 내 자동 반영합니다.

> ⚠️ 저장소가 **공개(public)** 입니다. 비밀번호·토큰 같은 건 절대 넣지 마세요.
> (현재 들어있는 Firebase 설정값은 공개돼도 되는 값이고, 보안은 Firestore 규칙으로 처리됩니다.)

## Firebase

- 프로젝트: `travelplanner-a4a1c` (Firestore, 서울 리전)
- 보안 규칙: `firestore.rules` — 의견은 누구나 읽기/작성 가능, 수정·삭제 불가
- 규칙 배포: `firebase deploy --only firestore:rules`

## Claude에게 시키는 법

- "부산 여행 계획 새로 만들어줘"
- "송년회 예시 지우고 진짜 모임 내용 넣어줘"
- "제주 일정에 카페 하나 추가해줘"
- **"의견 확인해줘"** → 친구들 댓글 읽고 정리·반영
- "배포해줘"
