import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OrderService } from "../../services/OrderService";
import { PaymentService } from "../../services/PaymentService";
import { ClientService } from "../../services/ClientService";
import { Client, Order, Payment, PAYMENT_METHOD_LABELS } from "../../types";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function toDate(v: string) {
  return new Date(v + "T00:00:00");
}
function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  c.setHours(0, 0, 0, 0);
  return c;
}

const CHART_COLORS = ["#0E7C91", "#A9812E", "#1E9A5A", "#C3821A", "#D1435B"];

export default function Financial() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => OrderService.subscribeAll(setOrders), []);
  useEffect(() => PaymentService.subscribeAll(setPayments), []);
  useEffect(() => ClientService.subscribeAll(setClients), []);

  const activeOrders = orders.filter((o) => o.status !== "cancelado");

  // Pagamentos de um pedido cancelado não devem contar em nenhum lugar do
  // Financeiro — como se o pedido nunca tivesse existido para fins de valor.
  const cancelledOrderIds = useMemo(
    () => new Set(orders.filter((o) => o.status === "cancelado").map((o) => o.id)),
    [orders]
  );
  const livePayments = useMemo(() => payments.filter((p) => !cancelledOrderIds.has(p.orderId)), [payments, cancelledOrderIds]);

  /** ---- Receita por período fixo (baseada nos pagamentos recebidos) ---- */
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const revenueToday = livePayments.filter((p) => p.date === todayStr).reduce((s, p) => s + p.amount, 0);
  const revenueWeek = livePayments.filter((p) => toDate(p.date) >= weekStart).reduce((s, p) => s + p.amount, 0);
  const revenueMonth = livePayments.filter((p) => toDate(p.date) >= monthStart).reduce((s, p) => s + p.amount, 0);
  const revenueYear = livePayments.filter((p) => toDate(p.date) >= yearStart).reduce((s, p) => s + p.amount, 0);

  const totalReceived = livePayments.reduce((s, p) => s + p.amount, 0);
  const totalOpen = activeOrders.reduce((s, o) => s + o.openValue, 0);

  /** ---- Métricas do período filtrado (por data do pedido) ---- */
  const filteredOrders = useMemo(
    () =>
      activeOrders.filter((o) => o.orderDate >= rangeStart && o.orderDate <= rangeEnd),
    [activeOrders, rangeStart, rangeEnd]
  );
  const filteredPayments = useMemo(
    () => livePayments.filter((p) => p.date >= rangeStart && p.date <= rangeEnd),
    [livePayments, rangeStart, rangeEnd]
  );

  const paidOrders = filteredOrders.filter((o) => o.openValue <= 0 && o.totalValue > 0);
  const partialOrders = filteredOrders.filter((o) => o.amountPaid > 0 && o.openValue > 0);
  const openOrders = filteredOrders.filter((o) => o.amountPaid <= 0 && o.openValue > 0);

  const avgTicket = filteredOrders.length ? filteredOrders.reduce((s, o) => s + o.totalValue, 0) / filteredOrders.length : 0;
  const rentalCount = filteredOrders.filter((o) => o.type === "locacao").length;
  const saleCount = filteredOrders.filter((o) => o.type === "venda").length;
  const receivedInRange = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const openInRange = filteredOrders.reduce((s, o) => s + o.openValue, 0);

  const newClients = clients.filter((c) => {
    if (!c.createdAt) return false;
    const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
    return d >= toDate(rangeStart) && d <= toDate(rangeEnd);
  }).length;

  const ordersByClient = new Map<string, number>();
  filteredOrders.forEach((o) => ordersByClient.set(o.clientId, (ordersByClient.get(o.clientId) || 0) + 1));
  const recurringClients = [...ordersByClient.values()].filter((c) => c > 1).length;

  const productAgg = new Map<string, { name: string; rented: number; sold: number }>();
  filteredOrders.forEach((o) => {
    o.items.forEach((i) => {
      const entry = productAgg.get(i.productId) || { name: i.productName, rented: 0, sold: 0 };
      if (o.type === "locacao") entry.rented += i.quantity;
      else entry.sold += i.quantity;
      productAgg.set(i.productId, entry);
    });
  });
  const topRented = [...productAgg.values()].sort((a, b) => b.rented - a.rented).filter((p) => p.rented > 0)[0];
  const topSold = [...productAgg.values()].sort((a, b) => b.sold - a.sold).filter((p) => p.sold > 0)[0];

  /** ---- Dados dos gráficos ---- */
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((p) => map.set(p.date, (map.get(p.date) || 0) + p.amount));
    return [...map.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, value]) => ({ date: date.slice(5).split("-").reverse().join("/"), value }));
  }, [filteredPayments]);

  const paymentMethodData = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((p) => map.set(p.method, (map.get(p.method) || 0) + p.amount));
    return [...map.entries()].map(([method, value]) => ({
      name: PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method,
      value,
    }));
  }, [filteredPayments]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Financeiro</h1>
        <p className="text-sm text-mist-500">Dados reais de pedidos e pagamentos, em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita hoje", value: revenueToday },
          { label: "Receita da semana", value: revenueWeek },
          { label: "Receita do mês", value: revenueMonth },
          { label: "Receita do ano", value: revenueYear },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-mist-500">{c.label}</p>
            <p className="text-xl font-display text-diamond">{money(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-mist-500">Valor recebido (total)</p>
          <p className="text-2xl font-display text-success">{money(totalReceived)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Contas a receber (total em aberto)</p>
          <p className="text-2xl font-display text-warn">{money(totalOpen)}</p>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label>De</label>
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        </div>
        <div>
          <label>Até</label>
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
        </div>
        <p className="text-xs text-mist-500 pb-2">{filteredOrders.length} pedido(s) no período selecionado</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-mist-500">Ticket médio</p>
          <p className="text-xl font-display">{money(avgTicket)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Locações / Vendas</p>
          <p className="text-xl font-display">
            {rentalCount} / {saleCount}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Recebido no período</p>
          <p className="text-xl font-display text-success">{money(receivedInRange)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Em aberto no período</p>
          <p className="text-xl font-display text-warn">{money(openInRange)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Pedidos pagos</p>
          <p className="text-xl font-display text-success">{paidOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Parcialmente pagos</p>
          <p className="text-xl font-display text-warn">{partialOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Em aberto</p>
          <p className="text-xl font-display text-danger">{openOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Clientes novos / recorrentes</p>
          <p className="text-xl font-display">
            {newClients} / {recurringClients}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-mist-500">Produto mais alugado no período</p>
          <p className="text-lg font-display text-diamond">
            {topRented ? `${topRented.name} (${topRented.rented}x)` : "—"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-mist-500">Produto mais vendido no período</p>
          <p className="text-lg font-display text-champagne">{topSold ? `${topSold.name} (${topSold.sold}x)` : "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-display text-lg mb-3">Receita recebida por dia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
              <XAxis dataKey="date" stroke="#9AA0AD" fontSize={11} />
              <YAxis stroke="#9AA0AD" fontSize={11} />
              <Tooltip
                formatter={(v: number) => money(v)}
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E4EA", borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#0E7C91" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <p className="text-sm font-display text-lg mb-3">Recebido por forma de pagamento</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={paymentMethodData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {paymentMethodData.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => money(v)}
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E4EA", borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {paymentMethodData.length === 0 && <p className="text-center text-mist-500 text-sm">Sem pagamentos no período.</p>}
        </div>
      </div>
    </div>
  );
}
