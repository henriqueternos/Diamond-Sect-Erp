import React, { useEffect, useMemo, useState } from "react";
import { CashFlowService } from "../../services/CashFlowService";
import { PaymentService } from "../../services/PaymentService";
import { CashRegister, Payment } from "../../types";
import { Modal } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CashFlow() {
  const { user, can } = useAuth();
  const [dateId, setDateId] = useState(CashFlowService.todayId());
  const [reg, setReg] = useState<CashRegister | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [entryModal, setEntryModal] = useState<"entrada" | "saida" | "sangria" | null>(null);

  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalanceInput, setClosingBalanceInput] = useState(0);
  const [entryAmount, setEntryAmount] = useState(0);
  const [entryDescription, setEntryDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => CashFlowService.subscribeDay(dateId, setReg), [dateId]);
  useEffect(() => PaymentService.subscribeAll(setPayments), []);

  const systemInflow = useMemo(() => payments.filter((p) => p.date === dateId).reduce((s, p) => s + p.amount, 0), [
    payments,
    dateId,
  ]);

  const summary = reg ? CashFlowService.computeBalance(reg, systemInflow) : null;

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
    setError(null);
    try {
      await CashFlowService.close(dateId, closingBalanceInput, { id: user!.id, name: user!.name });
      setCloseModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryModal) return;
    setError(null);
    try {
      await CashFlowService.addEntry(
        dateId,
        { type: entryModal, amount: entryAmount, description: entryDescription, userName: user!.name },
        { id: user!.id, name: user!.name }
      );
      setEntryModal(null);
      setEntryAmount(0);
      setEntryDescription("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Controle de caixa</h1>
          <p className="text-sm text-mist-500">Abertura, movimentações e fechamento do dia.</p>
        </div>
        <input type="date" value={dateId} onChange={(e) => setDateId(e.target.value)} />
      </div>

      {!reg && can("cashFlow", "create") && (
        <div className="card p-6 text-center space-y-3">
          <p className="text-mist-500">O caixa deste dia ainda não foi aberto.</p>
          <button className="btn-primary" onClick={() => setOpenModal(true)}>
            Abrir caixa
          </button>
        </div>
      )}

      {reg && summary && (
        <>
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
              <p className="text-lg font-display text-diamond">
                {money(reg.status === "fechado" ? reg.closingBalance || 0 : summary.balance)}
              </p>
            </div>
          </div>

          <p className="text-xs text-mist-500">
            Status: <span className={reg.status === "aberto" ? "text-success" : "text-mist-300"}>{reg.status}</span> · aberto por{" "}
            {reg.openedByName || "—"}
            {reg.status === "fechado" && ` · fechado por ${reg.closedByName}`}
          </p>

          {reg.status === "aberto" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setEntryModal("entrada")}>
                + Entrada manual
              </button>
              <button className="btn-secondary" onClick={() => setEntryModal("saida")}>
                + Saída
              </button>
              <button className="btn-secondary" onClick={() => setEntryModal("sangria")}>
                + Sangria
              </button>
              <button
                className="btn-primary ml-auto"
                onClick={() => {
                  setClosingBalanceInput(summary.balance);
                  setCloseModal(true);
                }}
              >
                Fechar caixa
              </button>
            </div>
          )}

          <div className="card overflow-x-auto">
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
        </>
      )}

      {/* Abrir caixa */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caixa">
        <form onSubmit={handleOpen} className="space-y-4">
          <div>
            <label>Saldo inicial (R$)</label>
            <input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} />
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
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Fechar caixa">
        <form onSubmit={handleClose} className="space-y-4">
          <p className="text-sm text-mist-500">Saldo calculado pelo sistema, confira antes de confirmar:</p>
          <div>
            <label>Saldo final (R$)</label>
            <input
              type="number"
              step="0.01"
              value={closingBalanceInput}
              onChange={(e) => setClosingBalanceInput(Number(e.target.value))}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCloseModal(false)}>
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
        open={Boolean(entryModal)}
        onClose={() => setEntryModal(null)}
        title={entryModal === "entrada" ? "Nova entrada" : entryModal === "saida" ? "Nova saída" : "Registrar sangria"}
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <label>Descrição</label>
            <input required value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} />
          </div>
          <div>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" required value={entryAmount} onChange={(e) => setEntryAmount(Number(e.target.value))} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEntryModal(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
