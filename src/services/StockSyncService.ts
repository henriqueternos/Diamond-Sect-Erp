import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { Order, OrderStatus } from "../types";
import { ProductService, computeStatus } from "./ProductService";

const ordersCol = collection(db, "orders");

/** Status em que o pedido efetivamente "segura" uma unidade física do produto. */
const HOLDING_STATUSES: OrderStatus[] = ["confirmado", "em_prova", "ajuste_andamento", "pronto_retirada", "retirado"];

function bucketForStatus(status: OrderStatus): "reservedQuantity" | "fittingQuantity" | "rentedQuantity" | null {
  if (status === "confirmado" || status === "pronto_retirada") return "reservedQuantity";
  if (status === "em_prova" || status === "ajuste_andamento") return "fittingQuantity";
  if (status === "retirado") return "rentedQuantity";
  return null;
}

export const StockSyncService = {
  /** Recalcula do zero as quantidades reservada/em prova/alugada/disponível de
   * um produto, olhando para todos os pedidos ativos que o usam. Rodar assim
   * (em vez de incrementar/decrementar aos poucos) evita que a contagem
   * "desalinhe" com a realidade se algum passo falhar no meio do caminho. */
  async recomputeForProduct(productId: string) {
    const product = await ProductService.getById(productId);
    if (!product) return;

    const snap = await getDocs(query(ordersCol, where("status", "in", HOLDING_STATUSES)));
    let reserved = 0;
    let fitting = 0;
    let rented = 0;

    snap.docs.forEach((d) => {
      const o = d.data() as Order;
      const item = (o.items || []).find((i) => i.productId === productId);
      if (!item) return;
      const bucket = bucketForStatus(o.status);
      if (bucket === "reservedQuantity") reserved += item.quantity;
      else if (bucket === "fittingQuantity") fitting += item.quantity;
      else if (bucket === "rentedQuantity") rented += item.quantity;
    });

    const maintenance = product.maintenanceQuantity || 0;
    const laundry = product.laundryQuantity || 0;
    const unavailable = product.unavailableQuantity || 0;
    const available = Math.max(product.totalQuantity - reserved - fitting - rented - maintenance - laundry - unavailable, 0);

    const patch = {
      reservedQuantity: reserved,
      fittingQuantity: fitting,
      rentedQuantity: rented,
      availableQuantity: available,
    };
    const status = computeStatus({ ...product, ...patch });

    await updateDoc(doc(db, "products", productId), { ...patch, status, updatedAt: serverTimestamp() });
  },

  async recomputeForProducts(productIds: string[]) {
    const unique = [...new Set(productIds)];
    await Promise.all(unique.map((id) => this.recomputeForProduct(id)));
  },
};
