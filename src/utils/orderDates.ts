import { dateBR } from "./dates";

/**
 * Ordem lógica das datas de um pedido (da mais cedo para a mais tarde):
 *
 *   Prova  ≤  Retirada  ≤  Evento  ≤  Devolução
 *
 * Datas no mesmo dia são permitidas (ex.: provar e retirar no mesmo dia).
 * Campos vazios são ignorados — só se compara o que já foi preenchido.
 * Todas as datas são strings AAAA-MM-DD, então comparar como texto funciona.
 */
export type OrderDateKey = "fittingDate" | "pickupDate" | "eventDate" | "returnDate";

export const ORDER_DATE_SEQUENCE: OrderDateKey[] = ["fittingDate", "pickupDate", "eventDate", "returnDate"];

export const ORDER_DATE_LABELS: Record<OrderDateKey, string> = {
  fittingDate: "Prova",
  pickupDate: "Retirada",
  eventDate: "Evento",
  returnDate: "Devolução",
};

/** Como cada data aparece dentro de uma frase. */
const WORDING: Record<OrderDateKey, { art: string; de: string; name: string }> = {
  fittingDate: { art: "A", de: "da", name: "prova" },
  pickupDate: { art: "A", de: "da", name: "retirada" },
  eventDate: { art: "O", de: "do", name: "evento" },
  returnDate: { art: "A", de: "da", name: "devolução" },
};

export type OrderDateValues = Partial<Record<OrderDateKey, string | null | undefined>> & {
  orderDate?: string | null;
};

export interface DateRuleOptions {
  /** Só em pedido novo: nenhuma data pode ser anterior à data do pedido.
   * Em edição isso fica desligado para não travar pedidos antigos. */
  checkOrderDate?: boolean;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function filled(v: string | null | undefined): v is string {
  return typeof v === "string" && YMD.test(v);
}

/** Diferença em dias inteiros (b − a), sem sofrer com horário de verão. */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export interface DateBounds {
  min?: string;
  max?: string;
  /** Qual outra data impôs o mínimo/máximo — usado nas dicas do calendário. */
  minFrom?: string;
  maxFrom?: string;
}

/** Menor/maior data que o campo `key` pode ter, dado o que já foi preenchido nos outros. */
export function dateBounds(key: OrderDateKey, values: OrderDateValues, opts: DateRuleOptions = {}): DateBounds {
  const idx = ORDER_DATE_SEQUENCE.indexOf(key);
  const out: DateBounds = {};

  if (opts.checkOrderDate && filled(values.orderDate)) {
    out.min = values.orderDate;
    out.minFrom = "Data do pedido";
  }
  for (const k of ORDER_DATE_SEQUENCE.slice(0, idx)) {
    const v = values[k];
    if (filled(v) && (!out.min || v > out.min)) {
      out.min = v;
      out.minFrom = ORDER_DATE_LABELS[k];
    }
  }
  for (const k of ORDER_DATE_SEQUENCE.slice(idx + 1)) {
    const v = values[k];
    if (filled(v) && (!out.max || v < out.max)) {
      out.max = v;
      out.maxFrom = ORDER_DATE_LABELS[k];
    }
  }
  return out;
}

export interface DateValidation {
  /** Mensagem por campo (o mesmo problema aparece nos dois campos envolvidos). */
  errors: Partial<Record<OrderDateKey, string>>;
  /** Mensagens únicas, para mostrar em lista. */
  messages: string[];
}

export function validateOrderDates(values: OrderDateValues, opts: DateRuleOptions = {}): DateValidation {
  const errors: Partial<Record<OrderDateKey, string>> = {};
  const messages: string[] = [];
  const push = (msg: string) => {
    if (!messages.includes(msg)) messages.push(msg);
  };

  // Todos os pares fora de ordem (não só vizinhos): "prova depois do evento" também pega.
  for (let i = 0; i < ORDER_DATE_SEQUENCE.length; i++) {
    for (let j = i + 1; j < ORDER_DATE_SEQUENCE.length; j++) {
      const ki = ORDER_DATE_SEQUENCE[i];
      const kj = ORDER_DATE_SEQUENCE[j];
      const vi = values[ki];
      const vj = values[kj];
      if (filled(vi) && filled(vj) && vi > vj) {
        const wi = WORDING[ki];
        const wj = WORDING[kj];
        const msg = `${wi.art} ${wi.name} (${dateBR(vi)}) não pode ser depois ${wj.de} ${wj.name} (${dateBR(vj)}).`;
        push(msg);
        if (!errors[ki]) errors[ki] = msg;
        if (!errors[kj]) errors[kj] = msg;
      }
    }
  }

  if (opts.checkOrderDate && filled(values.orderDate)) {
    for (const k of ORDER_DATE_SEQUENCE) {
      const v = values[k];
      if (filled(v) && v < values.orderDate) {
        const w = WORDING[k];
        const msg = `${w.art} ${w.name} (${dateBR(v)}) não pode ser antes da data do pedido (${dateBR(values.orderDate)}).`;
        push(msg);
        if (!errors[k]) errors[k] = msg;
      }
    }
  }

  return { errors, messages };
}

/** Primeira mensagem de erro, ou null se as datas estão coerentes. */
export function firstDateError(values: OrderDateValues, opts: DateRuleOptions = {}): string | null {
  return validateOrderDates(values, opts).messages[0] || null;
}

/** Quantos dias de folga entre as datas antes de pedir uma segunda olhada. */
const FAR_GAP_DAYS = 30;

/** Avisos que NÃO bloqueiam: datas válidas, mas com intervalo estranho (típico de erro de digitação no mês/ano). */
export function dateWarnings(values: OrderDateValues): Partial<Record<OrderDateKey, string>> {
  const out: Partial<Record<OrderDateKey, string>> = {};
  const { pickupDate, eventDate, returnDate } = values;
  if (filled(pickupDate) && filled(eventDate)) {
    const gap = diffDays(pickupDate, eventDate);
    if (gap > FAR_GAP_DAYS) out.pickupDate = `A retirada está ${gap} dias antes do evento. Confere se a data está certa?`;
  }
  if (filled(eventDate) && filled(returnDate)) {
    const gap = diffDays(eventDate, returnDate);
    if (gap > FAR_GAP_DAYS) out.returnDate = `A devolução está ${gap} dias depois do evento. Confere se a data está certa?`;
  }
  return out;
}
