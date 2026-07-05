import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OrderService } from "../../services/OrderService";
import { ClientService } from "../../services/ClientService";
import { SettingsService } from "../../services/SettingsService";
import { PaymentService } from "../../services/PaymentService";
import {
  buildContractHtml,
  buildContractMailto,
  buildInternalOrderHtml,
  buildWithdrawalHtml,
  downloadContractPdf,
  downloadWithdrawalPdf,
  openPrintWindow,
} from "../../services/DocumentService";
import { Order, OrderStatus, CHANGEABLE_ORDER_STATUSES, Payment, PaymentMethod, PAYMENT_METHOD_LABELS } from "../../types";
import { Modal } from "../../components/Modal";
import { OrderStatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { OrderForm } from "./OrderForm";
import { dateBR, formatDateTimeBR } from "../../utils/dates";
import type { ConflictInfo } from "../../services/OrderService";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}
function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrdersList() {
  const { can, user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("buscar") || "");
  const [formOpen, setFormOpen] = useState(false);
  const [summaryOrder, setSummaryOrder] = useState<Order | null>(null);
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);
  const [viewDoc, setViewDoc] = useState<{ title: string; html: string } | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [paymentCardBrand, setPaymentCardBrand] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [orderPayments, setOrderPayments] = useState<Payment[]>([]);
  const [deleteTargetPayment, setDeleteTargetPayment] = useState<Payment | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [datesOrder, setDatesOrder] = useState<Order | null>(null);
  const [editFittingDate, setEditFittingDate] = useState("");
  const [editFittingTime, setEditFittingTime] = useState("");
  const [editPickupDate, setEditPickupDate] = useState("");
  const [editReturnDate, setEditReturnDate] = useState("");
  const [datesConflicts, setDatesConflicts] = useState<ConflictInfo[]>([]);
  const [datesChecking, setDatesChecking] = useState(false);
  const [datesSaving, setDatesSaving] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelUsername, setCancelUsername] = useState("");
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelAuthError, setCancelAuthError] = useState<string | null>(null);
  const [cancelAuthLoading, setCancelAuthLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => OrderService.subscribeAll(setOrders), []);

  useEffect(() => {
    if (!paymentOrder) {
      setOrderPayments([]);
      return;
    }
    return PaymentService.subscribeForOrder(paymentOrder.id, setOrderPayments);
  }, [paymentOrder]);

  useEffect(() => {
    const q = searchParams.get("buscar");
    if (q) setTerm(q);
  }, [searchParams]);

  const filtered = useMemo(() => OrderService.search(orders, term), [orders, term]);
  const livePaymentOrder = useMemo(
    () => (paymentOrder ? orders.find((o) => o.id === paymentOrder.id) || paymentOrder : null),
    [orders, paymentOrder]
  );

  function openDatesModal(order: Order) {
    setDatesOrder(order);
    setEditFittingDate(order.fittingDate || "");
    setEditFittingTime(order.fittingTime || "");
    setEditPickupDate(order.pickupDate || "");
    setEditReturnDate(order.returnDate || "");
    setDatesConflicts([]);
    setDatesError(null);
    setMenuOrder(null);
  }

  async function handleCheckDateConflicts() {
    if (!datesOrder) return;
    setDatesChecking(true);
    try {
      const found = await OrderService.checkConflicts(
        datesOrder.items,
        { pickupDate: editPickupDate, returnDate: editReturnDate, fittingDate: editFittingDate },
        1,
        datesOrder.id
      );
      setDatesConflicts(found);
    } finally {
      setDatesChecking(false);
    }
  }

  async function handleSaveDates(e: React.FormEvent) {
    e.preventDefault();
    if (!datesOrder) return;
    setDatesSaving(true);
    setDatesError(null);
    try {
      await OrderService.update(
        datesOrder.id,
        {
          fittingDate: editFittingDate,
          fittingTime: editFittingTime,
          pickupDate: editPickupDate,
          returnDate: editReturnDate,
        },
        { id: user!.id, name: user!.name }
      );
      setDatesOrder(null);
    } catch (err: any) {
      setDatesError(err.message || "Erro ao salvar as datas.");
    } finally {
      setDatesSaving(false);
    }
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    try {
      await OrderService.update(order.id, { status }, { id: user!.id, name: user!.name });
    } catch (err: any) {
      alert(err.message || "Não foi possível alterar o status deste pedido.");
    }
  }

  function openCancelApproval(order: Order) {
    setCancelTarget(order);
    setCancelUsername("");
    setCancelPassword("");
    setCancelAuthError(null);
    setMenuOrder(null);
  }

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelAuthLoading(true);
    setCancelAuthError(null);
    try {
      await OrderService.cancelWithApproval(
        cancelTarget.id,
        { username: cancelUsername, password: cancelPassword },
        { id: user!.id, name: user!.name }
      );
      setCancelTarget(null);
    } catch (err: any) {
      setCancelAuthError(err.message || "Não foi possível cancelar o pedido.");
    } finally {
      setCancelAuthLoading(false);
    }
  }

  async function loadDocData() {
    const [company, contract, withdrawal] = await Promise.all([
      SettingsService.getCompany(),
      SettingsService.getContract(),
      SettingsService.getWithdrawal(),
    ]);
    const missingCompany = !company.tradeName && !company.legalName;
    return { company, contract, withdrawal, missingCompany };
  }

  async function withDoc(action: string, run: (data: Awaited<ReturnType<typeof loadDocData>>) => Promise<void> | void) {
    setDocError(null);
    setDocBusy(action);
    try {
      const data = await loadDocData();
      if (data.missingCompany) {
        setDocError(
          'Os dados da empresa ainda não foram configurados. Vá em "Configurações" e preencha ao menos o nome da empresa antes de gerar documentos.'
        );
        return;
      }
      await run(data);
    } catch (err: any) {
      setDocError(err.message || "Erro ao gerar documento.");
    } finally {
      setDocBusy(null);
    }
  }

  function handleViewContract(order: Order) {
    withDoc("view-contract", ({ company, contract }) => {
      setViewDoc({ title: `Contrato — ${order.orderNumber}`, html: buildContractHtml(order, company, contract) });
      setMenuOrder(null);
    });
  }
  function handlePrintContract(order: Order) {
    withDoc("print-contract", ({ company, contract }) => {
      openPrintWindow(buildContractHtml(order, company, contract), `Contrato ${order.orderNumber}`);
      setMenuOrder(null);
    });
  }
  function handleDownloadContract(order: Order) {
    withDoc("download-contract", ({ company, contract }) => {
      downloadContractPdf(order, company, contract);
      setMenuOrder(null);
    });
  }
  async function handleEmailContract(order: Order) {
    setDocError(null);
    setDocBusy("email-contract");
    try {
      const client = await ClientService.getById(order.clientId);
      if (!client?.email) {
        setDocError("Este cliente não tem e-mail cadastrado. Adicione um e-mail no cadastro do cliente para enviar.");
        return;
      }
      window.location.href = buildContractMailto(order, client.email);
      setMenuOrder(null);
    } finally {
      setDocBusy(null);
    }
  }

  function handleViewWithdrawal(order: Order) {
    withDoc("view-withdrawal", ({ company, withdrawal }) => {
      setViewDoc({ title: `Retirada — ${order.orderNumber}`, html: buildWithdrawalHtml(order, company, withdrawal) });
      setMenuOrder(null);
    });
  }
  function handlePrintWithdrawal(order: Order) {
    withDoc("print-withdrawal", ({ company, withdrawal }) => {
      openPrintWindow(buildWithdrawalHtml(order, company, withdrawal), `Retirada ${order.orderNumber}`);
      setMenuOrder(null);
    });
  }
  function handleDownloadWithdrawal(order: Order) {
    withDoc("download-withdrawal", ({ company, withdrawal }) => {
      downloadWithdrawalPdf(order, company, withdrawal);
      setMenuOrder(null);
    });
  }

  function handleViewInternal(order: Order) {
    setViewDoc({ title: `Pedido interno — ${order.orderNumber}`, html: buildInternalOrderHtml(order) });
    setMenuOrder(null);
  }
  function handlePrintInternal(order: Order) {
    openPrintWindow(buildInternalOrderHtml(order), `Pedido interno ${order.orderNumber}`);
    setMenuOrder(null);
  }

  function openPaymentModal(order: Order) {
    setPaymentOrder(order);
    setPaymentAmount(order.openValue || 0);
    setPaymentMethod("pix");
    setPaymentCardBrand("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentError(null);
    setMenuOrder(null);
  }

  function openDeletePayment(payment: Payment) {
    setDeleteTargetPayment(payment);
    setAdminUsername("");
    setAdminPassword("");
    setAdminAuthError(null);
  }

  async function handleConfirmDeletePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteTargetPayment || !paymentOrder) return;
    setAdminAuthLoading(true);
    setAdminAuthError(null);
    try {
      await PaymentService.removeWithAdminAuth(
        deleteTargetPayment.id,
        { id: paymentOrder.id },
        { username: adminUsername, password: adminPassword },
        { id: user!.id, name: user!.name }
      );
      setDeleteTargetPayment(null);
    } catch (err: any) {
      setAdminAuthError(err.message || "Não foi possível excluir o pagamento.");
    } finally {
      setAdminAuthLoading(false);
    }
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentOrder) return;
    setPaymentError(null);
    setPaymentSaving(true);
    try {
      await PaymentService.register(
        paymentOrder,
        { amount: paymentAmount, method: paymentMethod, cardBrand: paymentCardBrand || undefined, date: paymentDate },
        { id: user!.id, name: user!.name }
      );
      setPaymentOrder(null);
    } catch (err: any) {
      setPaymentError(err.message || "Erro ao registrar pagamento.");
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Pedidos</h1>
          <p className="text-sm text-mist-500">{orders.length} pedidos · mais recentes primeiro</p>
        </div>
        {can("orders", "create") && (
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            + Novo pedido
          </button>
        )}
      </div>

      <input
        className="max-w-xl"
        placeholder="Buscar por nº do pedido, cliente, CPF, telefone, produto, status..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setSearchParams(e.target.value ? { buscar: e.target.value } : {});
        }}
      />

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th></th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Retirada</th>
              <th>Devolução</th>
              <th>Total</th>
              <th>Em aberto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    title="Resumo rápido"
                    className="w-6 h-6 rounded-full bg-diamond/10 text-diamond text-xs"
                    onClick={() => setSummaryOrder(o)}
                  >
                    i
                  </button>
                </td>
                <td>
                  {can("orders", "edit") ? (
                    <button className="text-diamond font-medium hover:underline" onClick={() => setEditingOrder(o)}>
                      {o.orderNumber}
                    </button>
                  ) : (
                    <span className="text-diamond font-medium">{o.orderNumber}</span>
                  )}
                </td>
                <td>{o.clientName}</td>
                <td className="capitalize">{o.type}</td>
                <td>
                  <select
                    value={o.status}
                    onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                    className="!py-1 !text-xs"
                    disabled={!can("orders", "edit")}
                  >
                    {CHANGEABLE_ORDER_STATUSES.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{dateBR(o.pickupDate)}</td>
                <td>{dateBR(o.returnDate)}</td>
                <td>{money(o.totalValue)}</td>
                <td className={o.openValue > 0 ? "text-warn" : "text-success"}>{money(o.openValue)}</td>
                <td>
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setMenuOrder(o)}>
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-mist-500 py-8">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Novo pedido */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Novo pedido" wide>
        <OrderForm onCancel={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />
      </Modal>

      {/* Resumo rápido */}
      <Modal open={Boolean(summaryOrder)} onClose={() => setSummaryOrder(null)} title={`Pedido ${summaryOrder?.orderNumber ?? ""}`}>
        {summaryOrder && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-mist-500">Cliente:</span> {summaryOrder.clientName} ({summaryOrder.clientCpf})
            </p>
            <p>
              <span className="text-mist-500">Telefone:</span> {summaryOrder.clientPhone}
            </p>
            <div>
              <span className="text-mist-500">Produtos:</span>
              <ul className="list-disc list-inside">
                {summaryOrder.items.map((i) => (
                  <li key={i.productId}>
                    {i.productName} — qtd {i.quantity} — {money(i.unitValue)}
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="text-mist-500">Datas:</span> evento {dateBR(summaryOrder.eventDate)} · prova{" "}
              {dateBR(summaryOrder.fittingDate)} · retirada {dateBR(summaryOrder.pickupDate)} · devolução{" "}
              {dateBR(summaryOrder.returnDate)}
            </p>
            <p>
              <span className="text-mist-500">Total:</span> {money(summaryOrder.totalValue)} ·{" "}
              <span className="text-mist-500">Em aberto:</span> {money(summaryOrder.openValue)}
            </p>
            <p>
              <span className="text-mist-500">Status:</span> <OrderStatusBadge status={summaryOrder.status} />
            </p>
            <p className="text-xs text-mist-700 pt-1 border-t border-ink-700 mt-2">
              Pedido criado em {formatDateTimeBR(summaryOrder.createdAt)} — registro do sistema, não editável.
            </p>
          </div>
        )}
      </Modal>

      {/* Menu de ações */}
      <Modal open={Boolean(menuOrder)} onClose={() => setMenuOrder(null)} title={`Ações — ${menuOrder?.orderNumber ?? ""}`}>
        {menuOrder && (
          <div className="space-y-1">
            {menuOrder.clientPhone && (
              <a
                className="block px-3 py-2 rounded-lg hover:bg-ink-700 text-sm"
                href={`https://wa.me/55${onlyDigits(menuOrder.clientPhone)}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir WhatsApp do cliente
              </a>
            )}
            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 text-sm"
              onClick={() => {
                setMenuOrder(null);
                navigate(`/clientes?buscar=${encodeURIComponent(menuOrder.clientCpf)}`);
              }}
            >
              Abrir cadastro do cliente
            </button>
            {can("orders", "edit") && (
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 text-sm" onClick={() => openDatesModal(menuOrder)}>
                Editar datas (prova / retirada / devolução)
              </button>
            )}

            <div className="border-t border-ink-600 my-2" />
            <p className="px-3 text-[10px] uppercase tracking-wide text-mist-700">Financeiro</p>
            {can("financial", "edit") && <MenuAction label="Pagamentos" onClick={() => openPaymentModal(menuOrder)} />}
            {menuOrder.openValue <= 0 && <p className="px-3 text-xs text-success">Pedido já totalmente pago.</p>}

            <div className="border-t border-ink-600 my-2" />
            <p className="px-3 text-[10px] uppercase tracking-wide text-mist-700">Contrato</p>
            <MenuAction label="Visualizar contrato" busy={docBusy === "view-contract"} onClick={() => handleViewContract(menuOrder)} />
            <MenuAction label="Imprimir contrato" busy={docBusy === "print-contract"} onClick={() => handlePrintContract(menuOrder)} />
            <MenuAction
              label="Baixar contrato em PDF"
              busy={docBusy === "download-contract"}
              onClick={() => handleDownloadContract(menuOrder)}
            />
            <MenuAction
              label="Enviar contrato por e-mail"
              busy={docBusy === "email-contract"}
              onClick={() => handleEmailContract(menuOrder)}
            />

            <div className="border-t border-ink-600 my-2" />
            <p className="px-3 text-[10px] uppercase tracking-wide text-mist-700">Retirada</p>
            <MenuAction label="Visualizar retirada" busy={docBusy === "view-withdrawal"} onClick={() => handleViewWithdrawal(menuOrder)} />
            <MenuAction
              label="Imprimir retirada"
              busy={docBusy === "print-withdrawal"}
              onClick={() => handlePrintWithdrawal(menuOrder)}
            />
            <MenuAction
              label="Baixar retirada em PDF"
              busy={docBusy === "download-withdrawal"}
              onClick={() => handleDownloadWithdrawal(menuOrder)}
            />

            <div className="border-t border-ink-600 my-2" />
            <p className="px-3 text-[10px] uppercase tracking-wide text-mist-700">Pedido interno</p>
            <MenuAction label="Visualizar pedido interno" onClick={() => handleViewInternal(menuOrder)} />
            <MenuAction label="Imprimir pedido interno" onClick={() => handlePrintInternal(menuOrder)} />

            {docError && (
              <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mt-2">{docError}</div>
            )}

            {can("orders", "edit") && (
              <>
                <div className="border-t border-ink-600 my-2" />
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 text-sm"
                  onClick={() => {
                    setEditingOrder(menuOrder);
                    setMenuOrder(null);
                  }}
                >
                  Editar pedido completo (itens, datas, valores)
                </button>
              </>
            )}

            <div className="border-t border-ink-600 my-2" />
            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-danger/10 text-sm text-danger"
              onClick={() => openCancelApproval(menuOrder)}
            >
              Excluir pedido (cancelar)
            </button>
          </div>
        )}
      </Modal>

      {/* Visualização de documento (contrato / retirada / pedido interno) */}
      <Modal open={Boolean(viewDoc)} onClose={() => setViewDoc(null)} title={viewDoc?.title ?? ""} wide>
        {viewDoc && (
          <div className="bg-white text-black rounded-lg p-6 max-h-[70vh] overflow-y-auto">
            <div dangerouslySetInnerHTML={{ __html: viewDoc.html }} />
          </div>
        )}
      </Modal>

      {/* Registrar pagamento */}
      <Modal open={Boolean(paymentOrder)} onClose={() => setPaymentOrder(null)} title={`Pagamentos — ${livePaymentOrder?.orderNumber ?? ""}`} wide>
        {livePaymentOrder && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-mist-500 mb-2">
                Valor em aberto atual: <span className="text-warn font-semibold">{money(livePaymentOrder.openValue)}</span>
              </p>
              {orderPayments.length > 0 ? (
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Bandeira</th>
                      <th>Valor</th>
                      <th>Lançado por</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.date?.split("-").reverse().join("/")}</td>
                        <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                        <td>{p.cardBrand || "—"}</td>
                        <td className="text-success">{money(p.amount)}</td>
                        <td className="text-mist-500">{p.registeredByName}</td>
                        <td>
                          <button className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => openDeletePayment(p)}>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-mist-500">Nenhum pagamento lançado ainda para este pedido.</p>
              )}
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4 border-t border-ink-600 pt-4">
              <p className="font-display text-lg">Lançar novo pagamento</p>
              <div>
                <label>Valor pago agora (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label>Forma de pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Data</label>
                  <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>
              {(paymentMethod === "credito" || paymentMethod === "debito") && (
                <div>
                  <label>Bandeira do cartão</label>
                  <input value={paymentCardBrand} onChange={(e) => setPaymentCardBrand(e.target.value)} placeholder="Ex: Visa, Mastercard" />
                </div>
              )}
              {paymentError && <p className="text-sm text-danger">{paymentError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPaymentOrder(null)}>
                  Fechar
                </button>
                <button type="submit" className="btn-primary" disabled={paymentSaving}>
                  {paymentSaving ? "Salvando..." : "Lançar pagamento"}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Confirmação de exclusão de pagamento — exige senha de administrador ou gerente */}
      <Modal open={Boolean(deleteTargetPayment)} onClose={() => setDeleteTargetPayment(null)} title="Excluir pagamento — aprovação necessária">
        {deleteTargetPayment && (
          <form onSubmit={handleConfirmDeletePayment} className="space-y-4">
            <p className="text-sm text-mist-300">
              Excluir o pagamento de <b>{money(deleteTargetPayment.amount)}</b> ({PAYMENT_METHOD_LABELS[deleteTargetPayment.method]}) lançado em{" "}
              {deleteTargetPayment.date?.split("-").reverse().join("/")}. Essa ação atualiza o valor em aberto do pedido e fica registrada
              no log.
            </p>
            <p className="text-xs text-mist-500">Digite o usuário e a senha de um administrador ou gerente para autorizar:</p>
            <div>
              <label>Usuário (administrador ou gerente)</label>
              <input required value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Ex: Henrique" />
            </div>
            <div>
              <label>Senha</label>
              <input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </div>
            {adminAuthError && <p className="text-sm text-danger">{adminAuthError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTargetPayment(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-danger" disabled={adminAuthLoading}>
                {adminAuthLoading ? "Verificando..." : "Autorizar e excluir"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Editar datas de prova/retirada/devolução */}
      <Modal open={Boolean(datesOrder)} onClose={() => setDatesOrder(null)} title={`Editar datas — ${datesOrder?.orderNumber ?? ""}`}>
        {datesOrder && (
          <form onSubmit={handleSaveDates} className="space-y-4">
            <p className="text-xs text-mist-700">
              Pedido criado em {formatDateTimeBR(datesOrder.createdAt)} — este registro não pode ser alterado.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label>Data da prova</label>
                <input type="date" value={editFittingDate} onChange={(e) => setEditFittingDate(e.target.value)} />
              </div>
              <div>
                <label>Horário da prova</label>
                <input type="time" value={editFittingTime} onChange={(e) => setEditFittingTime(e.target.value)} />
              </div>
              <div>
                <label>Data da retirada</label>
                <input type="date" value={editPickupDate} onChange={(e) => setEditPickupDate(e.target.value)} />
              </div>
              <div>
                <label>Data da devolução</label>
                <input type="date" value={editReturnDate} onChange={(e) => setEditReturnDate(e.target.value)} />
              </div>
            </div>

            <button type="button" className="btn-secondary text-xs" onClick={handleCheckDateConflicts} disabled={datesChecking}>
              {datesChecking ? "Verificando..." : "Verificar disponibilidade com as novas datas"}
            </button>

            {datesConflicts.length > 0 && (
              <div className="card p-3 border-danger/50 space-y-2">
                <p className="text-danger text-xs font-semibold">⚠ Conflito de disponibilidade com outro pedido</p>
                {datesConflicts.map((c, idx) => (
                  <p key={idx} className="text-xs text-mist-300">
                    {c.productName} (disp. {c.availableQty}) — pedido {c.conflictingOrderNumber} ({c.conflictingClientName}), retirada{" "}
                    {dateBR(c.pickupDate)} / devolução {dateBR(c.returnDate)}
                  </p>
                ))}
                <p className="text-[11px] text-mist-500">
                  Isso é só um alerta — você ainda pode salvar, mas confira com o estoque antes de confirmar com o cliente.
                </p>
              </div>
            )}

            {datesError && <p className="text-sm text-danger">{datesError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDatesOrder(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={datesSaving}>
                {datesSaving ? "Salvando..." : "Salvar datas"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancelar pedido — exige senha de administrador ou gerente */}
      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancelar pedido — aprovação necessária">
        {cancelTarget && (
          <form onSubmit={handleConfirmCancel} className="space-y-4">
            <p className="text-sm text-mist-300">
              Cancelar o pedido <b>{cancelTarget.orderNumber}</b> ({cancelTarget.clientName}). O valor em aberto dele
              será zerado, o estoque comprometido é liberado, e um eventual crédito usado é estornado ao cliente.
              Essa ação fica registrada no log.
            </p>
            <p className="text-xs text-mist-500">Digite o usuário e a senha de um administrador ou gerente para autorizar:</p>
            <div>
              <label>Usuário (administrador ou gerente)</label>
              <input required value={cancelUsername} onChange={(e) => setCancelUsername(e.target.value)} placeholder="Ex: Henrique" />
            </div>
            <div>
              <label>Senha</label>
              <input type="password" required value={cancelPassword} onChange={(e) => setCancelPassword(e.target.value)} />
            </div>
            {cancelAuthError && <p className="text-sm text-danger">{cancelAuthError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)}>
                Voltar
              </button>
              <button type="submit" className="btn-danger" disabled={cancelAuthLoading}>
                {cancelAuthLoading ? "Verificando..." : "Autorizar e cancelar"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Editar pedido completo */}
      <Modal open={Boolean(editingOrder)} onClose={() => setEditingOrder(null)} title={`Editar pedido — ${editingOrder?.orderNumber ?? ""}`} wide>
        {editingOrder && (
          <OrderForm existingOrder={editingOrder} onCancel={() => setEditingOrder(null)} onSaved={() => setEditingOrder(null)} />
        )}
      </Modal>
    </div>
  );
}

function MenuAction({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 text-sm flex items-center justify-between disabled:opacity-50"
      onClick={onClick}
      disabled={busy}
    >
      {label} {busy && <span className="text-xs text-mist-500">gerando...</span>}
    </button>
  );
}
