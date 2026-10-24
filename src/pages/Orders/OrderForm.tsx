import React, { useEffect, useMemo, useState } from "react";
import { Client, Order, OrderItem, OrderType, PaymentMethod, PAYMENT_METHOD_LABELS, Product, ClientCategory, CLIENT_CATEGORY_LABELS, ORDER_STATUS_LABELS, SurchargeMode } from "../../types";
import { ClientService } from "../../services/ClientService";
import { CloudinaryService } from "../../services/CloudinaryService";
import { ProductService } from "../../services/ProductService";
import { OrderService, ConflictInfo, calcTotals } from "../../services/OrderService";
import { PaymentService } from "../../services/PaymentService";
import { CustomerCreditService } from "../../services/CustomerCreditService";
import { InvoiceService } from "../../services/InvoiceService";
import { dateBR, todayYMD } from "../../utils/dates";
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
  // Controle de nota fiscal fica numa coleção própria, separada do pedido —
  // em modo de edição, precisa buscar o registro existente (se houver).
  const [willIssueInvoice, setWillIssueInvoice] = useState(true);
  const [clientCategoryNotes, setClientCategoryNotes] = useState(existingOrder?.clientCategoryNotes || "");
  // `items` guarda o preço BASE de cada peça. O acréscimo "em peça" é somado
  // por cima disso (effectiveItems), para poder ser editado depois sem perder o preço original.
  const [items, setItems] = useState<OrderItem[]>(
    (existingOrder?.items || []).map((i) => (i.baseUnitValue !== undefined ? { ...i, unitValue: i.baseUnitValue } : i))
  );
  const [pickProductId, setPickProductId] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [pickComponents, setPickComponents] = useState<string[]>([]);

  const [orderDate, setOrderDate] = useState(existingOrder?.orderDate || (() => todayYMD())());
  const [eventDate, setEventDate] = useState(existingOrder?.eventDate || "");
  const [fittingDate, setFittingDate] = useState(existingOrder?.fittingDate || "");
  const [fittingTime, setFittingTime] = useState(existingOrder?.fittingTime || "");
  const [fittingNotes, setFittingNotes] = useState(existingOrder?.fittingNotes || "");
  const [pickupDate, setPickupDate] = useState(existingOrder?.pickupDate || "");
  const [pickupTime, setPickupTime] = useState(existingOrder?.pickupTime || "");
  const [returnDate, setReturnDate] = useState(existingOrder?.returnDate || "");
  const [returnTime, setReturnTime] = useState(existingOrder?.returnTime || "");

  const [discount, setDiscount] = useState(existingOrder?.discount || 0);
  const embeddedSurcharge = (existingOrder?.items || []).reduce((sum, i) => sum + (i.surchargeIncluded || 0), 0);
  const [surcharge, setSurcharge] = useState(embeddedSurcharge > 0 ? embeddedSurcharge : existingOrder?.surcharge || 0);
  const [surchargeMode, setSurchargeMode] = useState<SurchargeMode>(embeddedSurcharge > 0 ? "peca" : "contrato");
  const [surchargeReason, setSurchargeReason] = useState(existingOrder?.surchargeReason || "");
  const [surchargeItemIndex, setSurchargeItemIndex] = useState<number>(
    (existingOrder?.items || []).findIndex((i) => (i.surchargeIncluded || 0) > 0)
  );
  const [creditUsed, setCreditUsed] = useState(existingOrder?.creditUsed || 0);
  const [payments, setPayments] = useState<{ amount: number; method: PaymentMethod; cardBrand?: string; installments?: number }[]>([]);
  const [pickPaymentAmount, setPickPaymentAmount] = useState(0);
  const [pickPaymentMethod, setPickPaymentMethod] = useState<PaymentMethod>("pix");
  const [pickCardBrand, setPickCardBrand] = useState("");
  const [pickInstallments, setPickInstallments] = useState(1);
  const [orderDetails, setOrderDetails] = useState(existingOrder?.orderDetails || "");
  const [internalNotes, setInternalNotes] = useState(existingOrder?.internalNotes || "");

  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [conflictCheckDone, setConflictCheckDone] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => ClientService.subscribeAll(setClients), []);
  useEffect(() => {
    if (!existingOrder) return;
    InvoiceService.getForOrder(existingOrder.id).then((inv) => {
      if (inv) setWillIssueInvoice(inv.willIssue);
    });
  }, [existingOrder]);
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
  const filteredProducts = useMemo(() => ProductService.search(products, productSearchTerm), [products, productSearchTerm]);
  const filteredClients = useMemo(() => ClientService.search(clients, clientSearchTerm), [clients, clientSearchTerm]);
  const totalPaidSoFar = isEdit ? existingOrder!.amountPaid : payments.reduce((s, p) => s + p.amount, 0);
  // Itens "de verdade": se o acréscimo foi lançado numa peça, o valor dela já vem somado.
  const effectiveItems: OrderItem[] = useMemo(
    () =>
      items.map((it, idx) => {
        const { surchargeIncluded: _a, baseUnitValue: _b, ...rest } = it;
        if (surchargeMode === "peca" && surcharge > 0 && idx === surchargeItemIndex) {
          const qty = it.quantity || 1;
          const perUnit = Math.round((surcharge / qty) * 100) / 100;
          return {
            ...rest,
            unitValue: Math.round((rest.unitValue + perUnit) * 100) / 100,
            baseUnitValue: rest.unitValue,
            surchargeIncluded: Math.round(perUnit * qty * 100) / 100,
          };
        }
        return rest;
      }),
    [items, surchargeMode, surcharge, surchargeItemIndex]
  );
  // Só o acréscimo "do contrato" entra no campo surcharge do pedido.
  const effectiveSurcharge = surchargeMode === "contrato" ? surcharge : 0;
  const totals = useMemo(
    () => calcTotals({ items: effectiveItems, discount, surcharge: effectiveSurcharge, creditUsed, amountPaid: totalPaidSoFar }),
    [effectiveItems, discount, effectiveSurcharge, creditUsed, totalPaidSoFar]
  );
  const netTotal = Math.max(
    totals.totalValue - (discount || 0) + (effectiveSurcharge || 0) - (creditUsed || 0),
    0
  );

  function addPayment() {
    if (pickPaymentAmount <= 0) return;
    if (pickPaymentAmount - totals.openValue > 0.009) {
      setErrorMsg(
        `O pagamento é maior que o valor em aberto (${totals.openValue.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}).`
      );
      return;
    }
    setErrorMsg(null);
    setPayments((prev) => [
      ...prev,
      {
        amount: pickPaymentAmount,
        method: pickPaymentMethod,
        cardBrand: pickCardBrand || undefined,
        ...(pickPaymentMethod === "credito" ? { installments: pickInstallments } : {}),
      },
    ]);
    setPickPaymentAmount(0);
    setPickCardBrand("");
    setPickInstallments(1);
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
    setProductSearchTerm("");
    setConflicts([]);
    setConflictCheckDone(false);
    setConflictsAcknowledged(false);
  }

  function toggleComponent(name: string) {
    setPickComponents((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setSurchargeItemIndex((cur) => (cur === index ? -1 : cur > index ? cur - 1 : cur));
    setConflicts([]);
    setConflictCheckDone(false);
    setConflictsAcknowledged(false);
  }

  async function handleCheckConflicts() {
    setErrorMsg(null);
    setConflictCheckDone(false);
    if (items.length === 0) {
      setErrorMsg("Adicione ao menos um produto antes de verificar disponibilidade.");
      return;
    }
    if (!pickupDate || !(returnDate || type === "venda")) {
      setErrorMsg('Preencha "Data da retirada" e "Data da devolução" antes de verificar disponibilidade.');
      return;
    }
    setCheckingConflicts(true);
    try {
      const found = await OrderService.checkConflicts(effectiveItems, { pickupDate, returnDate: returnDate || pickupDate, fittingDate, eventDate }, 1, isEdit ? existingOrder!.id : undefined);
      setConflicts(found);
      setConflictsAcknowledged(false);
      setConflictCheckDone(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível verificar a disponibilidade agora. Tente de novo.");
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
    // Datas obrigatórias (horários são opcionais).
    const missingDates: string[] = [];
    if (!eventDate) missingDates.push("data do evento");
    if (!fittingDate) missingDates.push("data da prova");
    if (!pickupDate) missingDates.push("data da retirada");
    if (type === "locacao" && !returnDate) missingDates.push("data da devolução");
    if (missingDates.length > 0) {
      setErrorMsg(`Preencha as datas obrigatórias: ${missingDates.join(", ")}.`);
      return;
    }
    if (returnDate && pickupDate && returnDate < pickupDate) {
      setErrorMsg("A data da devolução não pode ser anterior à data da retirada.");
      return;
    }
    if (surcharge > 0) {
      if (surchargeMode === "peca" && !(surchargeItemIndex >= 0 && surchargeItemIndex < items.length)) {
        setErrorMsg("Selecione em qual peça do pedido o acréscimo será aplicado.");
        return;
      }
      const reasonRequired = !(isEdit && (existingOrder!.surcharge || 0) > 0 && !existingOrder!.surchargeReason);
      if (surchargeMode === "contrato" && reasonRequired && !surchargeReason.trim()) {
        setErrorMsg("Informe o motivo do acréscimo que aparecerá no contrato.");
        return;
      }
    }
    if (!isEdit && totalPaidSoFar - netTotal > 0.009) {
      setErrorMsg("O total dos pagamentos lançados é maior que o valor do pedido. Remova ou ajuste um pagamento.");
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

    // Confere a disponibilidade de novo na hora de salvar (as datas ou itens
    // podem ter mudado depois da última verificação, ou ela nunca ter sido
    // feita) — só avisa se ainda não houver liberação consciente.
    if (pickupDate && !conflictsAcknowledged) {
      setSaving(true);
      try {
        const fresh = await OrderService.checkConflicts(
          effectiveItems,
          { pickupDate, returnDate: returnDate || pickupDate, fittingDate, eventDate },
          1,
          isEdit ? existingOrder!.id : undefined
        );
        if (fresh.length > 0) {
          setConflicts(fresh);
          setConflictCheckDone(true);
          setConflictsAcknowledged(false);
          setErrorMsg('Há conflitos de disponibilidade para este período. Veja a lista abaixo e marque "Liberar mesmo com conflito" para continuar.');
          setSaving(false);
          return;
        }
      } catch (err: any) {
        setSaving(false);
        setErrorMsg(err.message || "Não foi possível verificar a disponibilidade agora. Tente de novo.");
        return;
      }
      setSaving(false);
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
            items: effectiveItems,
            clientCategory: clientCategory as ClientCategory,
            clientCategoryNotes,
            orderDate,
            eventDate,
            fittingDate,
            fittingTime,
            fittingNotes,
            pickupDate,
            pickupTime,
            returnDate,
            returnTime,
            discount,
            surcharge: effectiveSurcharge,
            surchargeMode: surcharge > 0 ? surchargeMode : null,
            surchargeReason: surcharge > 0 && surchargeMode === "contrato" ? surchargeReason.trim() : "",
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

        await InvoiceService.setWillIssue(
          { id: existingOrder!.id, orderNumber: existingOrder!.orderNumber, clientName: client.fullName, totalValue: totals.totalValue },
          willIssueInvoice,
          { id: user!.id, name: user!.name }
        );

        onSaved();
        return;
      }

      const orderData: Omit<Order, "id" | "orderNumber" | "totalValue" | "openValue" | "createdAt" | "updatedAt"> = {
        clientId: client.id,
        clientName: client.fullName,
        clientCpf: client.cpf,
        clientPhone: client.phone,
        type,
        items: effectiveItems,
        clientCategory: clientCategory as ClientCategory,
        clientCategoryNotes,
        orderDate,
        eventDate,
        fittingDate,
        fittingTime,
        fittingNotes,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        discount,
        surcharge: effectiveSurcharge,
        surchargeMode: surcharge > 0 ? surchargeMode : null,
        surchargeReason: surcharge > 0 && surchargeMode === "contrato" ? surchargeReason.trim() : "",
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
          { amount: p.amount, method: p.method, cardBrand: p.cardBrand, installments: p.installments, date: orderDate },
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

      await InvoiceService.setWillIssue(
        { id: created.id, orderNumber: created.orderNumber, clientName: client.fullName, totalValue: totals.totalValue },
        willIssueInvoice,
        { id: user!.id, name: user!.name }
      );

      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar pedido.");
    } finally {
      setSaving(false);
    }
  }

  const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const isSale = type === "venda";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl mx-auto">
      {/* 1 — Cliente e tipo */}
      <Section n={1} title="Cliente e tipo de pedido" hint="Quem está fazendo o pedido e se é locação ou venda.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label>Cliente *</label>
            {!isEdit && (
              <input
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF, telefone..."
                className="mb-2"
              />
            )}
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={isEdit}>
              <option value="">{filteredClients.length === 0 ? "Nenhum cliente encontrado" : "Selecione um cliente..."}</option>
              {(isEdit ? clients : filteredClients).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.cpf}
                </option>
              ))}
            </select>
            {!isEdit && clientSearchTerm && <p className="text-[11px] text-mist-500 mt-1">{filteredClients.length} encontrado(s)</p>}
            {isEdit && (
              <p className="text-[11px] text-mist-500 mt-1">
                O cliente não pode ser trocado num pedido já criado (isso protegeria o histórico e o crédito da pessoa
                errada). Cancele e crie um novo pedido se precisar mudar o cliente.
              </p>
            )}
            {client && !isEdit && (
              <p className="text-xs text-mist-500 mt-1">
                {client.phone} · Crédito disponível: {money(client.availableCredit)}
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

        <div className="mt-4 pt-4 border-t border-ink-600/70 space-y-3">
          <p className="text-sm font-semibold text-mist-100">Categoria do cliente *</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CLIENT_CATEGORY_LABELS) as [ClientCategory, string][]).map(([value, label]) => (
              <label
                key={value}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm normal-case font-medium cursor-pointer transition-colors mb-0 ${
                  clientCategory === value
                    ? "border-champagne bg-champagne-dim/60 text-mist-100"
                    : "border-champagne-soft/50 text-mist-300 hover:bg-champagne-dim/30"
                }`}
              >
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
      </Section>

      {/* 2 — Produtos */}
      <Section n={2} title="Produtos" hint="Busque, escolha a peça e adicione ao pedido.">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label>Buscar produto</label>
            <input value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)} placeholder="Nome, código, marca, cor..." />
          </div>
          <div className="md:col-span-5">
            <label>Produto {productSearchTerm && `(${filteredProducts.length} encontrado(s))`}</label>
            <select
              value={pickProductId}
              onChange={(e) => {
                setPickProductId(e.target.value);
                setPickComponents([]);
              }}
            >
              <option value="">Selecione...</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.internalCode}) — disp. {p.availableQuantity}
                  {p.componentNames && p.componentNames.length > 0 ? " — por peça" : ""}
                </option>
              ))}
            </select>
          </div>
          {!(pickProduct?.componentNames && pickProduct.componentNames.length > 0) && (
            <div className="md:col-span-1">
              <label>Qtd.</label>
              <input type="number" min={1} value={pickQty} onChange={(e) => setPickQty(Number(e.target.value))} />
            </div>
          )}
          <div className="md:col-span-2">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={addItem}
              disabled={
                !pickProductId ||
                Boolean(pickProduct?.componentNames && pickProduct.componentNames.length > 0 && pickComponents.length === 0)
              }
            >
              + Adicionar
            </button>
          </div>
        </div>

        {pickProduct && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-champagne-soft/50 bg-champagne-dim/20 p-3">
            {pickProduct.photoUrl && (
              <img src={CloudinaryService.thumb(pickProduct.photoUrl, 120)} alt="" className="w-14 h-14 rounded-lg object-cover border border-champagne-soft/60" />
            )}
            <div className="text-sm">
              <p className="font-semibold text-mist-100">{pickProduct.name}</p>
              <p className="text-xs text-mist-500">
                {pickProduct.internalCode} · {money(isSale ? pickProduct.saleValue : pickProduct.rentValue)}
              </p>
            </div>
          </div>
        )}

        {pickProduct?.componentNames && pickProduct.componentNames.length > 0 && (
          <div className="mt-3 border border-champagne-soft/50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-mist-300 uppercase tracking-wider">Componentes que serão locados *</p>
            <div className="flex flex-wrap gap-4">
              {pickProduct.componentNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm text-mist-100 normal-case font-normal cursor-pointer mb-0">
                  <input type="checkbox" className="!w-auto" checked={pickComponents.includes(name)} onChange={() => toggleComponent(name)} />
                  {name}
                </label>
              ))}
            </div>
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setPickComponents(pickProduct.componentNames || [])}>
              Selecionar conjunto completo
            </button>
          </div>
        )}

        {effectiveItems.length > 0 && (
          <div className="overflow-x-auto mt-4 rounded-xl border border-ink-600">
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
                {effectiveItems.map((i, idx) => (
                  <tr key={`${i.productId}-${(i.components || []).join(",")}-${idx}`}>
                    <td>
                      {i.productName} <span className="text-mist-500 text-xs">({i.internalCode})</span>
                      {(i.surchargeIncluded || 0) > 0 && (
                        <span className="block text-[11px] text-champagne">inclui acréscimo de {money(i.surchargeIncluded || 0)}</span>
                      )}
                    </td>
                    <td>{i.components && i.components.length > 0 ? i.components.join(", ") : "—"}</td>
                    <td>{i.quantity}</td>
                    <td>{money(i.unitValue)}</td>
                    <td>{money(i.unitValue * i.quantity)}</td>
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
      </Section>

      {/* 3 — Datas */}
      <Section n={3} title="Datas e horários" hint="As datas são obrigatórias. Os horários são opcionais.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label>Data do pedido</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label>Data do evento *</label>
            <input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <label>Data da prova *</label>
            <input type="date" required value={fittingDate} onChange={(e) => setFittingDate(e.target.value)} />
          </div>
          <div>
            <label>Horário da prova (opcional)</label>
            <input type="time" value={fittingTime} onChange={(e) => setFittingTime(e.target.value)} />
          </div>

          <div>
            <label>Data da retirada *</label>
            <input
              type="date"
              required
              value={pickupDate}
              onChange={(e) => {
                setPickupDate(e.target.value);
                setConflictCheckDone(false);
              }}
            />
          </div>
          <div>
            <label>Horário da retirada (opcional)</label>
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </div>
          <div>
            <label>Data da devolução {isSale ? "(não se aplica à venda)" : "*"}</label>
            <input
              type="date"
              required={!isSale}
              value={returnDate}
              min={pickupDate || undefined}
              onChange={(e) => {
                setReturnDate(e.target.value);
                setConflictCheckDone(false);
              }}
            />
          </div>
          <div>
            <label>Horário da devolução (opcional)</label>
            <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label>Observações da prova (opcional)</label>
            <input value={fittingNotes} onChange={(e) => setFittingNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={handleCheckConflicts} disabled={checkingConflicts}>
            {checkingConflicts ? "Verificando..." : "Verificar disponibilidade"}
          </button>
          {conflictCheckDone && conflicts.length === 0 && (
            <p className="text-success font-semibold text-sm">✓ Sem conflitos — todos os itens estão disponíveis para esse período.</p>
          )}
        </div>

        {conflicts.length > 0 && (
          <div className="mt-4 rounded-xl border border-danger/50 p-4 space-y-3">
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
                      <td>{ORDER_STATUS_LABELS[c.status] || c.status}</td>
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
            <label className="flex items-center gap-2 text-sm text-mist-100 normal-case mb-0">
              <input type="checkbox" className="!w-auto" checked={conflictsAcknowledged} onChange={(e) => setConflictsAcknowledged(e.target.checked)} />
              Liberar mesmo com conflito (fica registrado em log com meu usuário)
            </label>
          </div>
        )}
      </Section>

      {/* 4 — Valores */}
      <Section n={4} title="Valores" hint="Desconto, acréscimo e crédito do cliente.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label>Desconto (R$)</label>
            <input type="number" step="0.01" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label>Crédito usado (R$)</label>
            <input type="number" step="0.01" min={0} value={creditUsed || ""} onChange={(e) => setCreditUsed(Number(e.target.value))} placeholder="0" />
            {client && <p className="text-[11px] text-mist-500 mt-1">Disponível: {money(client.availableCredit)}</p>}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-champagne-soft/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label>Acréscimo (R$)</label>
              <input type="number" step="0.01" min={0} value={surcharge || ""} onChange={(e) => setSurcharge(Number(e.target.value))} placeholder="0" />
            </div>
            <div className="sm:col-span-2 text-xs text-mist-500">
              Escolha como o acréscimo será lançado: somado ao valor de uma peça (sem aparecer no contrato) ou mostrado no
              contrato com o motivo.
            </div>
          </div>

          {surcharge > 0 && (
            <div className="space-y-3">
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 normal-case font-normal text-sm cursor-pointer mb-0 ${
                  surchargeMode === "peca" ? "border-champagne bg-champagne-dim/40" : "border-ink-600"
                }`}
              >
                <input type="radio" name="surchargeMode" className="!w-auto mt-1" checked={surchargeMode === "peca"} onChange={() => setSurchargeMode("peca")} />
                <span className="flex-1">
                  <span className="font-semibold text-mist-100">Aplicar no valor de uma peça</span>
                  <span className="block text-xs text-mist-500">O contrato mostra só o valor final da peça, sem citar acréscimo.</span>
                  {surchargeMode === "peca" && (
                    <select className="mt-2" value={surchargeItemIndex} onChange={(e) => setSurchargeItemIndex(Number(e.target.value))}>
                      <option value={-1}>{items.length === 0 ? "Adicione uma peça ao pedido primeiro" : "Selecione a peça..."}</option>
                      {items.map((i, idx) => (
                        <option key={idx} value={idx}>
                          {i.productName} ({i.internalCode}){i.components && i.components.length > 0 ? ` — ${i.components.join(", ")}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              </label>

              <label
                className={`flex items-start gap-2 rounded-lg border p-3 normal-case font-normal text-sm cursor-pointer mb-0 ${
                  surchargeMode === "contrato" ? "border-champagne bg-champagne-dim/40" : "border-ink-600"
                }`}
              >
                <input type="radio" name="surchargeMode" className="!w-auto mt-1" checked={surchargeMode === "contrato"} onChange={() => setSurchargeMode("contrato")} />
                <span className="flex-1">
                  <span className="font-semibold text-mist-100">Mostrar no contrato</span>
                  <span className="block text-xs text-mist-500">O acréscimo aparece no contrato junto com o motivo (ex.: serviço extra).</span>
                  {surchargeMode === "contrato" && (
                    <input
                      className="mt-2"
                      value={surchargeReason}
                      onChange={(e) => setSurchargeReason(e.target.value)}
                      placeholder="Motivo do acréscimo (aparece no contrato)"
                    />
                  )}
                </span>
              </label>
            </div>
          )}
        </div>
      </Section>

      {/* 5 — Pagamentos */}
      {!isEdit ? (
        <Section n={5} title="Pagamentos" hint="Combine quantas formas de pagamento precisar até completar o valor.">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label>Valor (R$)</label>
              <input type="number" step="0.01" min={0} value={pickPaymentAmount || ""} onChange={(e) => setPickPaymentAmount(Number(e.target.value))} />
            </div>
            <div className="md:col-span-3">
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
              <div className="md:col-span-2">
                <label>Bandeira</label>
                <input value={pickCardBrand} onChange={(e) => setPickCardBrand(e.target.value)} placeholder="Bandeira do cartão" />
              </div>
            )}
            {pickPaymentMethod === "credito" && (
              <div className="md:col-span-2">
                <label>Parcelas</label>
                <select value={pickInstallments} onChange={(e) => setPickInstallments(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2 md:col-span-2">
              <button type="button" className="btn-secondary w-full" onClick={addPayment} disabled={pickPaymentAmount <= 0}>
                + Lançar
              </button>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="overflow-x-auto mt-4 rounded-xl border border-ink-600">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th>Bandeira</th>
                    <th>Parcelas</th>
                    <th>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr key={idx}>
                      <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                      <td>{p.cardBrand || "—"}</td>
                      <td>{p.installments ? `${p.installments}x` : "—"}</td>
                      <td>{money(p.amount)}</td>
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
          <p className="text-xs text-mist-500 mt-3">Cada lançamento vira um registro de pagamento de verdade assim que o pedido for salvo.</p>
        </Section>
      ) : (
        <p className="text-xs text-mist-500 px-1">
          Pagamentos são gerenciados separadamente — use "Pagamentos" no menu do pedido para lançar ou excluir um recebimento.
          Editar aqui não altera o valor já pago.
        </p>
      )}

      {/* Resumo */}
      <div className="card p-5 border-champagne-soft/60">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-mist-500">Valor dos produtos</p>
            <p className="text-lg font-display">{money(totals.totalValue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-mist-500">Total do pedido</p>
            <p className="text-lg font-display">{money(netTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-mist-500">Valor pago</p>
            <p className="text-lg font-display text-success">{money(totalPaidSoFar)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-mist-500">Valor em aberto</p>
            <p className="text-lg font-display text-warn">{money(totals.openValue)}</p>
          </div>
        </div>
      </div>

      {/* 6 — Observações e nota fiscal */}
      <Section n={6} title="Observações e nota fiscal">
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
        <div className="mt-4 pt-4 border-t border-ink-600/70">
          <p className="text-sm font-semibold text-mist-100 mb-2">Nota fiscal</p>
          <div className="flex flex-wrap gap-2">
            {[
              [true, "Emitir nota fiscal para este pedido"],
              [false, "Não emitir"],
            ].map(([val, label]) => (
              <label
                key={String(val)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm normal-case font-medium cursor-pointer mb-0 ${
                  willIssueInvoice === val ? "border-champagne bg-champagne-dim/60 text-mist-100" : "border-champagne-soft/50 text-mist-300"
                }`}
              >
                <input type="radio" name="willIssueInvoice" className="!w-auto" checked={willIssueInvoice === val} onChange={() => setWillIssueInvoice(val as boolean)} />
                {label as string}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-mist-500 mt-2">
            Isso só marca a intenção, para você acompanhar em "Notas Fiscais" no menu — a emissão em si continua sendo feita
            no seu emissor fiscal de costume.
          </p>
        </div>
      </Section>

      {errorMsg && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{errorMsg}</div>}

      <div className="flex justify-end gap-2 pb-2">
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

/** Cartão de seção da tela de pedido: número dourado, título e subtítulo. */
function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 border-champagne-soft/50">
      <header className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 shrink-0 rounded-full border border-champagne-soft text-champagne text-sm font-semibold flex items-center justify-center bg-champagne-dim/30">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight text-mist-100">{title}</h2>
          {hint && <p className="text-xs text-mist-500">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
