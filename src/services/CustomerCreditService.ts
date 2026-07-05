import { addDoc, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { Client } from "../types";

const creditsCol = collection(db, "customerCredits");

export interface CustomerCreditEntry {
  id: string;
  clientId: string;
  delta: number; // positivo = crédito concedido/estornado, negativo = crédito usado
  reason: string;
  orderId?: string;
  orderNumber?: string;
  balanceAfter: number;
  userId: string;
  userName: string;
  createdAt?: any;
}

export const CustomerCreditService = {
  /** Ajusta o crédito disponível do cliente de forma atômica (nunca deixa
   * negativo) e registra o motivo no histórico (customerCredits). */
  async adjust(
    clientId: string,
    delta: number,
    reason: string,
    user: { id: string; name: string },
    order?: { id: string; orderNumber: string }
  ) {
    const clientRef = doc(db, "clients", clientId);
    let balanceAfter = 0;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(clientRef);
      if (!snap.exists()) throw new Error("Cliente não encontrado.");
      const current = snap.data() as Client;
      balanceAfter = Math.max((current.availableCredit || 0) + delta, 0);
      tx.update(clientRef, { availableCredit: balanceAfter, updatedAt: serverTimestamp() });
    });

    await addDoc(creditsCol, {
      clientId,
      delta,
      reason,
      orderId: order?.id || null,
      orderNumber: order?.orderNumber || null,
      balanceAfter,
      userId: user.id,
      userName: user.name,
      createdAt: serverTimestamp(),
    });

    return balanceAfter;
  },

  subscribeForClient(clientId: string, callback: (entries: CustomerCreditEntry[]) => void) {
    // Só filtra por clientId (sem orderBy) para não exigir a criação manual
    // de um índice composto no Firestore — a ordenação é feita aqui mesmo.
    const q = query(creditsCol, where("clientId", "==", clientId));
    return onSnapshot(q, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CustomerCreditEntry[];
      entries.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      callback(entries);
    });
  },
};
