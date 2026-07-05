import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { Expense } from "../types";

const expensesCol = collection(db, "expenses");

export const ExpenseService = {
  subscribeAll(callback: (expenses: Expense[]) => void) {
    const q = query(expensesCol, orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Expense[]);
    });
  },

  async create(data: Omit<Expense, "id" | "createdAt">) {
    const ref = await addDoc(expensesCol, { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  async update(id: string, data: Partial<Expense>) {
    await updateDoc(doc(db, "expenses", id), data);
  },

  async remove(id: string) {
    await deleteDoc(doc(db, "expenses", id));
  },
};
