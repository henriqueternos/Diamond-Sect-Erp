/** Converte "AAAA-MM-DD" em Date no fuso LOCAL (meia-noite local).
 * new Date("2026-10-24") seria meia-noite em UTC, ou seja, 21h do dia
 * anterior no Brasil — e isso fazia "hoje" e "atrasado" errarem por 1 dia. */
export function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(dateStr);
}

export function isToday(dateStr?: string) {
  if (!dateStr) return false;
  return parseLocalDate(dateStr).toDateString() === new Date().toDateString();
}

export function isTomorrow(dateStr?: string) {
  if (!dateStr) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return parseLocalDate(dateStr).toDateString() === t.toDateString();
}

export function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const d = parseLocalDate(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d.getTime() < now.getTime();
}

export function isWithinDays(dateStr: string | undefined, days: number) {
  if (!dateStr) return false;
  const d = parseLocalDate(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 && diff <= days;
}

export function dateBR(v?: string) {
  if (!v) return "—";
  return v.split("-").reverse().join("/");
}

export function formatDateTimeBR(ts: any) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Data local (fuso do navegador) no formato AAAA-MM-DD. Nunca use
 * toISOString() para isso: ele converte para UTC e, à noite no Brasil
 * (depois das 21h), devolveria o dia seguinte. */
export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hoje (data local) como AAAA-MM-DD. */
export function todayYMD(): string {
  return toYMD(new Date());
}
