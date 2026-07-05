import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClientService } from "../../services/ClientService";
import { ProductService } from "../../services/ProductService";
import { OrderService } from "../../services/OrderService";
import { Client, Order, OrderStatus, Product } from "../../types";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { DashboardStagePanel } from "../../components/DashboardStagePanel";
import { useAuth } from "../../hooks/useAuth";
import { isToday } from "../../utils/dates";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const u1 = ClientService.subscribeAll(setClients);
    const u2 = ProductService.subscribeAll(setProducts);
    const u3 = OrderService.subscribeAll(setOrders);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const activeOrders = orders.filter((o) => o.status !== "cancelado" && o.status !== "finalizado");

  // Cada painel só deve mostrar pedidos para os quais aquela etapa ainda não
  // aconteceu — senão uma prova já feita continuaria aparecendo como atrasada.
  const provaPendente = activeOrders.filter((o) => !["pronto_retirada", "retirado", "devolvido"].includes(o.status));
  const retiradaPendente = activeOrders.filter((o) => !["retirado", "devolvido"].includes(o.status));
  const devolucaoPendente = activeOrders.filter((o) => o.status === "retirado");

  // Pedido cancelado não deve contar em nenhum total financeiro — como se
  // ele nunca tivesse existido para fins de valores.
  const moneyOrders = orders.filter((o) => o.status !== "cancelado");
  const openBalance = moneyOrders.reduce((sum, o) => sum + (o.openValue || 0), 0);
  const receivedTotal = moneyOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

  const recentOrders = orders.slice(0, 6);

  async function handleStatusChange(order: Order, status: OrderStatus) {
    try {
      await OrderService.update(order.id, { status }, { id: user!.id, name: user!.name });
    } catch (err: any) {
      alert(err.message || "Não foi possível alterar o status deste pedido.");
    }
  }

  const canEditOrders = can("orders", "edit");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Painel geral</h1>
        <p className="text-sm text-mist-500">Dados em tempo real do Firestore.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-mist-500 mb-1">Valor recebido</p>
          <p className="text-2xl font-display text-success">
            {receivedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-mist-500 mb-1">Valor em aberto</p>
          <p className="text-2xl font-display text-warn">
            {openBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-mist-500 mb-1">Base cadastrada</p>
          <p className="text-2xl font-display text-mist-100">
            {clients.length} clientes · {products.length} produtos
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-mist-500 mb-3">
          Marque o andamento de cada pedido diretamente aqui — o estoque (reservado, em prova, alugado, disponível)
          se ajusta sozinho quando o status muda.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <DashboardStagePanel
            title="Provas"
            dateField="fittingDate"
            orders={provaPendente}
            daysAhead={10}
            canEdit={canEditOrders}
            onStatusChange={handleStatusChange}
          />
          <DashboardStagePanel
            title="Retiradas"
            dateField="pickupDate"
            orders={retiradaPendente}
            daysAhead={10}
            canEdit={canEditOrders}
            onStatusChange={handleStatusChange}
          />
          <DashboardStagePanel
            title="Devoluções"
            dateField="returnDate"
            orders={devolucaoPendente}
            daysAhead={10}
            canEdit={canEditOrders}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-mist-100">Agenda de hoje</h2>
          <button className="btn-ghost text-xs" onClick={() => navigate("/agenda")}>
            Ver calendário completo →
          </button>
        </div>
        {(() => {
          const todayItems = activeOrders.flatMap((o) => {
            const items: { label: string; time?: string; orderNumber: string }[] = [];
            if (isToday(o.fittingDate)) items.push({ label: `Prova — ${o.clientName}`, time: o.fittingTime, orderNumber: o.orderNumber });
            if (isToday(o.pickupDate)) items.push({ label: `Retirada — ${o.clientName}`, orderNumber: o.orderNumber });
            if (isToday(o.returnDate)) items.push({ label: `Devolução — ${o.clientName}`, orderNumber: o.orderNumber });
            return items;
          });
          if (todayItems.length === 0) {
            return <p className="text-sm text-mist-500">Nenhum compromisso para hoje.</p>;
          }
          return (
            <ul className="space-y-2">
              {todayItems.map((it, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-sm border border-ink-600 rounded-lg px-3 py-2 cursor-pointer hover:bg-ink-700"
                  onClick={() => navigate(`/pedidos?buscar=${it.orderNumber}`)}
                >
                  <span>
                    {it.time && <span className="text-mist-500 mr-2">{it.time}</span>}
                    {it.label}
                  </span>
                  <span className="text-diamond text-xs">{it.orderNumber}</span>
                </li>
              ))}
            </ul>
          );
        })()}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-mist-100">Pedidos recentes</h2>
          <button className="btn-ghost text-xs" onClick={() => navigate("/pedidos")}>
            Ver todos →
          </button>
        </div>
        <table className="table-shell">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Valor total</th>
              <th>Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id} className="cursor-pointer" onClick={() => navigate("/pedidos")}>
                <td className="text-diamond">{o.orderNumber}</td>
                <td>{o.clientName}</td>
                <td className="capitalize">{o.type}</td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td>{o.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td>{o.openValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-mist-500 py-6">
                  Nenhum pedido cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
