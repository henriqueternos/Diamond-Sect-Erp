import { Order } from "../types";

/**
 * Valor líquido do pedido: produtos − desconto + acréscimo (visível no contrato).
 *
 * `totalValue` guarda apenas a soma bruta dos itens, então qualquer total
 * de relatório/financeiro deve usar esta função. O crédito usado NÃO entra
 * aqui porque é uma forma de pagamento (já abatida em `openValue`).
 */
export function orderNetTotal(order: Pick<Order, "totalValue" | "discount" | "surcharge">): number {
  return Math.max((order.totalValue || 0) - (order.discount || 0) + (order.surcharge || 0), 0);
}
