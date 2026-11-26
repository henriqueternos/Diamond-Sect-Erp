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

/**
 * Regra para liberar contrato e termo de retirada: o pedido precisa ter algum
 * valor lançado. É o mesmo critério que faz um pedido deixar de ser
 * "Orçamento" e virar "Confirmado" (pagamento > 0).
 *
 * - O crédito do cliente também conta, porque é uma forma de pagamento (um
 *   pedido pago só com crédito não tem registro em "pagamentos", mas está pago).
 * - Pedido que não tem nada a pagar (total zerado por desconto) não fica
 *   travado para sempre: não há como lançar pagamento num pedido assim.
 */
export function hasPaymentLaunched(
  order: Pick<Order, "totalValue" | "discount" | "surcharge" | "amountPaid" | "creditUsed">
): boolean {
  if ((order.amountPaid || 0) > 0) return true;
  if ((order.creditUsed || 0) > 0) return true;
  return orderNetTotal(order) <= 0;
}
