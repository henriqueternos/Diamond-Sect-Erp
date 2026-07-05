import jsPDF from "jspdf";
import { CompanySettings, DocumentSettings, Order, PAYMENT_METHOD_LABELS } from "../types";

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
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; padding: 40px; max-width: 780px; margin: 0 auto; }
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
  @media print { body { padding: 0; } }
`;

function itemsTable(order: Order) {
  return `
    <table>
      <thead><tr><th>Produto</th><th>Código</th><th>Qtd.</th><th>Valor unit.</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${order.items
          .map(
            (i) =>
              `<tr><td>${i.productName}</td><td>${i.internalCode}</td><td>${i.quantity}</td><td>${money(
                i.unitValue
              )}</td><td>${money(i.unitValue * i.quantity)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

export function buildContractHtml(order: Order, company: CompanySettings, settings: DocumentSettings) {
  return `
    <h1>${settings.title}</h1>
    <p class="subtitle">Pedido nº ${order.orderNumber}</p>

    <h2>Empresa</h2>
    <div class="grid">
      <div><b>Nome fantasia:</b> ${company.tradeName || "—"}</div>
      <div><b>Razão social:</b> ${company.legalName || "—"}</div>
      <div><b>CNPJ:</b> ${company.cnpj || "—"}</div>
      <div><b>Telefone:</b> ${company.phone || "—"}</div>
      <div><b>Endereço:</b> ${company.address || "—"}</div>
      <div><b>E-mail:</b> ${company.email || "—"}</div>
    </div>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${order.clientName}</div>
      <div><b>CPF:</b> ${order.clientCpf}</div>
      <div><b>Telefone:</b> ${order.clientPhone}</div>
      <div><b>Tipo:</b> ${order.type === "venda" ? "Venda" : "Locação"}</div>
    </div>

    <h2>Produtos</h2>
    ${itemsTable(order)}

    <h2>Datas</h2>
    <div class="grid">
      <div><b>Data do pedido:</b> ${dateBR(order.orderDate)}</div>
      <div><b>Data do evento:</b> ${dateBR(order.eventDate)}</div>
      <div><b>Data da prova:</b> ${dateBR(order.fittingDate)} ${order.fittingTime || ""}</div>
      <div><b>Data da retirada:</b> ${dateBR(order.pickupDate)}</div>
      <div><b>Data da devolução:</b> ${dateBR(order.returnDate)}</div>
    </div>

    <h2>Valores</h2>
    <div class="totals">
      <div>Forma de pagamento: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}</div>
      <div>Desconto: ${money(order.discount)} &nbsp; | &nbsp; Acréscimo: ${money(order.surcharge)} &nbsp; | &nbsp; Crédito usado: ${money(
    order.creditUsed
  )}</div>
      <div>Valor pago: ${money(order.amountPaid)}</div>
      <div><b>Valor total: ${money(order.totalValue)}</b></div>
      <div><b>Valor em aberto: ${money(order.openValue)}</b></div>
    </div>

    ${order.orderDetails ? `<h2>Detalhes do pedido</h2><p class="clause">${order.orderDetails}</p>` : ""}

    <h2>Cláusulas</h2>
    <p class="clause">${settings.introText}</p>
    ${settings.clauses.map((c, idx) => `<p class="clause">${idx + 1}. ${c}</p>`).join("")}

    <div class="sign">
      <div>
        <div class="line">${order.clientName}<br/>CPF ${order.clientCpf}</div>
      </div>
      <div>
        <div class="line">${company.legalName || settings.companySignatureLabel}</div>
      </div>
    </div>

    <p class="footer">${settings.footer}</p>
  `;
}

export function buildWithdrawalHtml(order: Order, company: CompanySettings, settings: DocumentSettings) {
  return `
    <h1>${settings.title}</h1>
    <p class="subtitle">Pedido nº ${order.orderNumber}</p>

    <h2>Empresa</h2>
    <div class="grid">
      <div><b>Nome fantasia:</b> ${company.tradeName || "—"}</div>
      <div><b>Telefone:</b> ${company.phone || "—"}</div>
    </div>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${order.clientName}</div>
      <div><b>CPF:</b> ${order.clientCpf}</div>
    </div>

    <h2>Produtos retirados</h2>
    ${itemsTable(order)}

    <h2>Datas</h2>
    <div class="grid">
      <div><b>Data da retirada:</b> ${dateBR(order.pickupDate)}</div>
      <div><b>Data da devolução:</b> ${dateBR(order.returnDate)}</div>
    </div>

    <h2>Cláusulas</h2>
    <p class="clause">${settings.introText}</p>
    ${settings.clauses.map((c, idx) => `<p class="clause">${idx + 1}. ${c}</p>`).join("")}

    <div class="sign">
      <div><div class="line">${order.clientName}<br/>CPF ${order.clientCpf}</div></div>
      <div><div class="line">${company.legalName || settings.companySignatureLabel}</div></div>
    </div>

    <p class="footer">${settings.footer}</p>
  `;
}

export function buildInternalOrderHtml(order: Order) {
  return `
    <h1>PEDIDO INTERNO — USO EXCLUSIVO DA LOJA</h1>
    <p class="subtitle">Pedido nº ${order.orderNumber} · não enviar ao cliente</p>

    <h2>Cliente</h2>
    <div class="grid">
      <div><b>Nome:</b> ${order.clientName}</div>
      <div><b>CPF:</b> ${order.clientCpf}</div>
      <div><b>Telefone:</b> ${order.clientPhone}</div>
      <div><b>Vendedor:</b> ${order.sellerName || "—"}</div>
    </div>

    <h2>Produtos</h2>
    ${itemsTable(order)}

    <h2>Controle operacional</h2>
    <div class="grid">
      <div><b>Status:</b> ${order.status}</div>
      <div><b>Data do pedido:</b> ${dateBR(order.orderDate)}</div>
      <div><b>Data do evento:</b> ${dateBR(order.eventDate)}</div>
      <div><b>Prova:</b> ${dateBR(order.fittingDate)} ${order.fittingTime || ""}</div>
      <div><b>Retirada:</b> ${dateBR(order.pickupDate)}</div>
      <div><b>Devolução:</b> ${dateBR(order.returnDate)}</div>
    </div>

    ${order.fittingNotes ? `<h2>Observação da prova</h2><p class="clause">${order.fittingNotes}</p>` : ""}

    <h2>Valores</h2>
    <div class="totals">
      <div>Valor total: ${money(order.totalValue)} · Pago: ${money(order.amountPaid)} · Em aberto: ${money(order.openValue)}</div>
    </div>

    ${order.internalNotes ? `<h2>Observações internas</h2><p class="clause">${order.internalNotes}</p>` : ""}
  `;
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
        <title>${documentTitle}</title>
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
    ensureSpace(2, 18);
    doc.setFont("times", "bold");
    doc.setFontSize(11.5);
    doc.text(text.toUpperCase(), marginX, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;
  }
  function row(label: string, value: string) {
    ensureSpace(1, 14);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, marginX, y);
    doc.setFont("times", "normal");
    doc.text(value || "—", marginX + 120, y);
    y += 16;
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
  function tableItems(items: { productName: string; internalCode: string; quantity: number; unitValue: number }[]) {
    ensureSpace(items.length + 2, 14);
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text("Produto", marginX, y);
    doc.text("Código", marginX + 220, y);
    doc.text("Qtd.", marginX + 300, y);
    doc.text("Unit.", marginX + 350, y);
    doc.text("Subtotal", marginX + 430, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
    doc.setFont("times", "normal");
    items.forEach((i) => {
      ensureSpace(1, 14);
      doc.text(i.productName.slice(0, 34), marginX, y);
      doc.text(i.internalCode, marginX + 220, y);
      doc.text(String(i.quantity), marginX + 300, y);
      doc.text(money(i.unitValue), marginX + 350, y);
      doc.text(money(i.unitValue * i.quantity), marginX + 430, y);
      y += 15;
    });
    y += 6;
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
    signatures,
    footer,
  };
}

export function downloadContractPdf(order: Order, company: CompanySettings, settings: DocumentSettings) {
  const c = pdfComposer(settings.title);
  c.h1(settings.title);
  c.subtitle(`Pedido nº ${order.orderNumber}`);

  c.h2("Empresa");
  c.row("Nome fantasia", company.tradeName);
  c.row("Razão social", company.legalName);
  c.row("CNPJ", company.cnpj);
  c.row("Telefone", company.phone);

  c.h2("Cliente");
  c.row("Nome", order.clientName);
  c.row("CPF", order.clientCpf);
  c.row("Telefone", order.clientPhone);
  c.row("Tipo", order.type === "venda" ? "Venda" : "Locação");

  c.h2("Produtos");
  c.tableItems(order.items);

  c.h2("Datas");
  c.row("Data do pedido", dateBR(order.orderDate));
  c.row("Data do evento", dateBR(order.eventDate));
  c.row("Data da prova", `${dateBR(order.fittingDate)} ${order.fittingTime || ""}`.trim());
  c.row("Data da retirada", dateBR(order.pickupDate));
  c.row("Data da devolução", dateBR(order.returnDate));

  c.h2("Valores");
  c.row("Forma de pagamento", PAYMENT_METHOD_LABELS[order.paymentMethod]);
  c.row("Desconto", money(order.discount));
  c.row("Acréscimo", money(order.surcharge));
  c.row("Crédito usado", money(order.creditUsed));
  c.row("Valor pago", money(order.amountPaid));
  c.row("Valor total", money(order.totalValue));
  c.row("Valor em aberto", money(order.openValue));

  if (order.orderDetails) {
    c.h2("Detalhes do pedido");
    c.paragraph(order.orderDetails);
  }

  c.h2("Cláusulas");
  c.paragraph(settings.introText);
  settings.clauses.forEach((clause, idx) => c.paragraph(clause, idx + 1));

  c.signatures(`${order.clientName}\nCPF ${order.clientCpf}`, company.legalName || settings.companySignatureLabel);
  c.footer(settings.footer);

  c.doc.save(`contrato-${order.orderNumber}.pdf`);
}

export function downloadWithdrawalPdf(order: Order, company: CompanySettings, settings: DocumentSettings) {
  const c = pdfComposer(settings.title);
  c.h1(settings.title);
  c.subtitle(`Pedido nº ${order.orderNumber}`);

  c.h2("Empresa");
  c.row("Nome fantasia", company.tradeName);
  c.row("Telefone", company.phone);

  c.h2("Cliente");
  c.row("Nome", order.clientName);
  c.row("CPF", order.clientCpf);

  c.h2("Produtos retirados");
  c.tableItems(order.items);

  c.h2("Datas");
  c.row("Data da retirada", dateBR(order.pickupDate));
  c.row("Data da devolução", dateBR(order.returnDate));

  c.h2("Cláusulas");
  c.paragraph(settings.introText);
  settings.clauses.forEach((clause, idx) => c.paragraph(clause, idx + 1));

  c.signatures(`${order.clientName}\nCPF ${order.clientCpf}`, company.legalName || settings.companySignatureLabel);
  c.footer(settings.footer);

  c.doc.save(`retirada-${order.orderNumber}.pdf`);
}

/** ---------------- E-mail (mailto — funciona sem backend nem conta externa) ---------------- */

export function buildContractMailto(order: Order, clientEmail: string | undefined) {
  const subject = encodeURIComponent(`Contrato — Pedido ${order.orderNumber} — Diamond Sect`);
  const body = encodeURIComponent(
    `Olá ${order.clientName},\n\n` +
      `Segue o resumo do seu contrato referente ao pedido ${order.orderNumber}:\n\n` +
      `Produtos: ${order.items.map((i) => `${i.productName} (x${i.quantity})`).join(", ")}\n` +
      `Data da retirada: ${dateBR(order.pickupDate)}\n` +
      `Data da devolução: ${dateBR(order.returnDate)}\n` +
      `Valor total: ${money(order.totalValue)}\n` +
      `Valor em aberto: ${money(order.openValue)}\n\n` +
      `Obs.: anexe o arquivo PDF do contrato (baixado pelo sistema) antes de enviar este e-mail.\n\n` +
      `Atenciosamente,\nDiamond Sect`
  );
  return `mailto:${clientEmail || ""}?subject=${subject}&body=${body}`;
}
