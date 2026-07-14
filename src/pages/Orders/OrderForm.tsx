import React, { useEffect, useMemo, useState } from "react";
import { Client, Order, OrderItem, OrderType, PaymentMethod, PAYMENT_METHOD_LABELS, Product, ClientCategory, CLIENT_CATEGORY_LABELS } from "../../types";
import { ClientService } from "../../services/ClientService";
import { ProductService } from "../../services/ProductService";
import { OrderService, ConflictInfo, calcTotals } from "../../services/OrderService";
import { PaymentService } from "../../services/PaymentService";
import { CustomerCreditService } from "../../services/CustomerCreditService";
import { dateBR } from "../../utils/dates";
import { effectiveItemComponents } from "../../utils/components";
import { useAuth } from "../../hooks/useAuth";

export function OrderForm({
  existingOrder,
  onSaved,
  onCancel,
}: {
  existingOrder?: Order;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(existingOrder);
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [clientId, setClientId] = useState(existingOrder?.clientId || "");
  const [type, setType] = useState<OrderType>(existingOrder?.type || "locacao");
  const [clientCategory, setClientCategory] = useState<ClientCategory | "">(existingOrder?.clientCategory || "");
  const [clientCategoryNotes, setClientCategoryNotes] = useState(existingOrder?.clientCategoryNotes || "");
  const [items, setItems] = useState<OrderItem[]>(existingOrder?.items || []);
  const [pickProductId, setPickProductId] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [pickComponents, setPickComponents] = useState<string[]>([]);

  const [orderDate, setOrderDate] = useState(existingOrder?.orderDate || (() => new Date().toISOString().slice(0, 10))());
  const [eventDate, setEventDate] = useState(existingOrder?.eventDate || "");
  const [fittingDate, setFittingDate] = useState(existingOrder?.fittingDate || "");
  const [fittingTime, setFittingTime] = useState(existingOrder?.fittingTime || "");
  const [fittingNotes, setFittingNotes] = useState(existingOrder?.fittingNotes || "");
  const [pickupDate, setPickupDate] = useState(existingOrder?.pickupDate || "");
  const [returnDate, setReturnDate] = useState(existingOrder?.returnDate || "");

  const [discount, setDiscount] = useState(existingOrder?.discount || 0);
  const [surcharge, setSurcharge] = useState(existingOrder?.surcharge || 0);
  const [creditUsed, setCreditUsed] = useState(existingOrder?.creditUsed || 0);
  const [payments, setPayments] = useState<{ amount: number; method: PaymentMethod; cardBrand?: string }[]>([]);
  const [pickPaymentAmount, setPickPaymentAmount] = useState(0);
  const [pickPaymentMethod, setPickPaymentMethod] = useState<PaymentMethod>("pix");
  const [pickCardBrand, setPickCardBrand] = useState("");
  const [orderDetails, setOrderDetails] = useState(existingOrder?.orderDetails || "");
  const [internalNotes, setInternalNotes] = useState(existingOrder?.internalNotes || "");

  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => ClientService.subscribeAll(setClients), []);
  useEffect(() => ProductService.subscribeAll(setProducts), []);

  // Se o Tipo (venda/locação) mudar depois que já tem produto no carrinho,
  // recalcula o valor unitário de cada item pelo tipo novo — sem isso, um
  // produto adicionado como "venda" continuava com o preço de venda mesmo
  // depois de trocar para "locação", o que bagunçava o valor total.
  useEffect(() => {
    setItems((prev) =>
      prev.map((i) => {
        const product = products.find((p) => p.id === i.productId);
        if (!product) return i;
        return { ...i, unitValue: type === "venda" ? product.saleValue : product.rentValue };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const client = clients.find((c) => c.id === clientId);
  const pickProduct = products.find((p) => p.id === pickProductId);
  const totalPaidSoFar = isEdit ? existingOrder!.amountPaid : payments.reduce((s, p) => s + p.amount, 0);
  const totals = useMemo(() => calcTotals({ items, discount, surcharge, creditUsed, amountPaid: totalPaidSoFar }), [
    items,
    discount,
    surcharge,
    creditUsed,
    totalPaidSoFar,
  ]);

  function addPayment() {
    if (pickPaymentAmount <= 0) return;
    setPayments((prev) => [...prev, { amount: pickPaymentAmount, method: pickPaymentMethod, cardBrand: pickCardBrand || undefined }]);
    setPickPaymentAmount(0);
    setPickCardBrand("");
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    const product = products.find((p) => p.id === pickProductId);
    if (!product) return;
    if (pickQty < 1) return;

    const hasComponents = Boolean(product.componentNames && product.componentNames.length > 0);
    if (hasComponents && pickComponents.length === 0) {
      setErrorMsg("Selecione ao menos um componente para adicionar este produto.");
      return;
    }

    // Produto com componentes: cada linha representa um conjunto específico
    // de peças de UMA unidade — não faz sentido "2 paletós" se o produto em
    // si tem 1 unidade cadastrada, então a quantidade fica sempre 1.
    const qty = hasComponents ? 1 : pickQty;
    const existingQty = hasComponents ? 0 : items.filter((i) => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
    if (!hasComponents && existingQty + qty > product.availableQuantity) {
      setErrorMsg(
        `Apenas ${product.availableQuantity} unidade(s) de "${product.name}" disponível(is) em estoque (já há ${existingQty} no pedido).`
      );
    } else {
      setErrorMsg(null);
    }
    const unitValue = type === "venda" ? product.saleValue : product.rentValue;

    setItems((prev) => {
      if (hasComponents) {
        // Cada combinação de componentes é uma linha própria — não mistura
        // com outra linha do mesmo produto que tenha um conjunto diferente
        // (ex.: já tem "Paletó" no pedido e agora adiciona "Colete" à parte).
        const sortedNew = [...pickComponents].sort().join("|");
        const already = prev.some(
          (i) => i.productId === product.id && [...(i.components || [])].sort().join("|") === sortedNew
        );
        if (already) return prev;
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            internalCode: product.internalCode,
            quantity: 1,
            unitValue,
            components: pickComponents,
          },
        ];
      }
      const existing = prev.find((i) => i.productId === product.id && !i.components);
      if (existing) {
        return prev.map((i) => (i.productId === product.id && !i.components ? { ...i, quantity: i.quantity + qty } : i));
      }
      return [...prev, { productId: product.id, productName: product.name, internalCode: product.internalCode, quantity: qty, unitValue }];
    });
    setPickProductId("");
    setPickQty(1);
    setPickComponents([]);
    setConflicts([]);
    setConflictsAcknowledged(false);
  }

  function toggleComponent(name: string) {
    setPickComponents((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCheckConflicts() {
    if (items.length === 0 || !pickupDate || !returnDate) return;
    setCheckingConflicts(true);
    try {
      const found = await OrderService.checkConflicts(items, { pickupDate, returnDate, fittingDate, eventDate }, 1);
      setConflicts(found);
      setConflictsAcknowledged(false);
    } finally {
      setCheckingConflicts(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!client) {
      setErrorMsg("Selecione um cliente.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Adicione ao menos um produto.");
      return;
    }
    if (!clientCategory) {
      setErrorMsg("Selecione a categoria do cliente.");
      return;
    }
    if (conflicts.length > 0 && !conflictsAcknowledged) {
      setErrorMsg('Há conflitos de disponibilidade. Marque "Liberar mesmo com conflito" para continuar.');
      return;
    }

    // Ao editar, o crédito que este pedido já tinha reservado conta como
    // "disponível de novo" para a validação — senão pareceria que o cliente
    // não tem nem o crédito que ele mesmo já havia comprometido aqui.
    const creditHeadroom = isEdit ? client.availableCredit + (existingOrder!.creditUsed || 0) : client.availableCredit;
    if (creditUsed > creditHeadroom) {
      setErrorMsg(
        `O cliente só tem ${creditHeadroom.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} de crédito disponível.`
      );
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await OrderService.update(
          existingOrder!.id,
          {
            clientId: client.id,
            clientName: client.fullName,
            clientCpf: client.cpf,
            clientPhone: client.phone,
            type,
            items,
            clientCategory: clientCategory as ClientCategory,
            clientCategoryNotes,
            orderDate,
            eventDate,
            fittingDate,
            fittingTime,
            fittingNotes,
            pickupDate,
            returnDate,
            discount,
            surcharge,
            creditUsed,
            orderDetails,
            internalNotes,
          },
          { id: user!.id, name: user!.name }
        );

        const creditDelta = creditUsed - (existingOrder!.creditUsed || 0);
        if (creditDelta !== 0) {
          await CustomerCreditService.adjust(
            client.id,
            -creditDelta,
            `Ajuste de crédito — pedido ${existingOrder!.orderNumber} editado`,
            { id: user!.id, name: user!.name },
            { id: existingOrder!.id, orderNumber: existingOrder!.orderNumber }
          );
        }

        if (conflicts.length > 0 && conflictsAcknowledged) {
          for (const c of conflicts) {
            await OrderService.logConflictOverride(
              { id: user!.id, name: user!.name },
              { productId: c.productId, productName: c.productName, quantity: c.requestedQty },
              overrideReason
            );
          }
        }

        onSaved();
        return;
      }

      const orderData: Omit<Order, "id" | "orderNumber" | "totalValue" | "openValue" | "createdAt" | "updatedAt"> = {
        clientId: client.id,
        clientName: client.fullName,
        clientCpf: client.cpf,
        clientPhone: client.phone,
        type,
        items,
        clientCategory: clientCategory as ClientCategory,
        clientCategoryNotes,
        orderDate,
        eventDate,
        fittingDate,
        fittingTime,
        fittingNotes,
        pickupDate,
        returnDate,
        discount,
        surcharge,
        creditUsed,
        // O valor pago começa em 0 aqui de propósito: cada pagamento lançado
        // abaixo vira um registro de verdade (PaymentService), para aparecer
        // no Financeiro e no Caixa — e não ficar "invisível" só no pedido.
        amountPaid: 0,
        paymentMethod: payments[0]?.method || "dinheiro",
        orderDetails,
        internalNotes,
        status: "orcamento",
        sellerId: user?.id || "",
        sellerName: user?.name || "",
      };

      const created = await OrderService.create(orderData, { id: user!.id, name: user!.name });

      for (const p of payments) {
        await PaymentService.register(
          { id: created.id },
          { amount: p.amount, method: p.method, cardBrand: p.cardBrand, date: orderDate },
          { id: user!.id, name: user!.name }
        );
      }

      if (creditUsed > 0) {
        await CustomerCreditService.adjust(
          client.id,
          -creditUsed,
          `Usado no pedido ${created.orderNumber}`,
          { id: user!.id, name: user!.name },
          { id: created.id, orderNumber: created.orderNumber }
        );
      }

      if (conflicts.length > 0 && conflictsAcknowledged) {
        for (const c of conflicts) {
          await OrderService.logConflictOverride(
            { id: user!.id, name: user!.name },
            { productId: c.productId, productName: c.productName, quantity: c.requestedQty },
            overrideReason
          );
        }
      }

      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cliente e tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label>Cliente *</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={isEdit}>
            <option value="">Selecione um cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.cpf}
              </option>
            ))}
          </select>
          {isEdit && (
            <p className="text-[11px] text-mist-500 mt-1">
              O cliente não pode ser trocado num pedido já criado (isso protegeria o histórico e o crédito da pessoa
              errada). Cancele e crie um novo pedido se precisar mudar o cliente.
            </p>
          )}
          {client && !isEdit && (
            <p className="text-xs text-mist-500 mt-1">
              {client.phone} · Crédito disponível:{" "}
              {client.availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          )}
        </div>
        <div>
          <label>Tipo *</label>
          <select value={type} onChange={(e) => setType(e.target.value as OrderType)}>
            <option value="locacao">Locação</option>
            <option value="venda">Venda</option>
          </select>
        </div>
      </div>

      {/* Categoria do cliente */}
      <div className="card p-4 space-y-3">
        <p className="font-display text-lg">Categoria do cliente *</p>
        <div className="flex flex-wrap gap-4">
          {(Object.entries(CLIENT_CATEGORY_LABELS) as [ClientCategory, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-mist-100 normal-case font-normal cursor-pointer">
              <input
                type="radio"
                name="clientCategory"
                value={value}
                checked={clientCategory === value}
                onChange={() => setClientCategory(value)}
                className="!w-auto"
              />
              {label}
            </label>
          ))}
        </div>
        <div>
          <label>Observações da categoria (uso interno — não aparece no contrato)</label>
          <textarea
            rows={2}
            value={clientCategoryNotes}
            onChange={(e) => setClientCategoryNotes(e.target.value)}
            placeholder="Digite informações adicionais (opcional)..."
          />
        </div>
      </div>

      {/* Produtos */}
      <div className="card p-4 space-y-3">
        <p className="font-display text-lg">Produtos</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <label>Produto</label>
            <select
              value={pickProductId}
              onChange={(e) => {
                setPickProductId(e.target.value);
                setPickComponents([]);
              }}
            >
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.internalCode}) — disp. {p.availableQuantity}
                  {p.componentNames && p.componentNames.length > 0 ? " — por peça" : ""}
                </option>
              ))}
            </select>
          </div>
          {!(pickProduct?.componentNames && pickProduct.componentNames.length > 0) && (
            <div className="w-24">
              <label>Qtd.</label>
              <input type="number" min={1} value={pickQty} onChange={(e) => setPickQty(Number(e.target.value))} />
            </div>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={addItem}
            disabled={
              !pickProductId ||
              Boolean(pickProduct?.componentNames && pickProduct.componentNames.length > 0 && pickComponents.length === 0)
            }
          >
            + Adicionar
          </button>
        </div>

        {pickProduct?.componentNames && pickProduct.componentNames.length > 0 && (
          <div className="border border-ink-600 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-mist-300 uppercase tracking-wider">Componentes que serão locados *</p>
            <div className="flex flex-wrap gap-4">
              {pickProduct.componentNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm text-mist-100 normal-case font-normal cursor-pointer">
                  <input type="checkbox" className="!w-auto" checked={pickComponents.includes(name)} onChange={() => toggleComponent(name)} />
                  {name}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs"
              onClick={() => setPickComponents(pickProduct.componentNames || [])}
            >
              Selecionar conjunto completo
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Componentes</th>
                <th>Qtd.</th>
                <th>Valor unit.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={`${i.productId}-${(i.components || []).join(",")}-${idx}`}>
                  <td>
                    {i.productName} <span className="text-mist-500 text-xs">({i.internalCode})</span>
                  </td>
                  <td>{i.components && i.components.length > 0 ? i.components.join(", ") : "—"}</td>
                  <td>{i.quantity}</td>
                  <td>{i.unitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td>{(i.unitValue * i.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td>
                    <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => removeItem(idx)}>
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label>Data do pedido</label>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </div>
        <div>
          <label>Data do evento</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div>
          <label>Data da prova</label>
          <input type="date" value={fittingDate} onChange={(e) => setFittingDate(e.target.value)} />
        </div>
        <div>
          <label>Horário da prova</label>
          <input type="time" value={fittingTime} onChange={(e) => setFittingTime(e.target.value)} />
        </div>
        <div>
          <label>Obs. da prova</label>
          <input value={fittingNotes} onChange={(e) => setFittingNotes(e.target.value)} />
        </div>
        <div>
          <label>Data da retirada</label>
          <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
        </div>
        <div>
          <label>Data da devolução</label>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="button" className="btn-secondary w-full" onClick={handleCheckConflicts} disabled={checkingConflicts}>
            {checkingConflicts ? "Verificando..." : "Verificar disponibilidade"}
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="card p-4 border-danger/50 space-y-3">
          <p className="text-danger font-semibold text-sm">⚠ Conflito de disponibilidade encontrado</p>
          <div className="overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Componentes em conflito</th>
                <th>Qtd. pedida</th>
                <th>Qtd. disponível</th>
                <th>Pedido conflitante</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Retirada</th>
                <th>Devolução</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.productName}</td>
                  <td>{c.conflictingComponents?.join(", ") || "—"}</td>
                  <td>{c.requestedQty}</td>
                  <td className={c.availableQty < c.requestedQty ? "text-danger" : "text-success"}>{c.availableQty}</td>
                  <td className="text-diamond">{c.conflictingOrderNumber}</td>
                  <td>{c.conflictingClientName}</td>
                  <td>{c.status}</td>
                  <td>{dateBR(c.pickupDate)}</td>
                  <td>{dateBR(c.returnDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div>
            <label>Motivo (opcional)</label>
            <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Explique por que está liberando mesmo com conflito" />
          </div>
          <label className="flex items-center gap-2 text-sm text-mist-100 normal-case">
            <input
              type="checkbox"
              className="!w-auto"
              checked={conflictsAcknowledged}
              onChange={(e) => setConflictsAcknowledged(e.target.checked)}
            />
            Liberar mesmo com conflito (fica registrado em log com meu usuário)
          </label>
        </div>
      )}

      {/* Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label>Desconto (R$)</label>
          <input type="number" step="0.01" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0" />
        </div>
        <div>
          <label>Acréscimo (R$)</label>
          <input type="number" step="0.01" value={surcharge || ""} onChange={(e) => setSurcharge(Number(e.target.value))} placeholder="0" />
        </div>
        <div>
          <label>Crédito usado (R$)</label>
          <input type="number" step="0.01" value={creditUsed || ""} onChange={(e) => setCreditUsed(Number(e.target.value))} placeholder="0" />
          {client && <p className="text-[11px] text-mist-500 mt-1">Disponível: {client.availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
        </div>
      </div>

      {/* Lançamentos de pagamento — pode combinar quantas formas quiser até fechar o valor */}
      {!isEdit && (
        <div className="card p-4 space-y-3">
          <p className="font-display text-lg">Pagamentos</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-32">
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={pickPaymentAmount || ""}
                onChange={(e) => setPickPaymentAmount(Number(e.target.value))}
              />
            </div>
            <div className="w-44">
              <label>Forma de pagamento</label>
              <select value={pickPaymentMethod} onChange={(e) => setPickPaymentMethod(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {(pickPaymentMethod === "credito" || pickPaymentMethod === "debito") && (
              <div className="w-40">
                <label>Bandeira</label>
                <input value={pickCardBrand} onChange={(e) => setPickCardBrand(e.target.value)} placeholder="Ex: Visa" />
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={addPayment} disabled={pickPaymentAmount <= 0}>
              + Lançar pagamento
            </button>
          </div>

          {payments.length > 0 && (
            <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Bandeira</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={idx}>
                    <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td>{p.cardBrand || "—"}</td>
                    <td>{p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td>
                      <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => removePayment(idx)}>
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          <p className="text-xs text-mist-500">
            Combine quantas formas de pagamento precisar (dinheiro + pix + cartão, por exemplo) até completar o valor.
            Cada lançamento vira um registro de pagamento de verdade assim que o pedido for salvo.
          </p>
        </div>
      )}
      {isEdit && (
        <p className="text-xs text-mist-500">
          Pagamentos são gerenciados separadamente — use "Pagamentos" no menu do pedido para lançar ou excluir um
          recebimento. Editar aqui não altera o valor já pago.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 card p-4">
        <div>
          <p className="text-xs text-mist-500">Valor total</p>
          <p className="text-xl font-display">{totals.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <div>
          <p className="text-xs text-mist-500">Valor pago</p>
          <p className="text-xl font-display text-success">{totalPaidSoFar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <div>
          <p className="text-xs text-mist-500">Valor em aberto</p>
          <p className="text-xl font-display text-warn">{totals.openValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label>Detalhes do pedido (aparece no contrato)</label>
          <textarea rows={3} value={orderDetails} onChange={(e) => setOrderDetails(e.target.value)} />
        </div>
        <div>
          <label>Observações internas (não aparece no contrato)</label>
          <textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </div>
      </div>

      {errorMsg && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{errorMsg}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar pedido"}
        </button>
      </div>
    </form>
  );
}
