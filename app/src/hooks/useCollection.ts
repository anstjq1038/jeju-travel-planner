import { useEffect, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// trips/{planId}/{sub} 실시간 구독 + 추가/삭제 (댓글 외 하위 컬렉션 공용)
export function useSubCollection<T extends { id: string }>(planId: string, sub: string, max = 300) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const q = query(collection(db, "trips", planId, sub), orderBy("ts", "asc"), limit(max));
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
    });
  }, [planId, sub, max]);

  const add = (data: Omit<T, "id">) => addDoc(collection(db, "trips", planId, sub), data as object);
  const remove = (id: string) => deleteDoc(doc(db, "trips", planId, sub, id));

  return { items, add, remove };
}
