import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "../firebase/firebaseConfig";
import { getSecondaryAuth, getSecondaryDb } from "../firebase/secondaryAuth";
import { Order, OrderItem, OrderStatus, Product } from "../types";
import { LogService } from "./LogService";
import { StockSyncService } from "./StockSyncService";
import { effectiveItemComponents, componentsOverlap } from "../utils/components";
import { ProductService } from "./ProductService";
import { CustomerCreditService } from "./CustomerCreditService";
import { AuthService } from "./AuthService";

const ordersCol = collection(db, "orders");
const countersRef = doc(db, "companySettings", "counters");

/** Status que efetivamente "ocupam" o produto numa janela de datas. */
const ACTIVE_STATUSES: OrderStatus[] = [
  "orcamento",
  "confirmado",
  "em_prova",
  "ajuste_andamento",
  "pronto_retirada",
  "retirado",
];

export interface ConflictInfo {
  productId: string;
  productName: string;
  requestedQty: number;
  availableQty: number;
  conflictingOrderId: string;
  conflictingOrderNumber: string;
  conflictingClientName: string;
  fittingDate?: string;
  pickupDate?: string;
  eventDate?: string;
  returnDate?: string;
  status: OrderStatus;
  /** Só preenchido quando o produto tem componentes — quais componentes o
   * pedido conflitante já tem reservado (para mostrar exatamente o que
   * está batendo, ex.: "Paletó"). */
  conflictingComponents?: string[];
}

function calcTotals(order: Pick<Order, "items" | "discount" | "surcharge" | "creditUsed" | "amountPaid">) {
  const totalValue = order.items.reduce((sum, i) => sum + i.unitValue * i.quantity, 0);
  const openValue =
    totalValue - (order.discount || 0) + (order.surcharge || 0) - (order.creditUsed || 0) - (order.amountPaid || 0);
  return { totalValue, openValue: Math.max(openValue, 0) };
}

function rangesOverlap(aStart?: string, aEnd?: string, bStart?: string, bEnd?: string, marginDays = 1) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const margin = marginDays * 24 * 60 * 60 * 1000;
  const a1 = new Date(aStart).getTime() - margin;
  const a2 = new Date(aEnd).getTime() + margin;
  const b1 = new Date(bStart).getTime();
  const b2 = new Date(bEnd).getTime();
  return a1 <= b2 && b1 <= a2;
}

export const OrderService = {
  subscribeAll(callback: (orders: Order[]) => void) {
    const q = query(ordersCol, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[]);
    });
  },

  async getById(id: string): Promise<Order | null> {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as Order;
  },

  /** Gera o próximo número sequencial DS-000001, DS-000002... de forma atômica. */
  async nextOrderNumber(): Promise<string> {
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(countersRef);
      const current = snap.exists() ? snap.data().lastOrderNumber || 0 : 0;
      const next = current + 1;
      tx.set(countersRef, { lastOrderNumber: next }, { merge: true });
      return `DS-${String(next).padStart(6, "0")}`;
    });
  },

  /** Verifica conflitos de agenda/quantidade para os itens de um pedido em criação. */
  async checkConflicts(
    items: OrderItem[],
    dates: { pickupDate?: string; returnDate?: string; fittingDate?: string; eventDate?: string },
    marginDays = 1,
    ignoreOrderId?: string
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    const allOrdersSnap = await getDocs(query(ordersCol, where("status", "in", ACTIVE_STATUSES)));
    const orders = allOrdersSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) } as Order))
      .filter((o) => o.id !== ignoreOrderId);

    // Busca a quantidade disponível real de cada produto envolvido, para
    // mostrar no alerta de conflito (evita o campo ficar sempre zerado), e
    // também o produto inteiro (precisamos de componentNames, se houver).
    const productIds = [...new Set(items.map((i) => i.productId))];
    const availableByProduct = new Map<string, number>();
    const productById = new Map<string, Product>();
    await Promise.all(
      productIds.map(async (id) => {
        const product = await ProductService.getById(id);
        availableByProduct.set(id, product?.availableQuantity ?? 0);
        if (product) productById.set(id, product);
      })
    );

    for (const item of items) {
      const product = productById.get(item.productId);
      const requestedComponents = effectiveItemComponents(item, product);
      for (const o of orders) {
        const overlap = rangesOverlap(
          dates.pickupDate,
          dates.returnDate,
          o.pickupDate,
          o.returnDate,
          marginDays
        );
        if (!overlap) continue;
        const match = o.items.find((i) => i.productId === item.productId);
        if (!match) continue;

        // Produto com componentes (ex.: paletó/calça/colete de um terno):
        // só é conflito de verdade se os componentes pedidos agora e os já
        // reservados nesse outro pedido tiverem algo em comum. Produto sem
        // componentes: mantém o comportamento de sempre (qualquer uso do
        // mesmo produto no período já é conflito).
        if (requestedComponents) {
          const matchComponents = effectiveItemComponents(match, product);
          if (!matchComponents || !componentsOverlap(requestedComponents, matchComponents)) continue;
        }

        conflicts.push({
          productId: item.productId,
          productName: item.productName,
          requestedQty: item.quantity,
          availableQty: availableByProduct.get(item.productId) ?? 0,
          conflictingOrderId: o.id,
          conflictingOrderNumber: o.orderNumber,
          conflictingClientName: o.clientName,
          fittingDate: o.fittingDate,
          pickupDate: o.pickupDate,
          eventDate: o.eventDate,
          returnDate: o.returnDate,
          status: o.status,
          conflictingComponents: requestedComponents ? effectiveItemComponents(match, product) || undefined : undefined,
        });
      }
    }
    return conflicts;
  },

  async create(
    data: Omit<Order, "id" | "orderNumber" | "totalValue" | "openValue" | "createdAt" | "updatedAt">,
    user: { id: string; name: string }
  ) {
    const orderNumber = await this.nextOrderNumber();
    const { totalValue, openValue } = calcTotals(data);
    const ref = await addDoc(ordersCol, {
      ...data,
      orderNumber,
      totalValue,
      openValue,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "pedido_criado",
      module: "orders",
      recordId: ref.id,
      details: `Pedido ${orderNumber} criado`,
    });
    await StockSyncService.recomputeForProducts(data.items.map((i) => i.productId));
    return { id: ref.id, orderNumber };
  },

  async update(id: string, data: Partial<Order>, user: { id: string; name: string }) {
    const current = await this.getById(id);
    let patch: Partial<Order> = { ...data };
    if (
      current &&
      (data.items || data.discount !== undefined || data.surcharge !== undefined || data.creditUsed !== undefined || data.amountPaid !== undefined)
    ) {
      const merged = { ...current, ...data } as Order;
      const totals = calcTotals(merged);
      patch = { ...patch, ...totals };
    }
    await updateDoc(doc(db, "orders", id), { ...patch, updatedAt: serverTimestamp() });
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "pedido_editado",
      module: "orders",
      recordId: id,
    });

    if (current && (data.status !== undefined || data.items !== undefined)) {
      const affectedProductIds = [
        ...current.items.map((i) => i.productId),
        ...(data.items || current.items).map((i) => i.productId),
      ];
      await StockSyncService.recomputeForProducts(affectedProductIds);
    }
  },

  /** Exclusão direta — usar apenas quando quem está chamando já tem certeza
   * de que é admin/gerente (ex.: chamada interna). A tela usa
   * cancelWithApproval, que pede a senha antes de chegar aqui. */
  async remove(id: string, user: { id: string; name: string }) {
    const current = await this.getById(id);
    await updateDoc(doc(db, "orders", id), {
      status: "cancelado" as OrderStatus,
      openValue: 0,
      updatedAt: serverTimestamp(),
    });
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "pedido_excluido",
      module: "orders",
      recordId: id,
    });
    if (current) {
      await StockSyncService.recomputeForProducts(current.items.map((i) => i.productId));
      if (current.creditUsed > 0) {
        await CustomerCreditService.adjust(
          current.clientId,
          current.creditUsed,
          `Estorno — pedido ${current.orderNumber} cancelado`,
          user,
          { id, orderNumber: current.orderNumber }
        );
      }
    }
  },

  /** Cancela um pedido, mas só depois de confirmar a senha de um
   * administrador OU gerente — qualquer usuário pode pedir, mas a
   * transição de status só é aceita pelo Firestore vindo de uma dessas duas
   * contas (verificadas de verdade, numa sessão à parte, sem deslogar quem
   * está usando o sistema). Zera o valor em aberto do pedido, já que um
   * pedido cancelado não deve mais contar como dívida em nenhuma tela. */
  async cancelWithApproval(
    orderId: string,
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

    const current = await this.getById(orderId);
    if (!current) {
      await signOut(secondaryAuth);
      throw new Error("Pedido não encontrado.");
    }

    try {
      // Só essa transição de status exige aprovação — por isso é feita com a
      // sessão de quem aprovou, para satisfazer a regra do Firestore.
      await updateDoc(doc(secondaryDb, "orders", orderId), {
        status: "cancelado",
        openValue: 0,
        updatedAt: serverTimestamp(),
      });
    } finally {
      await signOut(secondaryAuth);
    }

    await LogService.record({
      userId: actingUser.id,
      userName: actingUser.name,
      action: "pedido_cancelado",
      module: "orders",
      recordId: orderId,
      details: `Pedido ${current.orderNumber} cancelado — aprovado por ${approver.username} (${
        profile.role === "admin" ? "administrador" : "gerente"
      })`,
    });

    await StockSyncService.recomputeForProducts(current.items.map((i) => i.productId));

    if (current.creditUsed > 0) {
      await CustomerCreditService.adjust(
        current.clientId,
        current.creditUsed,
        `Estorno — pedido ${current.orderNumber} cancelado`,
        actingUser,
        { id: orderId, orderNumber: current.orderNumber }
      );
    }
  },

  async logConflictOverride(
    user: { id: string; name: string },
    orderInfo: { productId: string; productName: string; quantity: number },
    reason: string
  ) {
    await LogService.record({
      userId: user.id,
      userName: user.name,
      action: "conflito_liberado",
      module: "orders",
      details: `Produto ${orderInfo.productName} (qtd ${orderInfo.quantity}) liberado com conflito. Motivo: ${
        reason || "não informado"
      }`,
    });
  },

  search(orders: Order[], term: string): Order[] {
    if (!term.trim()) return orders;
    const t = term.toLowerCase();
    return orders.filter((o) =>
      [
        o.orderNumber,
        o.clientName,
        o.clientCpf,
        o.clientPhone,
        o.status,
        o.type,
        o.paymentMethod,
        o.eventDate,
        o.fittingDate,
        o.pickupDate,
        o.returnDate,
        ...o.items.map((i) => i.productName),
        ...o.items.map((i) => i.internalCode),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(t))
    );
  },
};

export { calcTotals };
