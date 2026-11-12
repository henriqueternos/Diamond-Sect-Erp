import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Client, Order, ORDER_STATUS_LABELS, Payment, PAYMENT_METHOD_LABELS } from "../../types";
import { dateBR, todayYMD, toYMD } from "../../utils/dates";
import { orderNetTotal } from "../../utils/orderTotals";
import { DrillDown, DrillDownModal, DrillRow } from "../../components/DrillDownModal";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function toDate(v: string) {
  return new Date(v + "T00:00:00");
}
function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); // semana começa na segunda (igual ao Painel)
  c.setHours(0, 0, 0, 0);
  return c;
}

function ClickCard({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="card p-4 cursor-pointer hover:border-diamond/40"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

const CHART_COLORS = ["#0E7C91", "#A9812E", "#1E9A5A", "#C3821A", "#D1435B"];

export default function Financial() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const navigate = useNavigate();

  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toYMD(d);
  });
  const [rangeEnd, setRangeEnd] = useState(() => todayYMD());

  useEffect(
    () =>
      OrderService.subscribeAll((list) => {
        setOrders(list);
        setOrdersLoaded(true);
      }),
    []
  );
  useEffect(() => PaymentService.subscribeAll(setPayments), []);
  useEffect(() => ClientService.subscribeAll(setClients), []);

  const activeOrders = orders.filter((o) => o.status !== "cancelado");

  // Pagamentos de um pedido cancelado não devem contar em nenhum lugar do
  // Financeiro — como se o pedido nunca tivesse existido para fins de valor.
  const cancelledOrderIds = useMemo(
    () => new Set(orders.filter((o) => o.status === "cancelado").map((o) => o.id)),
    [orders]
  );
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  // Pagamento sem pedido (pedido apagado direto do banco) também não conta:
  // sem pedido não há como saber a que cliente/serviço ele pertence, e os
  // Relatórios (que partem dos pedidos) nunca o enxergam. Ele aparece no
  // aviso de divergência abaixo, para poder ser conferido.
  const orphanPayments = useMemo(
    () => (ordersLoaded ? payments.filter((p) => !orderById.has(p.orderId)) : []),
    [payments, orderById, ordersLoaded]
  );
  const livePayments = useMemo(
    () => payments.filter((p) => !cancelledOrderIds.has(p.orderId) && (!ordersLoaded || orderById.has(p.orderId))),
    [payments, cancelledOrderIds, orderById, ordersLoaded]
  );
  const paidByOrder = useMemo(() => {
    const m = new Map<string, number>();
    livePayments.forEach((p) => m.set(p.orderId, (m.get(p.orderId) || 0) + p.amount));
    return m;
  }, [livePayments]);
  const mismatchOrders = activeOrders.filter(
    (o) => Math.abs((o.amountPaid || 0) - (paidByOrder.get(o.id) || 0)) > 0.009
  );
  const totalPaidOnOrders = activeOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);

  /** ---- Receita por período fixo (baseada nos pagamentos recebidos) ---- */
  const now = new Date();
  const todayStr = toYMD(now);
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

  const avgTicket = filteredOrders.length ? filteredOrders.reduce((s, o) => s + orderNetTotal(o), 0) / filteredOrders.length : 0;
  const rentalCount = filteredOrders.filter((o) => o.type === "locacao").length;
  const saleCount = filteredOrders.filter((o) => o.type === "venda").length;
  const receivedInRange = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const openInRange = filteredOrders.reduce((s, o) => s + o.openValue, 0);

  const newClientsList = clients.filter((c) => {
    if (!c.createdAt) return false;
    const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
    return d >= toDate(rangeStart) && d <= toDate(rangeEnd);
  });
  const newClients = newClientsList.length;

  const ordersByClient = new Map<string, number>();
  filteredOrders.forEach((o) => ordersByClient.set(o.clientId, (ordersByClient.get(o.clientId) || 0) + 1));
  const recurringClients = [...ordersByClient.values()].filter((c) => c > 1).length;

  const productAgg = new Map<string, { id: string; name: string; rented: number; sold: number }>();
  filteredOrders.forEach((o) => {
    o.items.forEach((i) => {
      const entry = productAgg.get(i.productId) || { id: i.productId, name: i.productName, rented: 0, sold: 0 };
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
      .map(([date, value]) => ({ date: date.slice(5).split("-").reverse().join("/"), ymd: date, value }));
  }, [filteredPayments]);

  const paymentMethodData = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((p) => map.set(p.method, (map.get(p.method) || 0) + p.amount));
    return [...map.entries()].map(([method, value]) => ({
      name: PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method,
      method,
      value,
    }));
  }, [filteredPayments]);

  /** ---- Detalhes: de onde veio cada valor (com atalho para a página original) ---- */
  function clientShortcut(name: string, cpf?: string) {
    return { label: "Abrir cliente", onClick: () => navigate(`/clientes?buscar=${encodeURIComponent(cpf || name)}`) };
  }

  function orderRow(o: Order, value: number, extra?: string): DrillRow {
    return {
      label: `${o.orderNumber} — ${o.clientName}`,
      sub: [ORDER_STATUS_LABELS[o.status], `pedido em ${dateBR(o.orderDate)}`, extra].filter(Boolean).join(" · "),
      value: money(value),
      onOpen: () => navigate(`/pedidos?buscar=${encodeURIComponent(o.orderNumber)}`),
      openLabel: "Abrir pedido",
      onOpenSecondary: clientShortcut(o.clientName, o.clientCpf),
    };
  }

  function paymentRow(p: Payment): DrillRow {
    const o = orderById.get(p.orderId);
    const paidSum = paidByOrder.get(p.orderId) || 0;
    let warning: string | undefined;
    if (!o) warning = "O pedido deste pagamento não foi encontrado.";
    else if (Math.abs((o.amountPaid || 0) - paidSum) > 0.009)
      warning = `O pedido registra ${money(o.amountPaid)} pago, mas os pagamentos dele somam ${money(paidSum)}.`;
    const methodLabel = PAYMENT_METHOD_LABELS[p.method] || p.method;
    return {
      label: `${p.orderNumber} — ${p.clientName}`,
      sub: [`pago em ${dateBR(p.date)}`, methodLabel, p.registeredByName ? `lançado por ${p.registeredByName}` : ""]
        .filter(Boolean)
        .join(" · "),
      warning,
      value: money(p.amount),
      onOpen: o ? () => navigate(`/pedidos?buscar=${encodeURIComponent(o.orderNumber)}`) : undefined,
      openLabel: "Abrir pedido",
      onOpenSecondary: clientShortcut(p.clientName, o?.clientCpf),
    };
  }

  function openPaymentsDrill(title: string, list: Payment[], note?: string) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
    const total = sorted.reduce((s, p) => s + p.amount, 0);
    setDrillDown({
      title,
      subtitle: `${sorted.length} pagamento(s) · total ${money(total)}${note ? ` · ${note}` : ""}`,
      rows: sorted.length
        ? sorted.map(paymentRow)
        : [{ label: "Nenhum pagamento contribui para este valor.", value: "" }],
    });
  }

  function openOrdersDrill(
    title: string,
    list: Order[],
    valueFn: (o: Order) => number,
    extraFn?: (o: Order) => string,
    note?: string
  ) {
    const total = list.reduce((s, o) => s + valueFn(o), 0);
    setDrillDown({
      title,
      subtitle: `${list.length} pedido(s) · soma ${money(total)}${note ? ` · ${note}` : ""}`,
      rows: list.length
        ? list.map((o) => orderRow(o, valueFn(o), extraFn?.(o)))
        : [{ label: "Nenhum pedido contribui para este valor.", value: "" }],
    });
  }

  const paidExtra = (o: Order) => `total ${money(orderNetTotal(o))} · pago ${money(o.amountPaid)}`;
  const typeExtra = (o: Order) => (o.type === "locacao" ? "Locação" : "Venda");

  function openClientsDrill() {
    const rows: DrillRow[] = [
      ...newClientsList.map((c) => ({
        label: c.fullName,
        sub: `Novo no período · ${ordersByClient.get(c.id) || 0} pedido(s) no período`,
        value: "",
        onOpen: () => navigate(`/clientes?buscar=${encodeURIComponent(c.cpf || c.fullName)}`),
        openLabel: "Abrir cliente",
      })),
      ...[...ordersByClient.entries()]
        .filter(([, n]) => n > 1)
        .map(([id, n]) => {
          const c = clients.find((x) => x.id === id);
          const name = c?.fullName || filteredOrders.find((o) => o.clientId === id)?.clientName || "Cliente";
          return {
            label: name,
            sub: `Recorrente · ${n} pedidos no período`,
            value: "",
            onOpen: () => navigate(`/clientes?buscar=${encodeURIComponent(c?.cpf || name)}`),
            openLabel: "Abrir cliente",
            onOpenSecondary: { label: "Ver pedidos", onClick: () => navigate(`/pedidos?buscar=${encodeURIComponent(name)}`) },
          } as DrillRow;
        }),
    ];
    setDrillDown({
      title: "Clientes novos / recorrentes",
      subtitle: `${newClients} novo(s) · ${recurringClients} recorrente(s) no período`,
      rows: rows.length ? rows : [{ label: "Nenhum cliente novo ou recorrente no período.", value: "" }],
    });
  }

  function openProductDrill(title: string, prod: { id: string; name: string } | undefined, kind: "locacao" | "venda") {
    if (!prod) return;
    const rows: DrillRow[] = [];
    filteredOrders
      .filter((o) => o.type === kind)
      .forEach((o) => {
        const qty = o.items.filter((i) => i.productId === prod.id).reduce((sum, i) => sum + i.quantity, 0);
        if (qty <= 0) return;
        rows.push({
          ...orderRow(o, orderNetTotal(o), `${qty}x ${prod.name}`),
          onOpenSecondary: {
            label: "Abrir no estoque",
            onClick: () => navigate(`/estoque?buscar=${encodeURIComponent(prod.name)}`),
          },
        });
      });
    setDrillDown({ title, subtitle: `${rows.length} pedido(s) com este produto no período`, rows });
  }

  const hasDivergence = mismatchOrders.length > 0 || orphanPayments.length > 0;
  function openDivergenceDrill() {
    const rows: DrillRow[] = [
      ...orphanPayments.map((p) => ({
        ...paymentRow(p),
        warning: "Pagamento sem pedido — não está sendo somado nos totais do Financeiro.",
      })),
      ...mismatchOrders.map((o) => {
        const sum = paidByOrder.get(o.id) || 0;
        return {
          ...orderRow(o, o.amountPaid || 0, `pagamentos lançados somam ${money(sum)}`),
          warning: `O pedido registra ${money(o.amountPaid)} pago, mas os pagamentos somam ${money(sum)} (diferença de ${money(
            Math.abs((o.amountPaid || 0) - sum)
          )}).`,
        } as DrillRow;
      }),
    ];
    setDrillDown({
      title: "Divergência entre pagamentos e pedidos",
      subtitle: `Pagamentos considerados: ${money(totalReceived)} · valor pago nos pedidos ativos: ${money(totalPaidOnOrders)}`,
      rows,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Financeiro</h1>
        <p className="text-sm text-mist-500">Dados reais de pedidos e pagamentos, em tempo real.</p>
        <p className="text-[11px] text-mist-500 mt-1">
          Clique em qualquer valor para ver de onde ele veio, com atalho direto para o pedido ou cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Receita hoje", value: revenueToday, list: livePayments.filter((p) => p.date === todayStr) },
          { label: "Receita da semana", value: revenueWeek, list: livePayments.filter((p) => toDate(p.date) >= weekStart) },
          { label: "Receita do mês", value: revenueMonth, list: livePayments.filter((p) => toDate(p.date) >= monthStart) },
          { label: "Receita do ano", value: revenueYear, list: livePayments.filter((p) => toDate(p.date) >= yearStart) },
        ].map((c) => (
          <ClickCard key={c.label} onClick={() => openPaymentsDrill(c.label, c.list)}>
            <p className="text-xs text-mist-500">{c.label}</p>
            <p className="text-xl font-display text-diamond">{money(c.value)}</p>
          </ClickCard>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ClickCard onClick={() => openPaymentsDrill("Valor recebido (total)", livePayments)}>
          <p className="text-xs text-mist-500">Valor recebido (total)</p>
          <p className="text-2xl font-display text-success">{money(totalReceived)}</p>
        </ClickCard>
        <ClickCard
          onClick={() =>
            openOrdersDrill(
              "Contas a receber (total em aberto)",
              activeOrders.filter((o) => o.openValue > 0),
              (o) => o.openValue,
              paidExtra
            )
          }
        >
          <p className="text-xs text-mist-500">Contas a receber (total em aberto)</p>
          <p className="text-2xl font-display text-warn">{money(totalOpen)}</p>
        </ClickCard>
      </div>

      {hasDivergence && (
        <div
          role="button"
          tabIndex={0}
          className="card p-3 cursor-pointer border-warn"
          onClick={openDivergenceDrill}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDivergenceDrill();
            }
          }}
        >
          <p className="text-sm text-warn font-display">⚠ Divergência entre pagamentos e pedidos</p>
          <p className="text-xs text-mist-500">
            Os pagamentos registrados somam {money(totalReceived)}, mas os pedidos ativos somam {money(totalPaidOnOrders)} de
            valor pago. Clique para ver exatamente onde está a diferença.
          </p>
        </div>
      )}

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
        <ClickCard
          onClick={() =>
            openOrdersDrill(
              "Ticket médio",
              filteredOrders,
              (o) => orderNetTotal(o),
              typeExtra,
              `média ${money(avgTicket)} (soma dos totais com desconto ÷ nº de pedidos)`
            )
          }
        >
          <p className="text-xs text-mist-500">Ticket médio</p>
          <p className="text-xl font-display">{money(avgTicket)}</p>
        </ClickCard>
        <ClickCard onClick={() => openOrdersDrill("Locações / Vendas", filteredOrders, (o) => orderNetTotal(o), typeExtra)}>
          <p className="text-xs text-mist-500">Locações / Vendas</p>
          <p className="text-xl font-display">
            {rentalCount} / {saleCount}
          </p>
        </ClickCard>
        <ClickCard onClick={() => openPaymentsDrill("Recebido no período", filteredPayments, "por data do pagamento")}>
          <p className="text-xs text-mist-500">Recebido no período</p>
          <p className="text-xl font-display text-success">{money(receivedInRange)}</p>
        </ClickCard>
        <ClickCard
          onClick={() =>
            openOrdersDrill(
              "Em aberto no período",
              filteredOrders.filter((o) => o.openValue > 0),
              (o) => o.openValue,
              paidExtra,
              "por data do pedido"
            )
          }
        >
          <p className="text-xs text-mist-500">Em aberto no período</p>
          <p className="text-xl font-display text-warn">{money(openInRange)}</p>
        </ClickCard>
        <ClickCard onClick={() => openOrdersDrill("Pedidos pagos", paidOrders, (o) => orderNetTotal(o), paidExtra)}>
          <p className="text-xs text-mist-500">Pedidos pagos</p>
          <p className="text-xl font-display text-success">{paidOrders.length}</p>
        </ClickCard>
        <ClickCard onClick={() => openOrdersDrill("Parcialmente pagos", partialOrders, (o) => o.openValue, paidExtra, "valor = ainda em aberto")}>
          <p className="text-xs text-mist-500">Parcialmente pagos</p>
          <p className="text-xl font-display text-warn">{partialOrders.length}</p>
        </ClickCard>
        <ClickCard onClick={() => openOrdersDrill("Em aberto (sem nenhum pagamento)", openOrders, (o) => o.openValue, paidExtra, "valor = ainda em aberto")}>
          <p className="text-xs text-mist-500">Em aberto</p>
          <p className="text-xl font-display text-danger">{openOrders.length}</p>
        </ClickCard>
        <ClickCard onClick={openClientsDrill}>
          <p className="text-xs text-mist-500">Clientes novos / recorrentes</p>
          <p className="text-xl font-display">
            {newClients} / {recurringClients}
          </p>
        </ClickCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ClickCard onClick={() => openProductDrill("Produto mais alugado no período", topRented, "locacao")}>
          <p className="text-xs text-mist-500">Produto mais alugado no período</p>
          <p className="text-lg font-display text-diamond">
            {topRented ? `${topRented.name} (${topRented.rented}x)` : "—"}
          </p>
        </ClickCard>
        <ClickCard onClick={() => openProductDrill("Produto mais vendido no período", topSold, "venda")}>
          <p className="text-xs text-mist-500">Produto mais vendido no período</p>
          <p className="text-lg font-display text-champagne">{topSold ? `${topSold.name} (${topSold.sold}x)` : "—"}</p>
        </ClickCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-display text-lg mb-1">Receita recebida por dia</p>
          <p className="text-[11px] text-mist-500 mb-2">Clique em uma barra para ver os pagamentos do dia.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
              <XAxis dataKey="date" stroke="#9AA0AD" fontSize={11} />
              <YAxis stroke="#9AA0AD" fontSize={11} />
              <Tooltip
                formatter={(v: number) => money(v)}
                contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E4EA", borderRadius: 8 }}
              />
              <Bar
                dataKey="value"
                fill="#0E7C91"
                radius={[4, 4, 0, 0]}
                style={{ cursor: "pointer" }}
                onClick={(entry: any) => {
                  const ymd = entry?.payload?.ymd ?? entry?.ymd;
                  if (ymd) openPaymentsDrill(`Recebido em ${dateBR(ymd)}`, filteredPayments.filter((p) => p.date === ymd));
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <p className="text-sm font-display text-lg mb-1">Recebido por forma de pagamento</p>
          <p className="text-[11px] text-mist-500 mb-2">Clique em uma fatia para ver os pagamentos dessa forma.</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                style={{ cursor: "pointer" }}
                onClick={(entry: any) => {
                  const method = entry?.method ?? entry?.payload?.method;
                  if (method)
                    openPaymentsDrill(
                      `Recebido em ${PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method}`,
                      filteredPayments.filter((p) => p.method === method),
                      "no período selecionado"
                    );
                }}
              >
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

      <DrillDownModal drillDown={drillDown} onClose={() => setDrillDown(null)} />
    </div>
  );
}
