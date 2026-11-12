import React from "react";
import { Modal } from "./Modal";

/** Uma linha da lista de detalhes: de onde veio o valor + atalhos para a página original. */
export interface DrillRow {
  label: string;
  sub?: string;
  /** Aviso (ex.: divergência de valores) — aparece destacado abaixo do `sub`. */
  warning?: string;
  value: string;
  onOpen?: () => void;
  openLabel?: string;
  onOpenSecondary?: { label: string; onClick: () => void };
}

export interface DrillDown {
  title: string;
  subtitle?: string;
  rows: DrillRow[];
}

export function DrillDownModal({ drillDown, onClose }: { drillDown: DrillDown | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(drillDown)} onClose={onClose} title={drillDown?.title ?? ""} wide>
      {drillDown && (
        <div className="space-y-3">
          {drillDown.subtitle && <p className="text-xs text-mist-500">{drillDown.subtitle}</p>}
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {drillDown.rows.map((row, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 border border-ink-600 rounded-lg px-3 py-2 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="text-sm text-mist-100 truncate">{row.label}</p>
                  {row.sub && <p className="text-xs text-mist-500">{row.sub}</p>}
                  {row.warning && <p className="text-xs text-warn">⚠ {row.warning}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {row.value && <p className="font-display text-mist-100">{row.value}</p>}
                  {row.onOpen && (
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs text-diamond"
                      onClick={() => {
                        onClose();
                        row.onOpen!();
                      }}
                    >
                      {row.openLabel || "Abrir"} →
                    </button>
                  )}
                  {row.onOpenSecondary && (
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() => {
                        onClose();
                        row.onOpenSecondary!.onClick();
                      }}
                    >
                      {row.onOpenSecondary.label} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
