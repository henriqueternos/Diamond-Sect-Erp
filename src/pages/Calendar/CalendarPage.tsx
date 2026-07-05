import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrderService } from "../../services/OrderService";
import { CalendarService } from "../../services/CalendarService";
import { ClientService } from "../../services/ClientService";
import { AgendaItem, CalendarEvent, Client, Order } from "../../types";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TYPE_STYLE: Record<AgendaItem["type"], { label: string; dot: string; text: string }> = {
  evento: { label: "Evento", dot: "bg-mist-500", text: "text-mist-300" },
  prova: { label: "Prova", dot: "bg-diamond", text: "text-diamond" },
  retirada: { label: "Retirada", dot: "bg-champagne", text: "text-champagne" },
  devolucao: { label: "Devolução", dot: "bg-warn", text: "text-warn" },
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);

  useEffect(() => OrderService.subscribeAll(setOrders), []);
  useEffect(() => CalendarService.subscribeAll(setEvents), []);
  useEffect(() => ClientService.subscribeAll(setClients), []);

  const activeOrders = orders.filter((o) => o.status !== "cancelado");

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    function push(date: string | undefined, item: AgendaItem) {
      if (!date) return;
      const list = map.get(date) || [];
      list.push(item);
      map.set(date, list);
    }
    activeOrders.forEach((o) => {
      push(o.fittingDate, {
        type: "prova",
        date: o.fittingDate!,
        time: o.fittingTime,
        title: `Prova — ${o.clientName}`,
        subtitle: o.orderNumber,
        orderId: o.id,
        orderNumber: o.orderNumber,
      });
      push(o.pickupDate, {
        type: "retirada",
        date: o.pickupDate!,
        title: `Retirada — ${o.clientName}`,
        subtitle: o.orderNumber,
        orderId: o.id,
        orderNumber: o.orderNumber,
      });
      push(o.returnDate, {
        type: "devolucao",
        date: o.returnDate!,
        title: `Devolução — ${o.clientName}`,
        subtitle: o.orderNumber,
        orderId: o.id,
        orderNumber: o.orderNumber,
      });
    });
    events.forEach((e) => {
      push(e.date, {
        type: "evento",
        date: e.date,
        time: e.time,
        title: e.title,
        subtitle: e.clientName ? [e.clientName, e.description].filter(Boolean).join(" — ") : e.description,
        eventId: e.id,
        clientId: e.clientId,
      });
    });
    return map;
  }, [activeOrders, events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = ymd(new Date());

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDay) return;
    const client = clients.find((c) => c.id === newClientId);
    await CalendarService.create({
      title: newTitle,
      date: selectedDay,
      time: newTime,
      description: newDescription,
      ...(client ? { clientId: client.id, clientName: client.fullName } : {}),
      createdBy: user!.id,
      createdByName: user!.name,
    });
    setNewEventOpen(false);
    setNewTitle("");
    setNewTime("");
    setNewDescription("");
    setNewClientId("");
  }

  async function handleDeleteEvent() {
    if (!toDelete) return;
    await CalendarService.remove(toDelete.id);
    setToDelete(null);
  }

  const selectedItems = selectedDay
    ? (itemsByDay.get(selectedDay) || []).sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Agenda</h1>
          <p className="text-sm text-mist-500">Provas, retiradas e devoluções puxadas direto dos pedidos.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="btn-secondary !px-3" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ‹
          </button>
          <p className="font-display text-base sm:text-lg w-32 sm:w-40 text-center capitalize">
            {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <button className="btn-secondary !px-3" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-4 text-[11px] sm:text-xs">
        {Object.entries(TYPE_STYLE).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} /> {s.label}
          </span>
        ))}
      </div>

      <div className="card p-2 sm:p-3 overflow-hidden">
        <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs text-mist-500 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 truncate px-0.5">
              <span className="sm:hidden">{w.slice(0, 1)}</span>
              <span className="hidden sm:inline">{w}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="min-h-[56px] sm:min-h-[92px] rounded-lg bg-ink-900/40" />;
            const dayStr = ymd(date);
            const items = itemsByDay.get(dayStr) || [];
            const isToday = dayStr === todayStr;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(dayStr)}
                className={`min-h-[56px] sm:min-h-[92px] text-left rounded-lg p-1 sm:p-2 border transition-colors overflow-hidden ${
                  isToday ? "border-diamond/60 bg-diamond/5" : "border-ink-600 bg-ink-700/40 hover:bg-ink-700"
                }`}
              >
                <p className={`text-[10px] sm:text-xs mb-1 ${isToday ? "text-diamond font-semibold" : "text-mist-500"}`}>
                  {date.getDate()}
                </p>
                <div className="space-y-0.5">
                  {items.slice(0, 2).map((it, i) => (
                    <div key={i} className={`text-[8px] sm:text-[10px] truncate flex items-center gap-1 ${TYPE_STYLE[it.type].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 hidden sm:inline-block ${TYPE_STYLE[it.type].dot}`} />
                      {it.title}
                    </div>
                  ))}
                  {items.length > 2 && <p className="text-[8px] sm:text-[10px] text-mist-700">+{items.length - 2}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe do dia */}
      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? new Date(selectedDay + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
            : ""
        }
      >
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="btn-secondary text-xs" onClick={() => setNewEventOpen(true)}>
              + Novo evento
            </button>
          </div>
          {selectedItems.length === 0 && <p className="text-mist-500 text-sm">Nenhum item neste dia.</p>}
          {selectedItems.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between border border-ink-600 rounded-lg px-3 py-2">
              <div>
                <p className={`text-sm font-medium ${TYPE_STYLE[it.type].text}`}>
                  {it.time && <span className="text-mist-500 mr-2">{it.time}</span>}
                  {it.title}
                </p>
                {it.subtitle && <p className="text-xs text-mist-500">{it.subtitle}</p>}
              </div>
              <div className="flex gap-2">
                {it.orderNumber && (
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => navigate(`/pedidos?buscar=${it.orderNumber}`)}>
                    Abrir pedido
                  </button>
                )}
                {it.clientId && !it.orderNumber && (
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      const c = clients.find((cl) => cl.id === it.clientId);
                      if (c) navigate(`/clientes?buscar=${encodeURIComponent(c.fullName)}`);
                    }}
                  >
                    Abrir cliente
                  </button>
                )}
                {it.eventId && (
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs text-danger"
                    onClick={() => setToDelete(events.find((e) => e.id === it.eventId) || null)}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Novo evento personalizado */}
      <Modal open={newEventOpen} onClose={() => setNewEventOpen(false)} title="Novo evento na agenda">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label>Título *</label>
            <input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div>
            <label>Cliente (opcional)</label>
            <select value={newClientId} onChange={(e) => setNewClientId(e.target.value)}>
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.cpf}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Horário</label>
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </div>
          <div>
            <label>Descrição</label>
            <textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setNewEventOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar evento
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir evento"
        message={`Excluir o evento "${toDelete?.title}"?`}
        onConfirm={handleDeleteEvent}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
