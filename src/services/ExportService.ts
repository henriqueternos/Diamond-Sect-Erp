import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export interface ExportColumn {
  key: string;
  label: string;
  width?: number; // pt, usado apenas no PDF
}

export function exportTablePdf(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  filename: string,
  summaryLines: string[] = []
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const marginX = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, marginX, y);
  y += 18;

  if (summaryLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    summaryLines.forEach((line) => {
      doc.text(line, marginX, y);
      y += 12;
    });
    y += 6;
  }

  const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0);
  const tableWidth = pageWidth - marginX * 2;
  const colWidths = columns.map((c) => ((c.width || 1) / totalWeight) * tableWidth);

  function drawHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    let x = marginX;
    columns.forEach((c, idx) => {
      doc.text(c.label, x, y);
      x += colWidths[idx];
    });
    y += 5;
    doc.setDrawColor(180);
    doc.line(marginX, y, marginX + tableWidth, y);
    y += 12;
  }

  drawHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  rows.forEach((row) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 40;
      drawHeader();
    }
    let x = marginX;
    columns.forEach((c, idx) => {
      const value = String(row[c.key] ?? "—");
      doc.text(value.slice(0, 40), x, y, { maxWidth: colWidths[idx] - 4 });
      x += colWidths[idx];
    });
    y += 14;
  });

  doc.save(filename);
}

export function exportTableExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[]
) {
  const data = rows.map((row) => {
    const obj: Record<string, string | number> = {};
    columns.forEach((c) => (obj[c.label] = row[c.key] ?? ""));
    return obj;
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
