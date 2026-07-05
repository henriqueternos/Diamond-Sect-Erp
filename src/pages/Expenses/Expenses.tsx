import React, { useEffect, useMemo, useState } from "react";
import { ExpenseService } from "../../services/ExpenseService";
import { PaymentService } from "../../services/PaymentService";
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS, Payment } from "../../types";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const EMPTY: Omit<Expense, "id" | "createdAt"> = {
  category: "outras",
  description: "",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
};

export default function Expenses() {
  const { can } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => ExpenseService.subscribeAll(setExpenses), []);
  useEffect(() => PaymentService.subscribeAll(setPayments), []);

  const filtered = useMemo(() => expenses.filter((e) => e.date.startsWith(monthFilter)), [expenses, monthFilter]);
  const totalMonth = filtered.reduce((s, e) => s + e.amount, 0);
  const revenueMonth = useMemo(
    () => payments.filter((p) => p.date.startsWith(monthFilter)).reduce((s, p) => s + p.amount, 0),
    [payments, monthFilter]
  );
  const realProfit = revenueMonth - totalMonth;

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    filtered.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    const { id, createdAt, ...rest } = e;
    setForm(rest);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editing) await ExpenseService.update(editing.id, form);
    else await ExpenseService.create(form);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!toDelete) return;
    await ExpenseService.remove(toDelete.id);
    setToDelete(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Despesas</h1>
          <p className="text-sm text-mist-500">Usadas para o cálculo do lucro real no financeiro.</p>
        </div>
        {can("expenses", "create") && (
          <button className="btn-primary" onClick={openCreate}>
            + Nova despesa
          </button>
        )}
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label>Mês</label>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </div>
        <div className="card px-4 py-2">
          <p className="text-xs text-mist-500">Total do mês</p>
          <p className="text-xl font-display text-danger">{money(totalMonth)}</p>
        </div>
        <div className="card px-4 py-2">
          <p className="text-xs text-mist-500">Lucro real do mês (recebido − despesas)</p>
          <p className={`text-xl font-display ${realProfit >= 0 ? "text-success" : "text-danger"}`}>{money(realProfit)}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {byCategory.map(([cat, val]) => (
            <div key={cat} className="card px-4 py-2">
              <p className="text-xs text-mist-500">{EXPENSE_CATEGORY_LABELS[cat]}</p>
              <p className="text-sm font-semibold">{money(val)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.date.split("-").reverse().join("/")}</td>
                <td>{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                <td>{e.description || "—"}</td>
                <td className="text-danger">{money(e.amount)}</td>
                <td className="flex gap-2 justify-end">
                  {can("expenses", "edit") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(e)}>
                      Editar
                    </button>
                  )}
                  {can("expenses", "delete") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => setToDelete(e)}>
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-mist-500 py-8">
                  Nenhuma despesa neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar despesa" : "Nova despesa"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label>Categoria</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Data</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar despesa
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir despesa"
        message="Tem certeza que deseja excluir esta despesa?"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
