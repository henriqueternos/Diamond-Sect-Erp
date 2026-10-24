import type { MeasureKind, MeasureValues, OrderItem, Product } from "../types";

/** Remove acentos e põe em minúsculas, para comparar textos livres. */
function norm(v?: string) {
  return (v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface MeasureSpec {
  kind: MeasureKind;
  /** Terno/blazer: pede medidas do paletó (punho + ajuste atrás). */
  jacket: boolean;
  /** Terno: pede medidas da calça. */
  pants: boolean;
}

type ProductLike = Pick<Product, "productType" | "category" | "subcategory" | "name">;

/**
 * Identifica se a peça do pedido exige medidas e quais campos mostrar.
 * - "vestido" no tipo/categoria/nome → medidas de vestido;
 * - terno, blazer, paletó, smoking... → medidas de terno;
 * - produto com componentes: só pede o que foi de fato locado (paletó → punho; calça → calça);
 * - blazer avulso (sem "terno") não tem calça, então só pede as do paletó.
 */
export function measureSpecFor(product: ProductLike | undefined, item?: Pick<OrderItem, "components">): MeasureSpec | null {
  if (!product) return null;
  const text = norm(`${product.productType} ${product.category} ${product.subcategory || ""} ${product.name}`);
  if (/vestido/.test(text)) return { kind: "vestido", jacket: false, pants: false };
  if (!/terno|blazer|paleto|smoking|fraque|summer/.test(text)) return null;

  const comps = (item?.components || []).map(norm);
  if (comps.length > 0) {
    const jacket = comps.some((c) => /paleto|blazer|jaqueta|casaco|smoking|fraque/.test(c));
    const pants = comps.some((c) => /calca/.test(c));
    if (!jacket && !pants) return null; // ex.: só o colete
    return { kind: "terno", jacket, pants };
  }
  const blazerOnly = /blazer|paleto/.test(text) && !/terno|smoking|fraque|summer/.test(text);
  return { kind: "terno", jacket: true, pants: !blazerOnly };
}

export type FieldDef = { key: string; label: string };

export const TERNO_JACKET: FieldDef[] = [{ key: "punho", label: "Altura total do punho" }];
export const TERNO_PANTS: FieldDef[] = [
  { key: "calcaAltura", label: "Altura total da calça" },
  { key: "calcaCintura", label: "Cintura total da calça" },
];
export const VESTIDO_FIELDS: FieldDef[] = [
  { key: "busto", label: "Busto" },
  { key: "abaixoBusto", label: "Abaixo do busto" },
  { key: "cintura", label: "Cintura" },
  { key: "quadril", label: "Quadril" },
  { key: "saiaFrente", label: "Altura da saia — parte da frente" },
  { key: "saiaCostas", label: "Altura da saia — parte das costas" },
];

/** Aceita "12", "12,5" ou "12.5"; devolve null se não for número maior que zero. */
export function parseMeasure(v?: string): number | null {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fmt = (v?: string) => `${String(v ?? "").trim().replace(".", ",")} cm`;

/** Lista (em linguagem de pessoa) do que ainda falta preencher. */
export function missingMeasures(spec: MeasureSpec, v: MeasureValues): string[] {
  const miss: string[] = [];
  const need = (defs: FieldDef[]) => defs.forEach((d) => parseMeasure(v[d.key]) === null && miss.push(d.label));

  if (spec.kind === "terno") {
    if (spec.jacket) {
      need(TERNO_JACKET);
    }
    if (spec.pants) need(TERNO_PANTS);
    if (spec.jacket) {
      if (v.backAdjust !== "sim" && v.backAdjust !== "nao") miss.push("Ajuste na parte de trás (sim ou não)");
      else if (v.backAdjust === "sim" && !(v.backAdjustNote || "").trim()) miss.push("Descrição do ajuste na parte de trás");
    }
    if (spec.pants) {
      if (v.legAdjust !== "sim" && v.legAdjust !== "nao") miss.push("Ajuste nas laterais da perna (sim ou não)");
      else if (v.legAdjust === "sim" && !(v.legAdjustNote || "").trim()) miss.push("Descrição do ajuste nas laterais da perna");
    }
    return miss;
  }

  need(VESTIDO_FIELDS);
  if (v.strapAdjust !== "sim" && v.strapAdjust !== "nao") {
    miss.push("Ajuste na alça (sim ou não)");
  } else if (v.strapAdjust === "sim") {
    if (!["direita", "esquerda", "ambas"].includes(v.strapSide)) {
      miss.push("Qual alça será ajustada");
    } else if (v.strapSide === "direita") {
      if (parseMeasure(v.strapRight) === null) miss.push("Medida do ajuste da alça direita");
    } else if (v.strapSide === "esquerda") {
      if (parseMeasure(v.strapLeft) === null) miss.push("Medida do ajuste da alça esquerda");
    } else if (v.strapMode !== "igual" && v.strapMode !== "diferente") {
      miss.push("Alças com a mesma medida ou medidas diferentes");
    } else if (v.strapMode === "igual") {
      if (parseMeasure(v.strapBoth) === null) miss.push("Medida do ajuste das alças");
    } else {
      if (parseMeasure(v.strapRight) === null) miss.push("Medida do ajuste da alça direita");
      if (parseMeasure(v.strapLeft) === null) miss.push("Medida do ajuste da alça esquerda");
    }
  }
  return miss;
}

/** Guarda só o que se aplica às respostas dadas (some campos de "sim" quando a resposta é "não" etc.). */
export function cleanMeasures(spec: MeasureSpec, v: MeasureValues): MeasureValues {
  const out: MeasureValues = {};
  const keep = (k: string) => {
    const val = (v[k] || "").trim();
    if (val) out[k] = val;
  };
  if (spec.kind === "terno") {
    if (spec.jacket) {
      TERNO_JACKET.forEach((d) => keep(d.key));
      keep("backAdjust");
      if (v.backAdjust === "sim") keep("backAdjustNote");
    }
    if (spec.pants) {
      TERNO_PANTS.forEach((d) => keep(d.key));
      keep("legAdjust");
      if (v.legAdjust === "sim") keep("legAdjustNote");
    }
  } else {
    VESTIDO_FIELDS.forEach((d) => keep(d.key));
    keep("strapAdjust");
    if (v.strapAdjust === "sim") {
      keep("strapSide");
      if (v.strapSide === "direita") keep("strapRight");
      else if (v.strapSide === "esquerda") keep("strapLeft");
      else if (v.strapSide === "ambas") {
        keep("strapMode");
        if (v.strapMode === "igual") keep("strapBoth");
        else {
          keep("strapRight");
          keep("strapLeft");
        }
      }
    }
  }
  keep("notes");
  return out;
}

/** Linhas "rótulo → valor" para exibir/imprimir as medidas já salvas. */
export function measureRows(kind: MeasureKind, v: MeasureValues): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const num = (defs: FieldDef[]) => defs.forEach((d) => v[d.key] && rows.push({ label: d.label, value: fmt(v[d.key]) }));
  const yesNo = (label: string, ans: string | undefined, note?: string) => {
    if (ans === "sim") rows.push({ label, value: `Sim — ${note || ""}`.trim() });
    else if (ans === "nao") rows.push({ label, value: "Não" });
  };

  if (kind === "terno") {
    num(TERNO_JACKET);
    num(TERNO_PANTS);
    yesNo("Ajuste na parte de trás do terno", v.backAdjust, v.backAdjustNote);
    yesNo("Ajuste nas laterais da perna da calça", v.legAdjust, v.legAdjustNote);
  } else {
    num(VESTIDO_FIELDS);
    if (v.strapAdjust === "nao") rows.push({ label: "Ajuste na alça", value: "Não" });
    else if (v.strapAdjust === "sim") {
      let txt = "Sim — ";
      if (v.strapSide === "direita") txt += `alça direita: ${fmt(v.strapRight)}`;
      else if (v.strapSide === "esquerda") txt += `alça esquerda: ${fmt(v.strapLeft)}`;
      else if (v.strapMode === "igual") txt += `ambas as alças, mesma medida: ${fmt(v.strapBoth)}`;
      else txt += `direita: ${fmt(v.strapRight)} · esquerda: ${fmt(v.strapLeft)}`;
      rows.push({ label: "Ajuste na alça", value: txt });
    }
  }
  if (v.notes) rows.push({ label: "Observações", value: v.notes });
  return rows;
}

/** Itens do pedido que têm medidas salvas. */
export function itemsWithMeasures(items: OrderItem[]) {
  return items.filter((i) => i.measureKind && i.measures && i.measures.length > 0);
}
