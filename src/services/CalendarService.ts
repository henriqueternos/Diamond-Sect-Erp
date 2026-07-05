import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { CalendarEvent } from "../types";

const eventsCol = collection(db, "calendarEvents");

export const CalendarService = {
  subscribeAll(callback: (events: CalendarEvent[]) => void) {
    const q = query(eventsCol, orderBy("date", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CalendarEvent[]);
    });
  },

  async create(data: Omit<CalendarEvent, "id" | "createdAt">) {
    const ref = await addDoc(eventsCol, { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  async remove(id: string) {
    await deleteDoc(doc(db, "calendarEvents", id));
  },
};
