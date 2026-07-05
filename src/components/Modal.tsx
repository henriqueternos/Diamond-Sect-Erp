import React from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm py-8 px-4">
      <div
        className={`card w-full ${wide ? "max-w-4xl" : "max-w-lg"} p-6 my-auto animate-[fadeIn_.15s_ease-out]`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl text-mist-100">{title}</h2>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-lg">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-6">
        <h3 className="font-display text-xl mb-2">{title}</h3>
        <p className="text-sm text-mist-500 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
