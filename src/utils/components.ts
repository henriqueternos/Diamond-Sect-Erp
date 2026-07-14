import { OrderItem, Product } from "../types";

/** Retorna a lista de componentes que uma linha de pedido efetivamente
 * ocupa para um determinado produto. Regras:
 * - Se o produto não tem `componentNames` (ou está vazio), retorna `null`
 *   — significa "esse produto não usa esse controle", trata como sempre.
 * - Se o item já tem `.components` preenchido, usa exatamente esses.
 * - Se o item NÃO tem `.components` (pedido antigo, de antes dessa
 *   funcionalidade existir), trata como se tivesse selecionado o conjunto
 *   completo — assim nenhum pedido já feito fica "perdendo" componentes
 *   que na prática sempre estiveram todos junto. */
export function effectiveItemComponents(
  item: Pick<OrderItem, "components">,
  product: Pick<Product, "componentNames"> | undefined | null
): string[] | null {
  if (!product?.componentNames || product.componentNames.length === 0) return null;
  if (item.components && item.components.length > 0) return item.components;
  return product.componentNames;
}

/** Dois conjuntos de componentes têm interseção (algum componente em comum)? */
export function componentsOverlap(a: string[], b: string[]): boolean {
  return a.some((c) => b.includes(c));
}
