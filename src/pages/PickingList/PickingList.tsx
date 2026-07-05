import React, { useEffect, useMemo, useState } from "react";
import { OrderService } from "../../services/OrderService";
import { ProductService } from "../../services/ProductService";
import { openPrintWindow } from "../../services/DocumentService";
import { exportTablePdf, ExportColumn } from "../../services/ExportService";
import { Order, Product, PRODUCT_STATUS_LABELS } from "../../types";

function dateBR(v?: string) {
  if (!v) return "—";
  return v.split("-").reverse().join("/");
}

type DateKind = "evento" | "prova" | "retirada" | "devolucao";

interface Row {
  orderNumber: string;
  clientName: string;
  productName: string;
  productCode: string;
  color: string;
  brand: string;
  productType: string;
  status: string;
  quantity: number;
  dateKind: string;
  date: string;
}

export default function PickingList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [dateKinds, setDateKinds] = useState<Record<DateKind, boolean>>({
    evento: true,
    prova: true,
    retirada: true,
    devolucao: true,
  });
  const [productType, setProductType] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => OrderService.subscribeAll(setOrders), []);
  useEffect(() => ProductService.subscribeAll(setProducts), []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function inRange(date?: string) {
    if (!date) return false;
    if (rangeStart && date < rangeStart) return false;
    if (rangeEnd && date > rangeEnd) return false;
    return true;
  }

  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    const kinds: { key: DateKind; label: string; field: keyof Order }[] = [
      { key: "evento", label: "Evento", field: "eventDate" },
      { key: "prova", label: "Prova", field: "fittingDate" },
      { key: "retirada", label: "Retirada", field: "pickupDate" },
      { key: "devolucao", label: "Devolução", field: "returnDate" },
    ];

    orders
      .filter((o) => o.status !== "cancelado")
      .forEach((o) => {
        kinds.forEach(({ key, label, field }) => {
          if (!dateKinds[key]) return;
          const dateValue = o[field] as string | undefined;
          if (!dateValue) return;
          const hasRange = Boolean(rangeStart || rangeEnd);
          if (hasRange && !inRange(dateValue)) return;

          o.items.forEach((item) => {
            const product = productById.get(item.productId);
            if (productType && product?.productType !== productType) return;
            if (nameFilter && !item.productName.toLowerCase().includes(nameFilter.toLowerCase())) return;
            if (codeFilter && !item.internalCode.toLowerCase().includes(codeFilter.toLowerCase())) return;
            if (colorFilter && product?.color?.toLowerCase() !== colorFilter.toLowerCase()) return;
            if (brandFilter && product?.brand?.toLowerCase() !== brandFilter.toLowerCase()) return;
            if (statusFilter && product?.status !== statusFilter) return;

            result.push({
              orderNumber: o.orderNumber,
              clientName: o.clientName,
              productName: item.productName,
              productCode: item.internalCode,
              color: product?.color || "—",
              brand: product?.brand || "—",
              productType: product?.productType || "—",
              status: product ? PRODUCT_STATUS_LABELS[product.status] : "—",
              quantity: item.quantity,
              dateKind: label,
              date: dateValue || "",
            });
          });
        });
      });

    return result.sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [orders, productById, rangeStart, rangeEnd, dateKinds, productType, nameFilter, codeFilter, colorFilter, brandFilter, statusFilter]);

  const productTypes = useMemo(() => [...new Set(products.map((p) => p.productType).filter(Boolean))], [products]);
  const colors = useMemo(() => [...new Set(products.map((p) => p.color).filter(Boolean))], [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))], [products]);

  const columns: ExportColumn[] = [
    { key: "date", label: "Data", width: 0.9 },
    { key: "dateKind", label: "Tipo", width: 0.9 },
    { key: "orderNumber", label: "Pedido", width: 0.9 },
    { key: "clientName", label: "Cliente", width: 1.4 },
    { key: "productName", label: "Produto", width: 1.6 },
    { key: "productCode", label: "Código", width: 0.9 },
    { key: "color", label: "Cor", width: 0.8 },
    { key: "brand", label: "Marca", width: 0.9 },
    { key: "quantity", label: "Qtd.", width: 0.5 },
    { key: "status", label: "Status", width: 1 },
  ];

  function exportRows() {
    return rows.map((r) => ({ ...r, date: dateBR(r.date) }));
  }

  function handlePrint() {
    const html = `
      <h1 style="font-family:Georgia,serif;text-align:center;">Lista de separação — Diamond Sect</h1>
      <p style="text-align:center;color:#666;font-size:12px;">${rows.length} item(ns)</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>${columns.map((c) => `<th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">${c.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${exportRows()
            .map((r) => `<tr>${columns.map((c) => `<td style="padding:4px;border-bottom:1px solid #eee;">${(r as any)[c.key]}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>`;
    openPrintWindow(html, "Lista de separação");
  }

  function handleExportPdf() {
    exportTablePdf("Lista de separação — Diamond Sect", columns, exportRows(), `lista-separacao-${Date.now()}.pdf`, [
      `${rows.length} item(ns) no período selecionado`,
    ]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Lista de separação</h1>
        <p className="text-sm text-mist-500">O que precisa ser separado, por período e tipo de data.</p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label>Período — de</label>
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div>
            <label>Período — até</label>
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
          <div>
            <label>Tipo de produto</label>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">Todos</option>
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Status do produto</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Nome do produto</label>
            <input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
          </div>
          <div>
            <label>Código</label>
            <input value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} />
          </div>
          <div>
            <label>Cor</label>
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
              <option value="">Todas</option>
              {colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Marca</label>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="">Todas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label>Considerar como data</label>
          <div className="flex gap-4 flex-wrap">
            {(["evento", "prova", "retirada", "devolucao"] as DateKind[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-mist-100 normal-case">
                <input
                  type="checkbox"
                  className="!w-auto"
                  checked={dateKinds[k]}
                  onChange={(e) => setDateKinds({ ...dateKinds, [k]: e.target.checked })}
                />
                {k === "evento" ? "Evento" : k === "prova" ? "Prova" : k === "retirada" ? "Retirada" : "Devolução"}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={handlePrint}>
          Imprimir
        </button>
        <button className="btn-secondary" onClick={handleExportPdf}>
          Exportar PDF
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Cor</th>
              <th>Marca</th>
              <th>Qtd.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td>{dateBR(r.date)}</td>
                <td>{r.dateKind}</td>
                <td className="text-diamond">{r.orderNumber}</td>
                <td>{r.clientName}</td>
                <td>
                  {r.productName} <span className="text-mist-500 text-xs">({r.productCode})</span>
                </td>
                <td>{r.color}</td>
                <td>{r.brand}</td>
                <td>{r.quantity}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-mist-500 py-8">
                  Nenhum item para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
