import jsPDF from "jspdf";
import { measureRows, itemsWithMeasures } from "../utils/measures";
import { CompanySettings, DocumentSettings, Order, PAYMENT_METHOD_LABELS, CLIENT_CATEGORY_LABELS, ORDER_STATUS_LABELS } from "../types";

/** Escapa texto digitado pelo usuário antes de colocar no HTML do documento
 * (nome com "&" ou "<", observações etc. não podem quebrar nem injetar HTML). */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** O acréscimo só aparece no contrato se foi lançado em modo "contrato"
 * (ou em pedidos antigos, sem modo, que sempre mostraram o acréscimo). */
function showSurcharge(order: Pick<Order, "surcharge" | "surchargeMode">) {
  return (order.surcharge || 0) > 0 && order.surchargeMode !== "peca";
}

/** Total líquido: produtos − desconto + acréscimo − crédito usado. */
function netTotal(order: Pick<Order, "totalValue" | "discount" | "surcharge" | "creditUsed">) {
  return Math.max((order.totalValue || 0) - (order.discount || 0) + (order.surcharge || 0) - (order.creditUsed || 0), 0);
}

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dateBR(v?: string) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return d && m && y ? `${d}/${m}/${y}` : v;
}

/** ---------------- HTML (para "Visualizar" e "Imprimir") ---------------- */

const BASE_STYLE = `
  body { font-family: 'Times New Roman', Times, serif; color: #1a1a1a; padding: 40px; max-width: 780px; margin: 0 auto; }
  h1 { font-size: 20px; letter-spacing: 1px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #555; margin-bottom: 28px; font-size: 13px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  td, th { padding: 5px 6px; text-align: left; border-bottom: 1px solid #eee; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; }
  .clause { font-size: 12.5px; margin: 6px 0; line-height: 1.5; }
  .totals { margin-top: 10px; font-size: 13px; }
  .totals b { font-size: 15px; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }
  .sign div { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid #333; margin-top: 50px; padding-top: 6px; font-size: 12px; }
  .footer { margin-top: 40px; font-size: 10.5px; color: #777; text-align: center; }
  .mcard { border: 1px solid #bbb; border-radius: 6px; padding: 10px 14px; margin: 14px 0; page-break-inside: avoid; }
  .mcard h3 { margin: 0 0 4px; font-size: 14px; }
  .mcard .meta { font-size: 12px; color: #444; margin-bottom: 6px; line-height: 1.5; }
  .mcard table td:first-child { width: 48%; font-weight: bold; }
  @media print { body { padding: 0; } }
`;

function itemsTable(order: Order) {
  return `
    <table>
      <thead><tr><th>Produto</th><th>Código</th><th>Componentes locados</th><th>Qtd.</th><th>Valor unit.</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${order.items
          .map(
            (i) =>
              `<tr><td>${esc(i.productName)}</td><td>${esc(i.internalCode)}</td><td>${
                i.components && i.components.length > 0 ? esc(i.components.join(", ")) : "—"
              }</td><td>${i.quantity}</td><td>${money(
                i.unitValue
              )}</td><td>${money(i.unitValue * i.quantity)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

export function buildContractHtml(order: Order, company: CompanySettings, settings: DocumentSettings) {
  return `
    <h1>${esc(settings.title)}</h1>
    <p class="subtitle">Pedido nº ${esc(order.orderNumber)}</p>

    <h2>Empresa</h2>
    <div class="grid">
      <div><b>Nome fantasia:</b> ${esc(company.tradeName || "—")}</div>
      <div><b>Razão social:</b> ${esc(company.legalName || "—")}</div>
      <div><b>CNPJ:</b> ${esc(company.cnpj || "—")}</div>
      <div><b>Telefone:</b> ${esc(company.phone || "—")}</div>
      <div><b>Endereço:</b> ${esc(company.address || "—")}</div>
      <div><b>E-mail:</b> ${esc(company.email || "—")}</div>
    </div>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${esc(order.clientName)}</div>
      <div><b>CPF:</b> ${esc(order.clientCpf)}</div>
      <div><b>Telefone:</b> ${esc(order.clientPhone)}</div>
      <div><b>Tipo:</b> ${order.type === "venda" ? "Venda" : "Locação"}</div>
      <div><b>Categoria do cliente:</b> ${order.clientCategory ? CLIENT_CATEGORY_LABELS[order.clientCategory] : "—"}</div>
    </div>

    <h2>Produtos</h2>
    ${itemsTable(order)}

    <h2>Datas</h2>
    <div class="grid">
      <div><b>Data do pedido:</b> ${dateBR(order.orderDate)}</div>
      <div><b>Data do evento:</b> ${dateBR(order.eventDate)}</div>
      <div><b>Data da prova:</b> ${dateBR(order.fittingDate)} ${esc(order.fittingTime || "")}</div>
      <div><b>Data da retirada:</b> ${dateBR(order.pickupDate)} ${esc(order.pickupTime || "")}</div>
      <div><b>Data da devolução:</b> ${dateBR(order.returnDate)} ${esc(order.returnTime || "")}</div>
    </div>

    <h2>Valores</h2>
    <div class="totals">
      <div>Forma de pagamento: ${PAYMENT_METHOD_LABELS[order.paymentMethod] || "—"}</div>
      <div>Valor dos produtos: ${money(order.totalValue)}</div>
      <div>Desconto: ${money(order.discount)} &nbsp; | &nbsp; Crédito usado: ${money(order.creditUsed)}</div>
      ${showSurcharge(order) ? `<div>Acréscimo: ${money(order.surcharge)}${order.surchargeReason ? ` — ${esc(order.surchargeReason)}` : ""}</div>` : ""}
      <div><b>Total do pedido: ${money(netTotal(order))}</b></div>
      <div>Valor pago: ${money(order.amountPaid)}</div>
      <div><b>Valor em aberto: ${money(order.openValue)}</b></div>
    </div>

    ${order.orderDetails ? `<h2>Detalhes do pedido</h2><p class="clause">${esc(order.orderDetails)}</p>` : ""}

    <h2>Cláusulas</h2>
    <p class="clause">${esc(settings.introText)}</p>
    ${settings.clauses.map((c, idx) => `<p class="clause">${idx + 1}. ${esc(c)}</p>`).join("")}

    <div class="sign">
      <div>
        <div class="line">${esc(order.clientName)}<br/>CPF ${esc(order.clientCpf)}</div>
      </div>
      <div>
        <div class="line">${esc(company.legalName || settings.companySignatureLabel)}</div>
      </div>
    </div>

    <p class="footer">${esc(settings.footer)}</p>
  `;
}

export function buildWithdrawalHtml(order: Order, company: CompanySettings, settings: DocumentSettings) {
  return `
    <h1>${esc(settings.title)}</h1>
    <p class="subtitle">Pedido nº ${esc(order.orderNumber)}</p>

    <h2>Empresa</h2>
    <div class="grid">
      <div><b>Nome fantasia:</b> ${esc(company.tradeName || "—")}</div>
      <div><b>Telefone:</b> ${esc(company.phone || "—")}</div>
    </div>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${esc(order.clientName)}</div>
      <div><b>CPF:</b> ${esc(order.clientCpf)}</div>
    </div>

    <h2>Produtos retirados</h2>
    ${itemsTable(order)}

    <h2>Datas</h2>
    <div class="grid">
      <div><b>Data da retirada:</b> ${dateBR(order.pickupDate)} ${esc(order.pickupTime || "")}</div>
      <div><b>Data da devolução:</b> ${dateBR(order.returnDate)} ${esc(order.returnTime || "")}</div>
    </div>

    <h2>Cláusulas</h2>
    <p class="clause">${esc(settings.introText)}</p>
    ${settings.clauses.map((c, idx) => `<p class="clause">${idx + 1}. ${esc(c)}</p>`).join("")}

    <div class="sign">
      <div><div class="line">${esc(order.clientName)}<br/>CPF ${esc(order.clientCpf)}</div></div>
      <div><div class="line">${esc(company.legalName || settings.companySignatureLabel)}</div></div>
    </div>

    <p class="footer">${esc(settings.footer)}</p>
  `;
}

export function buildInternalOrderHtml(order: Order) {
  return `
    <h1>PEDIDO INTERNO — USO EXCLUSIVO DA LOJA</h1>
    <p class="subtitle">Pedido nº ${esc(order.orderNumber)} · não enviar ao cliente</p>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${esc(order.clientName)}</div>
      <div><b>CPF:</b> ${esc(order.clientCpf)}</div>
      <div><b>Telefone:</b> ${esc(order.clientPhone)}</div>
      <div><b>Vendedor:</b> ${esc(order.sellerName || "—")}</div>
    </div>

    <h2>Produtos</h2>
    ${itemsTable(order)}

    <h2>Controle operacional</h2>
    <div class="grid">
      <div><b>Status:</b> ${ORDER_STATUS_LABELS[order.status] || esc(order.status)}</div>
      <div><b>Data do pedido:</b> ${dateBR(order.orderDate)}</div>
      <div><b>Data do evento:</b> ${dateBR(order.eventDate)}</div>
      <div><b>Prova:</b> ${dateBR(order.fittingDate)} ${esc(order.fittingTime || "")}</div>
      <div><b>Retirada:</b> ${dateBR(order.pickupDate)}</div>
      <div><b>Devolução:</b> ${dateBR(order.returnDate)}</div>
    </div>

    ${order.fittingNotes ? `<h2>Observação da prova</h2><p class="clause">${esc(order.fittingNotes)}</p>` : ""}

    <h2>Valores</h2>
    <div class="totals">
      ${order.items
        .filter((i) => (i.surchargeIncluded || 0) > 0)
        .map((i) => `<div>Acréscimo de ${money(i.surchargeIncluded || 0)} embutido na peça ${esc(i.productName)} (não aparece no contrato)</div>`)
        .join("")}
      ${(order.surcharge || 0) > 0 ? `<div>Acréscimo no contrato: ${money(order.surcharge)}${order.surchargeReason ? ` — ${esc(order.surchargeReason)}` : ""}</div>` : ""}
      <div>Valor total: ${money(netTotal(order))} · Pago: ${money(order.amountPaid)} · Em aberto: ${money(order.openValue)}</div>
    </div>

    ${order.internalNotes ? `<h2>Observações internas</h2><p class="clause">${esc(order.internalNotes)}</p>` : ""}
  `;
}


/** ---------------- MEDIDAS (uso interno — nunca vão no contrato) ---------------- */

function whenBR(date?: string, time?: string) {
  return `${dateBR(date)}${time ? ` às ${time}` : ""}`;
}

/** Cartões de medidas, um por peça/unidade, com cliente e datas do pedido. */
export function buildMeasuresHtml(orders: Order[]) {
  const cards = orders.flatMap((o) =>
    itemsWithMeasures(o.items).flatMap((it) =>
      (it.measures || []).map((m, idx, arr) => {
        const rows = measureRows(it.measureKind!, m);
        return `
        <div class="mcard" style="border:1px solid #bbb;border-radius:6px;padding:10px 14px;margin:14px 0;page-break-inside:avoid;">
          <h3 style="margin:0 0 4px;font-size:14px;">${esc(it.productName)} <span style="font-weight:normal;color:#666">(${esc(it.internalCode)})${
            it.components && it.components.length > 0 ? ` — ${esc(it.components.join(", "))}` : ""
          }${arr.length > 1 ? ` — unidade ${idx + 1} de ${arr.length}` : ""}</span></h3>
          <div class="meta" style="font-size:12px;color:#444;margin-bottom:6px;line-height:1.5;">
            <b>Cliente:</b> ${esc(o.clientName)} · <b>Pedido:</b> ${esc(o.orderNumber)}<br/>
            <b>Evento:</b> ${dateBR(o.eventDate)} · <b>Prova:</b> ${whenBR(o.fittingDate, o.fittingTime)} ·
            <b>Retirada:</b> ${whenBR(o.pickupDate, o.pickupTime)} · <b>Devolução:</b> ${whenBR(o.returnDate, o.returnTime)}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${rows.map((r) => `<tr><td style="width:48%;font-weight:bold;padding:4px 6px;border-bottom:1px solid #eee;">${esc(r.label)}</td><td style="padding:4px 6px;border-bottom:1px solid #eee;">${esc(r.value)}</td></tr>`).join("")}</tbody></table>
        </div>`;
      })
    )
  );
  return `
    <h1>MEDIDAS DOS PEDIDOS</h1>
    <p class="subtitle">Uso interno da loja · não enviar ao cliente</p>
    ${cards.length > 0 ? cards.join("") : '<p class="clause">Nenhuma medida registrada para o(s) pedido(s) selecionado(s).</p>'}
  `;
}

export function downloadMeasuresPdf(orders: Order[], fileName: string) {
  const c = pdfComposer("Medidas");
  c.h1("MEDIDAS DOS PEDIDOS");
  c.subtitle("Uso interno da loja · não enviar ao cliente");
  let count = 0;
  orders.forEach((o) =>
    itemsWithMeasures(o.items).forEach((it) =>
      (it.measures || []).forEach((m, idx, arr) => {
        count++;
        const comps = it.components && it.components.length > 0 ? ` — ${it.components.join(", ")}` : "";
        c.h2(`${it.productName} (${it.internalCode})${comps}${arr.length > 1 ? ` — unidade ${idx + 1}/${arr.length}` : ""}`);
        c.row("Cliente", o.clientName);
        c.row("Pedido", o.orderNumber);
        c.row("Evento", dateBR(o.eventDate));
        c.row("Prova", whenBR(o.fittingDate, o.fittingTime));
        c.row("Retirada", whenBR(o.pickupDate, o.pickupTime));
        c.row("Devolução", whenBR(o.returnDate, o.returnTime));
        measureRows(it.measureKind!, m).forEach((r) => c.row(r.label, r.value));
        c.space(10);
      })
    )
  );
  if (count === 0) c.paragraph("Nenhuma medida registrada para o(s) pedido(s) selecionado(s).");
  c.doc.save(fileName);
}

export function openPrintWindow(bodyHtml: string, documentTitle: string) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    alert("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
    return;
  }
  win.document.write(`
    <html>
      <head>
        <title>${esc(documentTitle)}</title>
        <style>${BASE_STYLE}</style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

/** ---------------- PDF (jsPDF, 100% no navegador, sem backend) ---------------- */

function pdfComposer(_title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 56;

  function ensureSpace(lines = 1, lineHeight = 14) {
    if (y + lines * lineHeight > pageHeight - 60) {
      doc.addPage();
      y = 56;
    }
  }
  function h1(text: string) {
    ensureSpace(2, 20);
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    y += 22;
  }
  function subtitle(text: string) {
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(20);
    y += 22;
  }
  function h2(text: string) {
    doc.setFont("times", "bold");
    doc.setFontSize(11.5);
    const titleLines: string[] = doc.splitTextToSize(text.toUpperCase(), pageWidth - marginX * 2);
    ensureSpace(titleLines.length + 1, 15);
    doc.text(titleLines, marginX, y);
    y += (titleLines.length - 1) * 14 + 6;
    doc.setDrawColor(200);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;
  }
  function row(label: string, value: string) {
    ensureSpace(2, 14);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, marginX, y);
    doc.setFont("times", "normal");
    const valueLines = doc.splitTextToSize(value || "—", pageWidth - marginX * 2 - 120);
    doc.text(valueLines, marginX + 120, y);
    y += Math.max(valueLines.length, 1) * 13 + 3;
  }
  function paragraph(text: string, numbered?: number) {
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const prefix = numbered ? `${numbered}. ` : "";
    const lines = doc.splitTextToSize(prefix + text, pageWidth - marginX * 2);
    ensureSpace(lines.length, 13);
    doc.text(lines, marginX, y);
    y += lines.length * 13 + 4;
  }
  function tableItems(items: { productName: string; internalCode: string; quantity: number; unitValue: number; components?: string[] }[]) {
    ensureSpace(3, 14);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text("Produto", marginX, y);
    doc.text("Componentes", marginX + 150, y);
    doc.text("Código", marginX + 255, y);
    doc.text("Qtd.", marginX + 310, y);
    doc.text("Unit.", marginX + 345, y);
    doc.text("Subtotal", marginX + 420, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
    doc.setFont("times", "normal");
    items.forEach((i) => {
      const componentsLabel = i.components && i.components.length > 0 ? i.components.join(", ") : "—";
      const nameLines: string[] = doc.splitTextToSize(i.productName, 140);
      const compLines: string[] = doc.splitTextToSize(componentsLabel, 98);
      const lines = Math.max(nameLines.length, compLines.length, 1);
      ensureSpace(lines, 13);
      doc.text(nameLines, marginX, y);
      doc.text(compLines, marginX + 150, y);
      doc.text(i.internalCode, marginX + 255, y);
      doc.text(String(i.quantity), marginX + 310, y);
      doc.text(money(i.unitValue), marginX + 345, y);
      doc.text(money(i.unitValue * i.quantity), marginX + 420, y);
      y += lines * 12 + 5;
    });
    y += 6;
  }
  function space(n: number) {
    y += n;
  }
  function signatures(clientLabel: string, companyLabel: string) {
    ensureSpace(6, 14);
    y += 40;
    const colWidth = (pageWidth - marginX * 2) / 2;
    doc.setDrawColor(60);
    doc.line(marginX, y, marginX + colWidth - 20, y);
    doc.line(marginX + colWidth + 20, y, pageWidth - marginX, y);
    y += 14;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.text(clientLabel, marginX, y, { maxWidth: colWidth - 20 });
    doc.text(companyLabel, marginX + colWidth + 20, y, { maxWidth: colWidth - 20 });
    y += 30;
  }
  function footer(text: string) {
    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(130);
    doc.text(text, pageWidth / 2, pageHeight - 30, { align: "center" });
  }

  return {
    doc,
    h1,
    subtitle,
    h2,
    row,
    paragraph,
    tableItems,
    space,
    signatures,
    footer,
  };
}

export function downloadContractPdf(order: Order, company: CompanySettings, settings: DocumentSettings) {
  const c = pdfComposer(settings.title);
  c.h1(settings.title);
  c.subtitle(`Pedido nº ${esc(order.orderNumber)}`);

  c.h2("Empresa");
  c.row("Nome fantasia", company.tradeName);
  c.row("Razão social", company.legalName);
  c.row("CNPJ", company.cnpj);
  c.row("Telefone", company.phone);
  c.row("Endereço", company.address);
  c.row("E-mail", company.email);

  c.h2("Cliente");
  c.row("Nome", order.clientName);
  c.row("CPF", order.clientCpf);
  c.row("Telefone", order.clientPhone);
  c.row("Tipo", order.type === "venda" ? "Venda" : "Locação");
  c.row("Categoria do cliente", order.clientCategory ? CLIENT_CATEGORY_LABELS[order.clientCategory] : "—");

  c.h2("Produtos");
  c.tableItems(order.items);

  c.h2("Datas");
  c.row("Data do pedido", dateBR(order.orderDate));
  c.row("Data do evento", dateBR(order.eventDate));
  c.row("Data da prova", `${dateBR(order.fittingDate)} ${esc(order.fittingTime || "")}`.trim());
  c.row("Data da retirada", `${dateBR(order.pickupDate)} ${order.pickupTime || ""}`.trim());
  c.row("Data da devolução", `${dateBR(order.returnDate)} ${order.returnTime || ""}`.trim());

  c.h2("Valores");
  c.row("Forma de pagamento", PAYMENT_METHOD_LABELS[order.paymentMethod] || "—");
  c.row("Valor dos produtos", money(order.totalValue));
  c.row("Desconto", money(order.discount));
  if (showSurcharge(order)) {
    c.row("Acréscimo", `${money(order.surcharge)}${order.surchargeReason ? ` — ${order.surchargeReason}` : ""}`);
  }
  c.row("Crédito usado", money(order.creditUsed));
  c.row("Total do pedido", money(netTotal(order)));
  c.row("Valor pago", money(order.amountPaid));
  c.row("Valor em aberto", money(order.openValue));

  if (order.orderDetails) {
    c.h2("Detalhes do pedido");
    c.paragraph(order.orderDetails);
  }

  c.h2("Cláusulas");
  c.paragraph(settings.introText);
  settings.clauses.forEach((clause, idx) => c.paragraph(clause, idx + 1));

  c.signatures(`${esc(order.clientName)}\nCPF ${esc(order.clientCpf)}`, company.legalName || settings.companySignatureLabel);
  c.footer(settings.footer);

  c.doc.save(`contrato-${esc(order.orderNumber)}.pdf`);
}

export function downloadWithdrawalPdf(order: Order, company: CompanySettings, settings: DocumentSettings) {
  const c = pdfComposer(settings.title);
  c.h1(settings.title);
  c.subtitle(`Pedido nº ${esc(order.orderNumber)}`);

  c.h2("Empresa");
  c.row("Nome fantasia", company.tradeName);
  c.row("Telefone", company.phone);

  c.h2("Cliente");
  c.row("Nome", order.clientName);
  c.row("CPF", order.clientCpf);

  c.h2("Produtos retirados");
  c.tableItems(order.items);

  c.h2("Datas");
  c.row("Data da retirada", `${dateBR(order.pickupDate)} ${order.pickupTime || ""}`.trim());
  c.row("Data da devolução", `${dateBR(order.returnDate)} ${order.returnTime || ""}`.trim());

  c.h2("Cláusulas");
  c.paragraph(settings.introText);
  settings.clauses.forEach((clause, idx) => c.paragraph(clause, idx + 1));

  c.signatures(`${esc(order.clientName)}\nCPF ${esc(order.clientCpf)}`, company.legalName || settings.companySignatureLabel);
  c.footer(settings.footer);

  c.doc.save(`retirada-${esc(order.orderNumber)}.pdf`);
}

/** ---------------- E-mail (mailto — funciona sem backend nem conta externa) ---------------- */

export function buildContractMailto(order: Order, clientEmail: string | undefined) {
  const subject = encodeURIComponent(`Contrato — Pedido ${order.orderNumber} — Diamond Sect`);
  const body = encodeURIComponent(
    `Olá ${esc(order.clientName)},\n\n` +
      `Segue o resumo do seu contrato referente ao pedido ${esc(order.orderNumber)}:\n\n` +
      `Produtos: ${order.items.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}\n` +
      `Data da retirada: ${dateBR(order.pickupDate)}\n` +
      `Data da devolução: ${dateBR(order.returnDate)}\n` +
      `Valor total: ${money(netTotal(order))}\n` +
      `Valor em aberto: ${money(order.openValue)}\n\n` +
      `Obs.: anexe o arquivo PDF do contrato (baixado pelo sistema) antes de enviar este e-mail.\n\n` +
      `Atenciosamente,\nDiamond Sect`
  );
  return `mailto:${clientEmail || ""}?subject=${subject}&body=${body}`;
}
