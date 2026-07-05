import React from "react";
import { OrderStatus, ProductStatus, ORDER_STATUS_LABELS, PRODUCT_STATUS_LABELS } from "../types";

const PRODUCT_COLORS: Record<ProductStatus, string> = {
  disponivel: "bg-success/15 text-success",
  reservado: "bg-warn/15 text-warn",
  em_prova: "bg-diamond/15 text-diamond",
  alugado: "bg-champagne/15 text-champagne",
  lavanderia: "bg-mist-500/15 text-mist-300",
  manutencao: "bg-danger/15 text-danger",
  indisponivel: "bg-ink-600 text-mist-500",
};

const ORDER_COLORS: Record<OrderStatus, string> = {
  orcamento: "bg-mist-500/15 text-mist-300",
  confirmado: "bg-diamond/15 text-diamond",
  em_prova: "bg-champagne/15 text-champagne",
  ajuste_andamento: "bg-warn/15 text-warn",
  pronto_retirada: "bg-success/15 text-success",
  retirado: "bg-diamond-dim/40 text-diamond-soft",
  devolvido: "bg-ink-600 text-mist-300",
  finalizado: "bg-success/20 text-success",
  cancelado: "bg-danger/15 text-danger",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`badge ${PRODUCT_COLORS[status]}`}>{PRODUCT_STATUS_LABELS[status]}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${ORDER_COLORS[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}
