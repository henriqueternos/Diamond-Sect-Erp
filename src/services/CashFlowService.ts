import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { CashEntry, CashRegister } from "../types";
import { LogService } from "./LogService";

const cashFlowCol = collection(db, "cashFlow");

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

function registerRef(id: string) {
  return doc(db, "cashFlow", id);
}

export const CashFlowService = {
  todayId,

  /** Escuta TODOS os caixas de um dia (pode ter mais de um: aberto de manhã,
   * fechado, aberto de novo à tarde, etc.), do mais recente pro mais antigo. */
  subscribeForDate(dateId: string, cb: (regs: CashRegister[]) => void) {
    const q = query(cashFlowCol, where("date", "==", dateId));
    return onSnapshot(q, (snap) => {
      const regs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CashRegister[];
      regs.sort((a, b) => ((a.createdAt?.toMillis?.() || 0) < (b.createdAt?.toMillis?.() || 0) ? 1 : -1));
      cb(regs);
    });
  },

  /** Escuta todos os caixas já registrados (para Dashboard/Relatórios). */
  subscribeAll(cb: (regs: CashRegister[]) => void) {
    return onSnapshot(cashFlowCol, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CashRegister[]);
    });
  },

  async open(dateId: string, openingBalance: number, user: { id: string; name: string }) {
    const openSnap = await getDocs(query(cashFlowCol, where("date", "==", dateId), where("status", "==", "aberto")));
    if (!openSnap.empty) {
      throw new Error("Já existe um caixa aberto neste dia. Feche-o antes de abrir um novo.");
    }
    const ref = await addDoc(cashFlowCol, {
      date: dateId,
      status: "aberto",
      openingBalance,
      entries: [],
      openedBy: user.id,
      openedByName: user.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await LogService.record({ userId: user.id, userName: user.name, action: "caixa_aberto", module: "cashFlow", recordId: ref.id });
    return ref.id;
  },

  async addEntry(
    registerId: string,
    current: CashRegister,
    entry: Omit<CashEntry, "id" | "createdAt">,
    user: { id: string; name: string }
  ) {
    if (current.status !== "aberto") {
      throw new Error("Este caixa não está aberto.");
    }
    const newEntry: CashEntry = {
      ...entry,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(registerRef(registerId), { entries: [...current.entries, newEntry], updatedAt: serverTimestamp() }, { merge: true });
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: `caixa_${entry.type}`,
      module: "cashFlow",
      recordId: registerId,
      details: `${entry.description} — ${entry.amount}`,
    });
  },

  computeBalance(reg: CashRegister, systemInflow = 0) {
    const manualIn = reg.entries.filter((e) => e.type === "entrada").reduce((s, e) => s + e.amount, 0);
    const out = reg.entries.filter((e) => e.type === "saida" || e.type === "sangria").reduce((s, e) => s + e.amount, 0);
    const balance = reg.openingBalance + manualIn + systemInflow - out;
    return { manualIn, out, systemInflow, balance };
  },

  async close(registerId: string, closingBalance: number, systemInflow: number, user: { id: string; name: string }) {
    await setDoc(
      registerRef(registerId),
      {
        status: "fechado",
        closingBalance,
        closingSystemInflow: systemInflow,
        closedBy: user.id,
        closedByName: user.name,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await LogService.record({ userId: user.id, userName: user.name, action: "caixa_fechado", module: "cashFlow", recordId: registerId });
  },

  /** Só administrador — exclui um caixa por completo (ex.: aberto por
   * engano, data errada, teste). Fica registrado no log antes de apagar. */
  async remove(registerId: string, reg: CashRegister, user: { id: string; name: string }) {
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "caixa_excluido",
      module: "cashFlow",
      recordId: registerId,
      details: `Caixa de ${reg.date} excluído (status era "${reg.status}")`,
    });
    await deleteDoc(registerRef(registerId));
  },
};
