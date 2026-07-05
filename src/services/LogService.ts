import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  limit as fsLimit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { LogEntry } from "../types";

const logsCol = collection(db, "logs");

export const LogService = {
  async record(entry: Omit<LogEntry, "id" | "createdAt">) {
    await addDoc(logsCol, {
      ...entry,
      createdAt: serverTimestamp(),
    });
  },

  /** Escuta os últimos N logs em tempo real (usado no Dashboard / Auditoria). */
  subscribeRecent(callback: (logs: LogEntry[]) => void, max = 50) {
    const q = query(logsCol, orderBy("createdAt", "desc"), fsLimit(max));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  },
};
