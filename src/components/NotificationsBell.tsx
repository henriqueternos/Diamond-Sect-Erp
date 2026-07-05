import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrderService } from "../services/OrderService";
import { LogService } from "../services/LogService";
import { LogEntry, Order } from "../types";

function isToday(v?: string) {
  if (!v) return false;
  return new Date(v).toDateString() === new Date().toDateString();
}
function isTomorrow(v?: string) {
  if (!v) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return new Date(v).toDateString() === t.toDateString();
}
function isOverdue(v?: string) {
  if (!v) return false;
  const d = new Date(v);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d.getTime() < now.getTime();
}

interface Alert {
  id: string;
  text: string;
  tone: "diamond" | "warn" | "danger" | "champagne";
  orderNumber?: string;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => OrderService.subscribeAll(setOrders), []);
  useEffect(() => LogService.subscribeRecent(setLogs, 50), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];
    const active = orders.filter((o) => o.status !== "cancelado");

    active.forEach((o) => {
      if (isToday(o.fittingDate)) list.push({ id: `f-${o.id}`, text: `Prova hoje — ${o.clientName}`, tone: "diamond", orderNumber: o.orderNumber });
      if (isToday(o.pickupDate)) list.push({ id: `p-${o.id}`, text: `Retirada hoje — ${o.clientName}`, tone: "champagne", orderNumber: o.orderNumber });
      if (isToday(o.returnDate)) list.push({ id: `d-${o.id}`, text: `Devolução hoje — ${o.clientName}`, tone: "warn", orderNumber: o.orderNumber });
      if (isTomorrow(o.returnDate)) list.push({ id: `dt-${o.id}`, text: `Produto de ${o.clientName} volta amanhã`, tone: "diamond", orderNumber: o.orderNumber });
      if (isOverdue(o.pickupDate) && o.status !== "retirado" && o.status !== "devolvido" && o.status !== "finalizado")
        list.push({ id: `po-${o.id}`, text: `Retirada atrasada — ${o.clientName}`, tone: "danger", orderNumber: o.orderNumber });
      if (isOverdue(o.returnDate) && o.status !== "devolvido" && o.status !== "finalizado")
        list.push({ id: `ro-${o.id}`, text: `Devolução atrasada — ${o.clientName}`, tone: "danger", orderNumber: o.orderNumber });
      if (o.openValue > 0)
        list.push({
          id: `op-${o.id}`,
          text: `Pagamento pendente — ${o.clientName} (${o.openValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`,
          tone: "warn",
          orderNumber: o.orderNumber,
        });
    });

    logs
      .filter((l) => l.action === "conflito_liberado")
      .slice(0, 5)
      .forEach((l) => list.push({ id: `log-${l.id}`, text: `Conflito liberado por ${l.userName}: ${l.details || ""}`, tone: "danger" }));

    return list;
  }, [orders, logs]);

  const toneClass: Record<Alert["tone"], string> = {
    diamond: "text-diamond",
    warn: "text-warn",
    danger: "text-danger",
    champagne: "text-champagne",
  };

  return (
    <div ref={boxRef} className="relative">
      <button className="relative btn-ghost !px-2.5 !py-2" onClick={() => setOpen((o) => !o)} title="Notificações">
        🔔
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 card w-80 max-h-96 overflow-y-auto p-2 z-40 shadow-xl">
          <p className="text-[10px] uppercase tracking-wide text-mist-700 px-2 mb-1">Notificações</p>
          {alerts.length === 0 && <p className="text-sm text-mist-500 px-2 py-3">Tudo em dia — nenhum alerta no momento.</p>}
          {alerts.map((a) => (
            <button
              key={a.id}
              className="w-full text-left px-2 py-2 rounded-lg hover:bg-ink-700 text-xs border-b border-ink-700/60 last:border-0"
              onClick={() => {
                setOpen(false);
                if (a.orderNumber) navigate(`/pedidos?buscar=${a.orderNumber}`);
              }}
            >
              <span className={toneClass[a.tone]}>{a.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
