import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "../firebase/firebaseConfig";
import { getSecondaryAuth, getSecondaryDb } from "../firebase/secondaryAuth";
import { AuthService } from "./AuthService";
import { Order, Payment, PaymentMethod } from "../types";
import { LogService } from "./LogService";

const paymentsCol = collection(db, "payments");

export const PaymentService = {
  subscribeAll(callback: (payments: Payment[]) => void) {
    const q = query(paymentsCol, orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Payment[]);
    });
  },

  /** Escuta os pagamentos de um único pedido (sem orderBy, para não exigir
   * um índice composto no Firestore — a ordenação é feita aqui mesmo). */
  subscribeForOrder(orderId: string, callback: (payments: Payment[]) => void) {
    const q = query(paymentsCol, where("orderId", "==", orderId));
    return onSnapshot(q, (snap) => {
      const payments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Payment[];
      payments.sort((a, b) => (a.date < b.date ? 1 : -1));
      callback(payments);
    });
  },

  /** Registra um novo pagamento e atualiza o valor pago/em aberto do pedido.
   * Roda como transação: lê o pedido mais atual do Firestore no momento de
   * gravar, para dois pagamentos lançados quase ao mesmo tempo (duas abas,
   * dois vendedores) nunca sobrescreverem um ao outro. */
  async register(
    order: { id: string },
    data: { amount: number; method: PaymentMethod; cardBrand?: string; date: string },
    user: { id: string; name: string }
  ) {
    if (data.amount <= 0) throw new Error("Informe um valor de pagamento maior que zero.");

    const orderRef = doc(db, "orders", order.id);
    const paymentRef = doc(paymentsCol);
    let orderNumberForLog = order.id;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("Pedido não encontrado — pode ter sido removido.");
      const current = snap.data() as Order;
      orderNumberForLog = current.orderNumber;

      const newAmountPaid = (current.amountPaid || 0) + data.amount;
      const newOpenValue = Math.max(
        current.totalValue - current.discount + current.surcharge - current.creditUsed - newAmountPaid,
        0
      );

      tx.set(paymentRef, {
        orderId: order.id,
        orderNumber: current.orderNumber,
        clientName: current.clientName,
        amount: data.amount,
        method: data.method,
        cardBrand: data.cardBrand || null,
        date: data.date,
        registeredBy: user.id,
        registeredByName: user.name,
        createdAt: serverTimestamp(),
      });

      tx.update(orderRef, {
        amountPaid: newAmountPaid,
        openValue: newOpenValue,
        updatedAt: serverTimestamp(),
      });
    });

    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "pagamento_registrado",
      module: "financial",
      recordId: order.id,
      details: `Pagamento de ${data.amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} (${data.method}) no pedido ${orderNumberForLog}`,
    });
  },

  /** Exclui um pagamento já lançado, mas só depois de confirmar a senha de
   * um administrador OU gerente. A exclusão é feita usando uma sessão
   * secundária, autenticada como essa pessoa (por isso a senha é necessária
   * de verdade, e não é só um alerta na tela) — a mesma técnica usada para
   * cadastrar funcionários, sem nunca deslogar quem está usando o sistema. */
  async removeWithAdminAuth(
    paymentId: string,
    order: { id: string },
    approver: { username: string; password: string },
    actingUser: { id: string; name: string }
  ) {
    const email = await AuthService.findEmailByUsername(approver.username);
    if (!email) throw new Error("Usuário não encontrado.");

    const secondaryAuth = getSecondaryAuth();
    let credential;
    try {
      credential = await signInWithEmailAndPassword(secondaryAuth, email, approver.password);
    } catch {
      throw new Error("Usuário ou senha incorretos.");
    }

    const secondaryDb = getSecondaryDb();
    const profileSnap = await getDoc(doc(secondaryDb, "users", credential.user.uid));
    const profile = profileSnap.exists() ? (profileSnap.data() as any) : null;

    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      await signOut(secondaryAuth);
      throw new Error("Esse usuário não tem permissão de administrador ou gerente.");
    }

    const paymentRef = doc(secondaryDb, "payments", paymentId);
    const orderRef = doc(secondaryDb, "orders", order.id);
    let removedAmount = 0;
    let orderNumberForLog = order.id;

    try {
      await runTransaction(secondaryDb, async (tx) => {
        const paySnap = await tx.get(paymentRef);
        if (!paySnap.exists()) throw new Error("Pagamento não encontrado — pode já ter sido excluído.");
        const payment = paySnap.data() as Payment;
        removedAmount = payment.amount;

        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Pedido não encontrado.");
        const current = orderSnap.data() as Order;
        orderNumberForLog = current.orderNumber;

        const newAmountPaid = Math.max((current.amountPaid || 0) - payment.amount, 0);
        const newOpenValue = Math.max(
          current.totalValue - current.discount + current.surcharge - current.creditUsed - newAmountPaid,
          0
        );

        tx.delete(paymentRef);
        tx.update(orderRef, {
          amountPaid: newAmountPaid,
          openValue: newOpenValue,
          updatedAt: serverTimestamp(),
        });
      });
    } finally {
      await signOut(secondaryAuth);
    }

    await LogService.record({
      userId: actingUser.id,
      userName: actingUser.name,
      action: "pagamento_excluido",
      module: "financial",
      recordId: order.id,
      details: `Pagamento de ${removedAmount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} excluído do pedido ${orderNumberForLog} — aprovado por ${approver.username} (${profile.role === "admin" ? "administrador" : "gerente"})`,
    });
  },
};
