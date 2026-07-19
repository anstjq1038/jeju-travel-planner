export interface PlanEvent {
  time: string;
  type: string; // 이동 | 식사 | 관광 | 액티비티 | 숙소 | 카페
  title: string;
  note?: string;
  map?: string; // 네이버 지도 검색어
  geo?: [number, number]; // [위도, 경도] — 지도 핀용 (대략적 위치)
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  payer: string; // 멤버 이름
  ts: number;
  uid: string;
  by?: string; // 기록한 사람 표시명
}

export interface Photo {
  id: string;
  data: string; // 압축된 JPEG dataURL
  caption?: string;
  name: string; // 올린 사람
  uid: string;
  ts: number;
}

export interface PlanDay {
  label: string;
  date?: string | null;
  theme: string;
  events: PlanEvent[];
}

export interface Plan {
  id: string;
  type: "여행" | "모임";
  emoji?: string;
  title: string;
  summary?: string;
  status?: "계획중" | "예약중" | "확정" | "완료";
  isSample?: boolean;
  members?: string[];
  startDate?: string | null;
  endDate?: string | null;
  dateLabel?: string;
  nights?: number;
  totalDays?: number;
  infoCard?: { icon?: string; title: string; rows: { k: string; v: string }[]; note?: string };
  decided?: { item: string; choice: string; why: string }[];
  todos?: string[];
  days?: PlanDay[];
  cars?: { name: string; price: string; extra: string; note: string; pick?: boolean; unknown?: boolean }[];
  evNotes?: string[];
  rentalTips?: string[];
  stays?: { name: string; area: string; rooms: string; note: string; pick?: boolean }[];
  foods?: { name: string; cat: string; area: string; note: string }[];
  budgetLabel?: string;
  budget?: { category: string; amount: number }[];
  checklist?: string[];
  links?: { group: string; label: string; url: string; desc: string }[];
}

export interface Comment {
  id: string;
  name: string;
  text: string;
  ts: number;
  uid?: string;
  photo?: string;
  replyTo?: string;
  agent?: boolean;
}
