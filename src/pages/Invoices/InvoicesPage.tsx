import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvoiceService } from "../../services/InvoiceService";
import { Invoice, InvoiceStatus, INVOICE_STATUS_LABELS } from "../../types";
import { Modal } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";
import { dateBR, todayYMD } from "../../utils/dates";

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  pendente: "bg-warn/15 text-warn",
  emitida: "bg-success/15 text-success",
  nao_aplicavel: "bg-ink-600 text-mist-500",
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");
  const [issueTarget, setIssueTarget] = useState<Invoice | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() => todayYMD());

  useEffect(() => InvoiceService.subscribeAll(setInvoices), []);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return invoices
      .filter((i) => statusFilter === "todos" || i.status === statusFilter)
      .filter((i) => !t || i.orderNumber.toLowerCase().includes(t) || i.clientName.toLowerCase().includes(t))
      .sort((a, b) => (a.orderNumber < b.orderNumber ? 1 : -1));
  }, [invoices, term, statusFilter]);

  const counts = {
    pendente: invoices.filter((i) => i.status === "pendente").length,
    emitida: invoices.filter((i) => i.status === "emitida").length,
    nao_aplicavel: invoices.filter((i) => i.status === "nao_aplicavel").length,
  };

  function openIssueModal(inv: Invoice) {
    setIssueTarget(inv);
    setInvoiceNumber(inv.invoiceNumber || "");
    setIssueDate(inv.issueDate || todayYMD());
  }

  async function handleMarkIssued(e: React.FormEvent) {
    e.preventDefault();
    if (!issueTarget) return;
    await InvoiceService.markIssued(issueTarget.orderId, invoiceNumber, issueDate, { id: user!.id, name: user!.name });
    setIssueTarget(null);
  }

  async function handleMarkPending(inv: Invoice) {
    await InvoiceService.markPending(inv.orderId, { id: user!.id, name: user!.name });
  }

  async function handleToggleWillIssue(inv: Invoice, willIssue: boolean) {
    await InvoiceService.setWillIssue(
      { id: inv.orderId, orderNumber: inv.orderNumber, clientName: inv.clientName, totalValue: inv.totalValue },
      willIssue,
      { id: user!.id, name: user!.name }
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Notas Fiscais</h1>
        <p className="text-sm text-mist-500">
          Controle de quais pedidos precisam de nota fiscal — a emissão em si continua no seu emissor fiscal de
          costume, aqui é só acompanhamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-3 cursor-pointer hover:border-diamond/40" onClick={() => setStatusFilter("pendente")}>
          <p className="text-xs text-mist-500">Pendentes</p>
          <p className="text-xl font-display text-warn">{counts.pendente}</p>
        </div>
        <div className="card p-3 cursor-pointer hover:border-diamond/40" onClick={() => setStatusFilter("emitida")}>
          <p className="text-xs text-mist-500">Emitidas</p>
          <p className="text-xl font-display text-success">{counts.emitida}</p>
        </div>
        <div className="card p-3 cursor-pointer hover:border-diamond/40" onClick={() => setStatusFilter("nao_aplicavel")}>
          <p className="text-xs text-mist-500">Não vão emitir</p>
          <p className="text-xl font-display text-mist-300">{counts.nao_aplicavel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <input className="max-w-sm" placeholder="Buscar por pedido ou cliente..." value={term} onChange={(e) => setTerm(e.target.value)} />
        <select className="max-w-[220px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "todos")}>
          <option value="todos">Todos os status</option>
          {(Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Nº da nota</th>
              <th>Data de emissão</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id}>
                <td className="text-diamond cursor-pointer" onClick={() => navigate(`/pedidos?buscar=${encodeURIComponent(inv.orderNumber)}`)}>
                  {inv.orderNumber}
                </td>
                <td>{inv.clientName}</td>
                <td>{money(inv.totalValue)}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span>
                </td>
                <td>{inv.invoiceNumber || "—"}</td>
                <td>{inv.issueDate ? dateBR(inv.issueDate) : "—"}</td>
                <td className="flex gap-2 flex-wrap">
                  {can("invoices", "edit") && (
                    <>
                      {inv.status === "pendente" && (
                        <>
                          <button className="btn-ghost !px-2 !py-1 text-xs text-success" onClick={() => openIssueModal(inv)}>
                            Marcar emitida
                          </button>
                          <button className="btn-ghost !px-2 !py-1 text-xs text-mist-500" onClick={() => handleToggleWillIssue(inv, false)}>
                            Não vai emitir
                          </button>
                        </>
                      )}
                      {inv.status === "emitida" && (
                        <button className="btn-ghost !px-2 !py-1 text-xs text-warn" onClick={() => handleMarkPending(inv)}>
                          Voltar p/ pendente
                        </button>
                      )}
                      {inv.status === "nao_aplicavel" && (
                        <button className="btn-ghost !px-2 !py-1 text-xs text-diamond" onClick={() => handleToggleWillIssue(inv, true)}>
                          Marcar para emitir
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-mist-500 py-8">
                  Nenhum pedido marcado para nota fiscal ainda — isso é configurado na tela de criação/edição de
                  cada pedido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(issueTarget)} onClose={() => setIssueTarget(null)} title={`Marcar nota fiscal emitida — ${issueTarget?.orderNumber ?? ""}`}>
        {issueTarget && (
          <form onSubmit={handleMarkIssued} className="space-y-4">
            <div>
              <label>Número da nota fiscal</label>
              <input required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Número da nota fiscal" />
            </div>
            <div>
              <label>Data de emissão</label>
              <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setIssueTarget(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
