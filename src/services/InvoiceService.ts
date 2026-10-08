import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { Invoice, InvoiceStatus } from "../types";
import { LogService } from "./LogService";

const invoicesCol = collection(db, "invoices");

function invoiceRef(orderId: string) {
  return doc(db, "invoices", orderId);
}

export const InvoiceService = {
  subscribeAll(cb: (invoices: Invoice[]) => void) {
    return onSnapshot(invoicesCol, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Invoice[]);
    });
  },

  async getForOrder(orderId: string): Promise<Invoice | null> {
    const snap = await getDoc(invoiceRef(orderId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Invoice) : null;
  },

  /** Cria ou atualiza o registro de controle de nota fiscal de um pedido —
   * chamado sempre que o pedido é criado/editado e o campo "Emitir nota
   * fiscal?" é marcado. Nunca mexe em nada da coleção `orders`. */
  async setWillIssue(
    order: { id: string; orderNumber: string; clientName: string; totalValue: number },
    willIssue: boolean,
    user: { id: string; name: string }
  ) {
    const existing = await this.getForOrder(order.id);
    const status: InvoiceStatus = !willIssue ? "nao_aplicavel" : existing?.status === "emitida" ? "emitida" : "pendente";
    await setDoc(
      invoiceRef(order.id),
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        totalValue: order.totalValue,
        willIssue,
        status,
        updatedBy: user.id,
        updatedByName: user.name,
        updatedAt: serverTimestamp(),
        ...(existing ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  },

  async markIssued(orderId: string, invoiceNumber: string, issueDate: string, user: { id: string; name: string }) {
    await setDoc(
      invoiceRef(orderId),
      { status: "emitida", invoiceNumber, issueDate, updatedBy: user.id, updatedByName: user.name, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "nota_fiscal_emitida",
      module: "orders",
      recordId: orderId,
      details: `Nota fiscal nº ${invoiceNumber} marcada como emitida`,
    });
  },

  async markPending(orderId: string, user: { id: string; name: string }) {
    await setDoc(
      invoiceRef(orderId),
      { status: "pendente", updatedBy: user.id, updatedByName: user.name, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },

  async saveNotes(orderId: string, notes: string, user: { id: string; name: string }) {
    await setDoc(invoiceRef(orderId), { notes, updatedBy: user.id, updatedByName: user.name, updatedAt: serverTimestamp() }, { merge: true });
  },
};
