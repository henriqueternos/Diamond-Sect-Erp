import React from "react";
import { useNavigate } from "react-router-dom";
import { Order, OrderStatus, CHANGEABLE_ORDER_STATUSES } from "../types";
import { dateBR, isOverdue, isToday, isWithinDays } from "../utils/dates";

interface Props {
  title: string;
  dateField: "fittingDate" | "pickupDate" | "returnDate";
  orders: Order[];
  daysAhead?: number;
  canEdit: boolean;
  onStatusChange: (order: Order, status: OrderStatus) => void;
}

const GROUP_STYLE = {
  atrasadas: { label: "Atrasadas", text: "text-danger", badge: "bg-danger/15 text-danger" },
  hoje: { label: "Hoje", text: "text-diamond", badge: "bg-diamond/15 text-diamond" },
  proximas: { label: "", text: "text-mist-300", badge: "bg-mist-500/15 text-mist-300" },
} as const;

export function DashboardStagePanel({ title, dateField, orders, daysAhead = 10, canEdit, onStatusChange }: Props) {
  const navigate = useNavigate();

  const atrasadas = orders.filter((o) => isOverdue(o[dateField] as string | undefined));
  const hoje = orders.filter((o) => isToday(o[dateField] as string | undefined));
  const proximas = orders.filter((o) => isWithinDays(o[dateField] as string | undefined, daysAhead));

  const groups: { key: keyof typeof GROUP_STYLE; label: string; list: Order[] }[] = [
    { key: "atrasadas", label: "Atrasadas", list: atrasadas },
    { key: "hoje", label: "Hoje", list: hoje },
    { key: "proximas", label: `Próximos ${daysAhead} dias`, list: proximas },
  ];

  return (
    <div className="card p-5">
      <h2 className="font-display text-xl text-mist-100 mb-3">{title}</h2>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="text-xs uppercase tracking-wide text-mist-500 mb-1.5 flex items-center gap-2">
              <span className={GROUP_STYLE[g.key].text}>{g.label}</span>
              <span className={`badge ${GROUP_STYLE[g.key].badge}`}>{g.list.length}</span>
            </p>
            {g.list.length === 0 ? (
              <p className="text-xs text-mist-700 pb-1">Nenhum pedido.</p>
            ) : (
              <ul className="space-y-1.5">
                {g.list.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 border border-ink-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <button
                        className="text-diamond text-xs font-medium hover:underline"
                        onClick={() => navigate(`/pedidos?buscar=${o.orderNumber}`)}
                      >
                        {o.orderNumber}
                      </button>
                      <p className="truncate text-mist-100">{o.clientName}</p>
                      <p className="text-[11px] text-mist-500">{dateBR(o[dateField] as string | undefined)}</p>
                    </div>
                    <select
                      value={o.status}
                      disabled={!canEdit}
                      onChange={(e) => onStatusChange(o, e.target.value as OrderStatus)}
                      className="!py-1 !text-xs !w-auto shrink-0"
                    >
                      {CHANGEABLE_ORDER_STATUSES.map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
