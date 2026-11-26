import React, { useEffect, useMemo, useRef, useState } from "react";
import { getHoliday, holidayLabel } from "../utils/holidays";
import { dateBR, parseLocalDate, toYMD, todayYMD } from "../utils/dates";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAY_HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const POPOVER_WIDTH = 288; // w-72

/** Outra data do pedido que vale destacar no calendário (ex.: o dia do evento). */
export interface DateMarker {
  date: string;
  label: string;
}

export interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Menor/maior data que pode ser escolhida (AAAA-MM-DD). Dias fora ficam bloqueados. */
  min?: string;
  max?: string;
  /** De onde vem o limite (ex.: "Retirada"), só para explicar ao usuário por que o dia está bloqueado. */
  minFrom?: string;
  maxFrom?: string;
  markers?: DateMarker[];
  /** Mês que o calendário abre quando o campo está vazio (ex.: o mês do evento). */
  initialMonth?: string;
  error?: string | null;
  /** Aviso que não bloqueia (ex.: intervalo estranho). */
  warning?: string | null;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
}

function isYMD(v: string | undefined): v is string {
  return Boolean(v && YMD.test(v));
}

function clamp(ymd: string, min?: string, max?: string) {
  if (isYMD(min) && ymd < min) return min;
  if (isYMD(max) && ymd > max) return max;
  return ymd;
}

/** Mês (ano + índice 0-11) que o calendário deve mostrar ao abrir. */
function startMonth(value: string, initialMonth?: string, min?: string, max?: string): { y: number; m: number } {
  const ref = isYMD(value) ? value : isYMD(initialMonth) ? initialMonth : clamp(todayYMD(), min, max);
  const d = parseLocalDate(ref);
  return { y: d.getFullYear(), m: d.getMonth() };
}

export function DateField({
  value,
  onChange,
  min,
  max,
  minFrom,
  maxFrom,
  markers,
  initialMonth,
  error,
  warning,
  placeholder = "Selecionar data",
  disabled,
  clearable,
  id,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startMonth(value, initialMonth, min, max));
  const [alignRight, setAlignRight] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const today = todayYMD();
  const valid = isYMD(value);
  const holiday = valid ? getHoliday(value) : null;

  function toggle() {
    if (disabled) return;
    if (!open) {
      setView(startMonth(value, initialMonth, min, max));
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setAlignRight(rect.left + POPOVER_WIDTH > window.innerWidth - 8);
    }
    setOpen((o) => !o);
  }

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markerMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const mk of markers || []) {
      if (!isYMD(mk.date)) continue;
      map.set(mk.date, [...(map.get(mk.date) || []), mk.label]);
    }
    return map;
  }, [markers]);

  // Células do mês: espaços em branco antes do dia 1 + um botão por dia.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toYMD(new Date(view.y, view.m, d)));
    return out;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function isBlocked(ymd: string) {
    return (isYMD(min) && ymd < min) || (isYMD(max) && ymd > max);
  }

  function blockedReason(ymd: string) {
    if (isYMD(min) && ymd < min) return `Bloqueado: antes de ${dateBR(min)}${minFrom ? ` (${minFrom})` : ""}`;
    if (isYMD(max) && ymd > max) return `Bloqueado: depois de ${dateBR(max)}${maxFrom ? ` (${maxFrom})` : ""}`;
    return "";
  }

  function pick(ymd: string) {
    if (isBlocked(ymd)) return;
    onChange(ymd);
    setOpen(false);
  }

  const buttonText = valid ? `${WEEKDAY_ABBR[parseLocalDate(value).getDay()]}, ${dateBR(value)}` : placeholder;
  const todayBlocked = isBlocked(today);
  const rangeHint =
    isYMD(min) && isYMD(max)
      ? `Dias liberados: de ${dateBR(min)}${minFrom ? ` (${minFrom})` : ""} até ${dateBR(max)}${maxFrom ? ` (${maxFrom})` : ""}.`
      : isYMD(min)
      ? `Dias liberados: a partir de ${dateBR(min)}${minFrom ? ` (${minFrom})` : ""}.`
      : isYMD(max)
      ? `Dias liberados: até ${dateBR(max)}${maxFrom ? ` (${maxFrom})` : ""}.`
      : "";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full min-w-0 flex items-center justify-between gap-2 text-left bg-ink-700 border rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? "border-danger/70" : open ? "border-diamond/70 ring-1 ring-diamond/40" : "border-ink-500 hover:border-champagne-soft"
        } ${valid ? "text-mist-100" : "text-mist-700"}`}
      >
        <span className="truncate">{buttonText}</span>
        <span aria-hidden className="text-mist-500 text-xs shrink-0">
          ▾
        </span>
      </button>

      {error && <p className="text-[11px] text-danger mt-1 leading-snug">{error}</p>}
      {!error && holiday && (
        <p className="text-[11px] text-warn mt-1 leading-snug">
          ● {holidayLabel(holiday)} — confirme se a loja funciona neste dia.
        </p>
      )}
      {!error && warning && <p className="text-[11px] text-warn mt-1 leading-snug">⚠ {warning}</p>}

      {open && (
        <div
          role="dialog"
          aria-label="Escolher data"
          className={`absolute z-30 mt-1 w-72 max-w-[calc(100vw-1.5rem)] card p-3 shadow-xl ${alignRight ? "right-0" : "left-0"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
              ‹
            </button>
            <p className="text-sm font-semibold text-mist-100">
              {MONTHS[view.m]} {view.y}
            </p>
            <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAY_HEAD.map((w, i) => (
              <span key={i} className="text-[10px] font-bold text-mist-500 py-1">
                {w}
              </span>
            ))}
            {cells.map((ymd, i) => {
              if (!ymd) return <span key={`b${i}`} />;
              const blocked = isBlocked(ymd);
              const selected = ymd === value;
              const h = getHoliday(ymd);
              const marks = markerMap.get(ymd);
              const isToday = ymd === today;
              const title = [blocked ? blockedReason(ymd) : "", h ? holidayLabel(h) : "", ...(marks || [])].filter(Boolean).join(" · ");
              let cls = "relative h-9 w-full rounded-lg text-sm flex items-center justify-center transition-colors ";
              if (blocked) cls += "text-mist-700/60 line-through cursor-not-allowed";
              else if (selected) cls += "bg-diamond text-white font-semibold";
              else if (h) cls += "text-warn font-semibold bg-warn/10 hover:bg-warn/20";
              else cls += "text-mist-100 hover:bg-champagne-dim/40";
              if (isToday && !selected) cls += " ring-1 ring-diamond/60";
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={blocked}
                  title={title || undefined}
                  aria-label={`${dateBR(ymd)}${h ? ` — ${h.name}` : ""}${blocked ? " — bloqueado" : ""}`}
                  aria-pressed={selected}
                  className={cls}
                  onClick={() => pick(ymd)}
                >
                  {Number(ymd.slice(8, 10))}
                  {marks && !selected && <span aria-hidden className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-champagne" />}
                </button>
              );
            })}
          </div>

          {rangeHint && <p className="text-[11px] text-mist-500 mt-2 leading-snug">{rangeHint}</p>}
          <div className="flex items-center gap-3 text-[10px] text-mist-500 mt-2">
            <span className="flex items-center gap-1">
              <span aria-hidden className="inline-block h-2 w-2 rounded-sm bg-warn/30" /> Feriado
            </span>
            {markers && markers.length > 0 && (
              <span className="flex items-center gap-1">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-champagne" /> Outras datas do pedido
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-ink-600/70">
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs"
              disabled={todayBlocked}
              onClick={() => pick(today)}
              title={todayBlocked ? blockedReason(today) : undefined}
            >
              Hoje
            </button>
            {clearable && valid && (
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-xs"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
