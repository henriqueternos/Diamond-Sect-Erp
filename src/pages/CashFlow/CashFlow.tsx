import React, { useEffect, useMemo, useState } from "react";
import { CashFlowService } from "../../services/CashFlowService";
import { PaymentService } from "../../services/PaymentService";
import { OrderService } from "../../services/OrderService";
import { CashRegister, Order, Payment } from "../../types";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CashFlow() {
  const { user, can, isAdmin } = useAuth();
  const [dateId, setDateId] = useState(CashFlowService.todayId());
  const [regs, setRegs] = useState<CashRegister[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [closeTarget, setCloseTarget] = useState<CashRegister | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashRegister | null>(null);
  const [entryTarget, setEntryTarget] = useState<{ reg: CashRegister; type: "entrada" | "saida" | "sangria" } | null>(null);

  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalanceInput, setClosingBalanceInput] = useState(0);
  const [entryAmount, setEntryAmount] = useState(0);
  const [entryDescription, setEntryDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => CashFlowService.subscribeForDate(dateId, setRegs), [dateId]);
  useEffect(() => PaymentService.subscribeAll(setPayments), []);
  useEffect(() => OrderService.subscribeAll(setOrders), []);

  // Pagamento de pedido cancelado não deve entrar no saldo do caixa — como
  // se o pedido nunca tivesse existido para fins de valor.
  const cancelledOrderIds = useMemo(() => new Set(orders.filter((o) => o.status === "cancelado").map((o) => o.id)), [orders]);
  const dayTotalSystemInflow = useMemo(
    () => payments.filter((p) => p.date === dateId && !cancelledOrderIds.has(p.orderId)).reduce((s, p) => s + p.amount, 0),
    [payments, dateId, cancelledOrderIds]
  );

  const openReg = regs.find((r) => r.status === "aberto") || null;
  // O caixa aberto (se tiver) absorve o que sobrou do dia depois de tirar o
  // que os caixas já fechados naquele mesmo dia já contabilizaram — assim,
  // ter mais de uma sessão no mesmo dia não conta o mesmo pagamento 2 vezes.
  const alreadyClosedPortion = regs
    .filter((r) => r.status === "fechado")
    .reduce((s, r) => s + (r.closingSystemInflow || 0), 0);
  const openRegSystemInflow = Math.max(dayTotalSystemInflow - alreadyClosedPortion, 0);

  function summaryFor(reg: CashRegister) {
    const inflow = reg.status === "aberto" ? openRegSystemInflow : reg.closingSystemInflow || 0;
    return CashFlowService.computeBalance(reg, inflow);
  }

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await CashFlowService.open(dateId, openingBalance, { id: user!.id, name: user!.name });
      setOpenModal(false);
      setOpeningBalance(0);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!closeTarget) return;
    setError(null);
    try {
      const inflow = summaryFor(closeTarget).systemInflow;
      await CashFlowService.close(closeTarget.id, closingBalanceInput, inflow, { id: user!.id, name: user!.name });
      setCloseTarget(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryTarget) return;
    setError(null);
    try {
      await CashFlowService.addEntry(
        entryTarget.reg.id,
        entryTarget.reg,
        { type: entryTarget.type, amount: entryAmount, description: entryDescription, userName: user!.name },
        { id: user!.id, name: user!.name }
      );
      setEntryTarget(null);
      setEntryAmount(0);
      setEntryDescription("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await CashFlowService.remove(deleteTarget.id, deleteTarget, { id: user!.id, name: user!.name });
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Controle de caixa</h1>
          <p className="text-sm text-mist-500">Abertura, movimentações e fechamento do dia. Dá para abrir mais de um caixa no mesmo dia.</p>
        </div>
        <input type="date" value={dateId} onChange={(e) => setDateId(e.target.value)} />
      </div>

      {can("cashFlow", "create") && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-mist-500">
            {openReg ? "Já há um caixa aberto neste dia — feche-o antes de abrir outro." : "Nenhum caixa aberto neste dia agora."}
          </p>
          <button className="btn-primary" onClick={() => setOpenModal(true)} disabled={Boolean(openReg)}>
            + Abrir novo caixa
          </button>
        </div>
      )}

      {regs.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-mist-500">Nenhum caixa foi aberto neste dia ainda.</p>
        </div>
      )}

      <div className="space-y-4">
        {regs.map((reg) => {
          const summary = summaryFor(reg);
          return (
            <div key={reg.id} className="card p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-mist-500">
                  Status: <span className={reg.status === "aberto" ? "text-success" : "text-mist-300"}>{reg.status}</span> · aberto por{" "}
                  {reg.openedByName || "—"}
                  {reg.status === "fechado" && ` · fechado por ${reg.closedByName}`}
                </p>
                {isAdmin && (
                  <button className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => setDeleteTarget(reg)}>
                    Excluir este caixa
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-mist-500">Saldo inicial</p>
                  <p className="text-lg font-display">{money(reg.openingBalance)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-mist-500">Entradas (pedidos + manual)</p>
                  <p className="text-lg font-display text-success">{money(summary.systemInflow + summary.manualIn)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-mist-500">Saídas / sangrias</p>
                  <p className="text-lg font-display text-danger">{money(summary.out)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-mist-500">Saldo {reg.status === "aberto" ? "atual" : "final"}</p>
                  <p className="text-lg font-display text-diamond">{money(reg.status === "fechado" ? reg.closingBalance || 0 : summary.balance)}</p>
                </div>
              </div>

              {reg.status === "aberto" && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => setEntryTarget({ reg, type: "entrada" })}>
                    + Entrada manual
                  </button>
                  <button className="btn-secondary" onClick={() => setEntryTarget({ reg, type: "saida" })}>
                    + Saída
                  </button>
                  <button className="btn-secondary" onClick={() => setEntryTarget({ reg, type: "sangria" })}>
                    + Sangria
                  </button>
                  <button
                    className="btn-primary ml-auto"
                    onClick={() => {
                      setClosingBalanceInput(summary.balance);
                      setCloseTarget(reg);
                    }}
                  >
                    Fechar caixa
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reg.entries
                      .slice()
                      .reverse()
                      .map((e) => (
                        <tr key={e.id}>
                          <td>{new Date(e.createdAt).toLocaleTimeString("pt-BR")}</td>
                          <td className="capitalize">{e.type}</td>
                          <td>{e.description}</td>
                          <td className={e.type === "entrada" ? "text-success" : "text-danger"}>{money(e.amount)}</td>
                          <td>{e.userName}</td>
                        </tr>
                      ))}
                    {reg.entries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-mist-500 py-6">
                          Nenhuma movimentação manual ainda. Os pagamentos de pedidos já entram automaticamente no saldo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Abrir caixa */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caixa">
        <form onSubmit={handleOpen} className="space-y-4">
          <div>
            <label>Saldo inicial (R$)</label>
            <input type="number" step="0.01" value={openingBalance || ""} onChange={(e) => setOpeningBalance(Number(e.target.value))} placeholder="0" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpenModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Abrir
            </button>
          </div>
        </form>
      </Modal>

      {/* Fechar caixa */}
      <Modal open={Boolean(closeTarget)} onClose={() => setCloseTarget(null)} title="Fechar caixa">
        <form onSubmit={handleClose} className="space-y-4">
          <p className="text-sm text-mist-500">Saldo calculado pelo sistema, confira antes de confirmar:</p>
          <div>
            <label>Saldo final (R$)</label>
            <input type="number" step="0.01" value={closingBalanceInput} onChange={(e) => setClosingBalanceInput(Number(e.target.value))} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCloseTarget(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Confirmar fechamento
            </button>
          </div>
        </form>
      </Modal>

      {/* Lançamento manual */}
      <Modal
        open={Boolean(entryTarget)}
        onClose={() => setEntryTarget(null)}
        title={entryTarget?.type === "entrada" ? "Nova entrada" : entryTarget?.type === "saida" ? "Nova saída" : "Registrar sangria"}
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <label>Descrição</label>
            <input required value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} />
          </div>
          <div>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" required value={entryAmount || ""} onChange={(e) => setEntryAmount(Number(e.target.value))} placeholder="0" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEntryTarget(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir caixa"
        message={`Excluir o caixa de ${deleteTarget?.date} (status "${deleteTarget?.status}") por completo? Essa ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
