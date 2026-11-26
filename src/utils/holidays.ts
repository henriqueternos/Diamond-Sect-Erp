import { toYMD } from "./dates";

/** Feriado nacional ("feriado") ou ponto facultativo ("facultativo", como
 * Carnaval e Corpus Christi, que não são feriados por lei federal mas, na
 * prática, muita loja fecha ou funciona diferente). */
export interface Holiday {
  name: string;
  kind: "feriado" | "facultativo";
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
 * Os feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) saem
 * dele — por isso não precisa atualizar a lista todo ano. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

const cache = new Map<number, Map<string, Holiday>>();

/** Todos os feriados nacionais (e pontos facultativos) de um ano, indexados por AAAA-MM-DD. */
export function holidaysOfYear(year: number): Map<string, Holiday> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map = new Map<string, Holiday>();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fixed = (month: number, day: number, name: string) => map.set(`${year}-${pad(month)}-${pad(day)}`, { name, kind: "feriado" });

  fixed(1, 1, "Confraternização Universal");
  fixed(4, 21, "Tiradentes");
  fixed(5, 1, "Dia do Trabalho");
  fixed(9, 7, "Independência do Brasil");
  fixed(10, 12, "Nossa Senhora Aparecida");
  fixed(11, 2, "Finados");
  fixed(11, 15, "Proclamação da República");
  // Dia da Consciência Negra virou feriado nacional a partir de 2024 (Lei 14.759/2023).
  if (year >= 2024) fixed(11, 20, "Consciência Negra");
  fixed(12, 25, "Natal");

  const easter = easterSunday(year);
  map.set(toYMD(addDays(easter, -48)), { name: "Carnaval (segunda)", kind: "facultativo" });
  map.set(toYMD(addDays(easter, -47)), { name: "Carnaval (terça)", kind: "facultativo" });
  map.set(toYMD(addDays(easter, -2)), { name: "Sexta-feira Santa", kind: "feriado" });
  map.set(toYMD(addDays(easter, 60)), { name: "Corpus Christi", kind: "facultativo" });

  cache.set(year, map);
  return map;
}

/** Feriado da data informada (AAAA-MM-DD), ou null se for um dia comum. */
export function getHoliday(ymd?: string): Holiday | null {
  if (!ymd) return null;
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(ymd);
  if (!m) return null;
  return holidaysOfYear(Number(m[1])).get(ymd) || null;
}

/** Texto curto para avisos: "Feriado: Natal" / "Ponto facultativo: Carnaval (terça)". */
export function holidayLabel(h: Holiday): string {
  return h.kind === "feriado" ? `Feriado: ${h.name}` : `Ponto facultativo: ${h.name}`;
}
