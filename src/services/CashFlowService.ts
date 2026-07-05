import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { CashEntry, CashRegister } from "../types";
import { LogService } from "./LogService";

function todayId() {
  return new Date().toISOString().slice(0, 10);
}

function registerRef(dateId: string) {
  return doc(db, "cashFlow", dateId);
}

export const CashFlowService = {
  todayId,

  subscribeDay(dateId: string, cb: (reg: CashRegister | null) => void) {
    return onSnapshot(registerRef(dateId), (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as CashRegister) : null);
    });
  },

  async getDay(dateId: string): Promise<CashRegister | null> {
    const snap = await getDoc(registerRef(dateId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as CashRegister) : null;
  },

  async open(dateId: string, openingBalance: number, user: { id: string; name: string }) {
    const existing = await this.getDay(dateId);
    if (existing && existing.status === "aberto") {
      throw new Error("O caixa deste dia já está aberto.");
    }
    await setDoc(registerRef(dateId), {
      date: dateId,
      status: "aberto",
      openingBalance,
      entries: existing?.entries || [],
      openedBy: user.id,
      openedByName: user.name,
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await LogService.record({ userId: user.id, userName: user.name, action: "caixa_aberto", module: "cashFlow", recordId: dateId });
  },

  async addEntry(dateId: string, entry: Omit<CashEntry, "id" | "createdAt">, user: { id: string; name: string }) {
    const current = await this.getDay(dateId);
    if (!current || current.status !== "aberto") {
      throw new Error("Abra o caixa do dia antes de lançar entradas/saídas.");
    }
    const newEntry: CashEntry = {
      ...entry,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(
      registerRef(dateId),
      { entries: [...current.entries, newEntry], updatedAt: serverTimestamp() },
      { merge: true }
    );
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: `caixa_${entry.type}`,
      module: "cashFlow",
      recordId: dateId,
      details: `${entry.description} — ${entry.amount}`,
    });
  },

  computeBalance(reg: CashRegister, systemInflow = 0) {
    const manualIn = reg.entries.filter((e) => e.type === "entrada").reduce((s, e) => s + e.amount, 0);
    const out = reg.entries
      .filter((e) => e.type === "saida" || e.type === "sangria")
      .reduce((s, e) => s + e.amount, 0);
    const balance = reg.openingBalance + manualIn + systemInflow - out;
    return { manualIn, out, systemInflow, balance };
  },

  async close(dateId: string, closingBalance: number, user: { id: string; name: string }) {
    const current = await this.getDay(dateId);
    if (!current || current.status !== "aberto") {
      throw new Error("Este caixa não está aberto.");
    }
    await setDoc(
      registerRef(dateId),
      {
        status: "fechado",
        closingBalance,
        closedBy: user.id,
        closedByName: user.name,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await LogService.record({ userId: user.id, userName: user.name, action: "caixa_fechado", module: "cashFlow", recordId: dateId });
  },
};
