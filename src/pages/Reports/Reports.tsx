import React, { useEffect, useMemo, useState } from "react";
import { OrderService } from "../../services/OrderService";
import { ProductService } from "../../services/ProductService";
import { ClientService } from "../../services/ClientService";
import { exportTableExcel, exportTablePdf, ExportColumn } from "../../services/ExportService";
import { openPrintWindow } from "../../services/DocumentService";
import {
  Client,
  Order,
  OrderStatus,
  OrderType,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  Product,
  PRODUCT_STATUS_LABELS,
} from "../../types";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dateBR(v?: string) {
  if (!v) return "—";
  return v.split("-").reverse().join("/");
}

interface ReportRow {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  productName: string;
  productCode: string;
  productStatus: string;
  quantity: number;
  sellerName: string;
  type: OrderType;
  status: OrderStatus;
  orderDate: string;
  eventDate?: string;
  fittingDate?: string;
  pickupDate?: string;
  returnDate?: string;
  totalValue: number;
  amountPaid: number;
  openValue: number;
  paymentMethod: PaymentMethod;
  discount: number;
  surcharge: number;
  creditUsed: number;
}

export default function Reports() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [productId, setProductId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<"" | OrderType>("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [paymentMethod, setPaymentMethod] = useState<"" | PaymentMethod>("");
  const [eventDate, setEventDate] = useState("");
  const [fittingDate, setFittingDate] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [productStatus, setProductStatus] = useState("");

  useEffect(() => OrderService.subscribeAll(setOrders), []);
  useEffect(() => ProductService.subscribeAll(setProducts), []);
  useEffect(() => ClientService.subscribeAll(setClients), []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sellers = useMemo(() => [...new Set(orders.map((o) => o.sellerName).filter(Boolean))] as string[], [orders]);

  const rows: ReportRow[] = useMemo(() => {
    const result: ReportRow[] = [];
    orders.forEach((o) => {
      if (rangeStart && o.orderDate < rangeStart) return;
      if (rangeEnd && o.orderDate > rangeEnd) return;
      if (sellerName && o.sellerName !== sellerName) return;
      if (clientId && o.clientId !== clientId) return;
      if (type && o.type !== type) return;
      if (status && o.status !== status) return;
      if (paymentMethod && o.paymentMethod !== paymentMethod) return;
      if (eventDate && o.eventDate !== eventDate) return;
      if (fittingDate && o.fittingDate !== fittingDate) return;
      if (pickupDate && o.pickupDate !== pickupDate) return;
      if (returnDate && o.returnDate !== returnDate) return;

      o.items.forEach((item) => {
        if (productId && item.productId !== productId) return;
        const product = productById.get(item.productId);
        if (productStatus && product?.status !== productStatus) return;

        result.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          clientName: o.clientName,
          clientCpf: o.clientCpf,
          clientPhone: o.clientPhone,
          productName: item.productName,
          productCode: item.internalCode,
          productStatus: product ? PRODUCT_STATUS_LABELS[product.status] : "—",
          quantity: item.quantity,
          sellerName: o.sellerName || "—",
          type: o.type,
          status: o.status,
          orderDate: o.orderDate,
          eventDate: o.eventDate,
          fittingDate: o.fittingDate,
          pickupDate: o.pickupDate,
          returnDate: o.returnDate,
          totalValue: o.totalValue,
          amountPaid: o.amountPaid,
          openValue: o.openValue,
          paymentMethod: o.paymentMethod,
          discount: o.discount,
          surcharge: o.surcharge,
          creditUsed: o.creditUsed,
        });
      });
    });
    return result;
  }, [
    orders,
    productById,
    rangeStart,
    rangeEnd,
    productId,
    sellerName,
    clientId,
    type,
    status,
    paymentMethod,
    eventDate,
    fittingDate,
    pickupDate,
    returnDate,
    productStatus,
  ]);

  const distinctOrderIds = new Set(rows.map((r) => r.orderId));
  const totalSold = [...distinctOrderIds]
    .map((id) => orders.find((o) => o.id === id)!)
    .filter((o) => o.type === "venda")
    .reduce((s, o) => s + o.totalValue, 0);
  const totalRented = [...distinctOrderIds]
    .map((id) => orders.find((o) => o.id === id)!)
    .filter((o) => o.type === "locacao")
    .reduce((s, o) => s + o.totalValue, 0);
  const totalValueSum = [...distinctOrderIds].reduce((s, id) => s + orders.find((o) => o.id === id)!.totalValue, 0);
  const totalReceived = [...distinctOrderIds].reduce((s, id) => s + orders.find((o) => o.id === id)!.amountPaid, 0);
  const totalOpen = [...distinctOrderIds].reduce((s, id) => s + orders.find((o) => o.id === id)!.openValue, 0);
  const totalProductsQty = rows.reduce((s, r) => s + r.quantity, 0);

  const rentalAgg = new Map<string, number>();
  rows.forEach((r) => rentalAgg.set(r.productName, (rentalAgg.get(r.productName) || 0) + r.quantity));
  const topProduct = [...rentalAgg.entries()].sort((a, b) => b[1] - a[1])[0];

  const sellerAgg = new Map<string, number>();
  [...distinctOrderIds].forEach((id) => {
    const o = orders.find((x) => x.id === id)!;
    sellerAgg.set(o.sellerName || "—", (sellerAgg.get(o.sellerName || "—") || 0) + 1);
  });
  const topSeller = [...sellerAgg.entries()].sort((a, b) => b[1] - a[1])[0];

  const columns: ExportColumn[] = [
    { key: "orderNumber", label: "Pedido", width: 1.1 },
    { key: "clientName", label: "Cliente", width: 1.6 },
    { key: "clientCpf", label: "CPF", width: 1.2 },
    { key: "productName", label: "Produto", width: 1.6 },
    { key: "productCode", label: "Código", width: 1 },
    { key: "quantity", label: "Qtd.", width: 0.6 },
    { key: "sellerName", label: "Vendedor", width: 1.2 },
    { key: "type", label: "Tipo", width: 0.9 },
    { key: "status", label: "Status", width: 1.2 },
    { key: "orderDate", label: "Data pedido", width: 1 },
    { key: "totalValue", label: "Valor total", width: 1 },
    { key: "amountPaid", label: "Pago", width: 1 },
    { key: "openValue", label: "Em aberto", width: 1 },
    { key: "paymentMethod", label: "Pagamento", width: 1.2 },
  ];

  function exportRows() {
    return rows.map((r) => ({
      ...r,
      type: r.type === "venda" ? "Venda" : "Locação",
      status: ORDER_STATUS_LABELS[r.status],
      orderDate: dateBR(r.orderDate),
      totalValue: money(r.totalValue),
      amountPaid: money(r.amountPaid),
      openValue: money(r.openValue),
      paymentMethod: PAYMENT_METHOD_LABELS[r.paymentMethod],
    }));
  }

  function handlePrint() {
    const html = `
      <h1 style="font-family:Georgia,serif;text-align:center;">Relatório — Diamond Sect</h1>
      <p style="text-align:center;color:#666;font-size:12px;">${rows.length} item(ns) · ${distinctOrderIds.size} pedido(s)</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>${columns.map((c) => `<th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">${c.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${exportRows()
            .map(
              (r) =>
                `<tr>${columns.map((c) => `<td style="padding:4px;border-bottom:1px solid #eee;">${(r as any)[c.key]}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    openPrintWindow(html, "Relatório Diamond Sect");
  }

  function handleExportPdf() {
    exportTablePdf("Relatório — Diamond Sect", columns, exportRows(), `relatorio-${Date.now()}.pdf`, [
      `${rows.length} item(ns) · ${distinctOrderIds.size} pedido(s) · Total: ${money(totalValueSum)}`,
    ]);
  }

  function handleExportExcel() {
    exportTableExcel(`relatorio-${Date.now()}.xlsx`, "Relatório", columns, exportRows());
  }

  function clearFilters() {
    setRangeStart("");
    setRangeEnd("");
    setProductId("");
    setSellerName("");
    setClientId("");
    setType("");
    setStatus("");
    setPaymentMethod("");
    setEventDate("");
    setFittingDate("");
    setPickupDate("");
    setReturnDate("");
    setProductStatus("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Central de relatórios</h1>
        <p className="text-sm text-mist-500">Combine quantos filtros quiser — os resultados atualizam na hora.</p>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label>Data inicial (pedido)</label>
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        </div>
        <div>
          <label>Data final (pedido)</label>
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
        </div>
        <div>
          <label>Produto</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Vendedor</label>
          <select value={sellerName} onChange={(e) => setSellerName(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {sellers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Cliente</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="">Venda ou locação</option>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
          </select>
        </div>
        <div>
          <label>Status do pedido</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">Todos</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Forma de pagamento</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
            <option value="">Todas</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Data do evento</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div>
          <label>Data da prova</label>
          <input type="date" value={fittingDate} onChange={(e) => setFittingDate(e.target.value)} />
        </div>
        <div>
          <label>Data da retirada</label>
          <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
        </div>
        <div>
          <label>Data da devolução</label>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </div>
        <div>
          <label>Disponibilidade do produto</label>
          <select value={productStatus} onChange={(e) => setProductStatus(e.target.value)}>
            <option value="">Qualquer status</option>
            {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-ghost text-xs" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-3">
          <p className="text-xs text-mist-500">Pedidos encontrados</p>
          <p className="text-xl font-display">{distinctOrderIds.size}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Total vendido</p>
          <p className="text-xl font-display text-champagne">{money(totalSold)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Total locado</p>
          <p className="text-xl font-display text-diamond">{money(totalRented)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Valor total</p>
          <p className="text-xl font-display">{money(totalValueSum)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Valor recebido</p>
          <p className="text-xl font-display text-success">{money(totalReceived)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Valor em aberto</p>
          <p className="text-xl font-display text-warn">{money(totalOpen)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Produtos envolvidos</p>
          <p className="text-xl font-display">{totalProductsQty}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mist-500">Mais alugado / Top vendedor</p>
          <p className="text-sm font-display">
            {topProduct ? `${topProduct[0]} (${topProduct[1]}x)` : "—"}
            <br />
            {topSeller ? `${topSeller[0]} (${topSeller[1]})` : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={handlePrint}>
          Imprimir relatório
        </button>
        <button className="btn-secondary" onClick={handleExportPdf}>
          Exportar PDF
        </button>
        <button className="btn-secondary" onClick={handleExportExcel}>
          Exportar Excel
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Vendedor</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Data pedido</th>
              <th>Total</th>
              <th>Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td className="text-diamond">{r.orderNumber}</td>
                <td>{r.clientName}</td>
                <td>
                  {r.productName} <span className="text-mist-500 text-xs">({r.productCode})</span>
                </td>
                <td>{r.quantity}</td>
                <td>{r.sellerName}</td>
                <td className="capitalize">{r.type}</td>
                <td>{ORDER_STATUS_LABELS[r.status]}</td>
                <td>{dateBR(r.orderDate)}</td>
                <td>{money(r.totalValue)}</td>
                <td className={r.openValue > 0 ? "text-warn" : "text-success"}>{money(r.openValue)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-mist-500 py-8">
                  Nenhum resultado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
