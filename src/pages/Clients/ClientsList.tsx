import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClientService } from "../../services/ClientService";
import { CustomerCreditService, CustomerCreditEntry } from "../../services/CustomerCreditService";
import { Client } from "../../types";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

const EMPTY_CLIENT: Omit<Client, "id"> = {
  fullName: "",
  cpf: "",
  rg: "",
  birthDate: "",
  birthPlace: "",
  phone: "",
  whatsapp: "",
  email: "",
  cep: "",
  city: "",
  address: "",
  neighborhood: "",
  instagram: "",
  motherName: "",
  notes: "",
  availableCredit: 0,
  photoUrl: "",
};

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

async function fetchAddressByCep(cep: string): Promise<{ address: string; neighborhood: string; city: string } | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error("Falha ao consultar o CEP.");
  const data = await res.json();
  if (data.erro) return null;
  return {
    address: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
  };
}

export default function ClientsList() {
  const { can, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("buscar") || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Omit<Client, "id">>(EMPTY_CLIENT);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ cpf?: boolean; cep?: boolean }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [creditHistory, setCreditHistory] = useState<CustomerCreditEntry[]>([]);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "not_found" | "error">("idle");
  const [adjustCreditOpen, setAdjustCreditOpen] = useState(false);
  const [adjustCreditAmount, setAdjustCreditAmount] = useState(0);
  const [adjustCreditReason, setAdjustCreditReason] = useState("");
  const [adjustCreditSaving, setAdjustCreditSaving] = useState(false);
  const [adjustCreditError, setAdjustCreditError] = useState<string | null>(null);

  useEffect(() => ClientService.subscribeAll(setClients), []);

  useEffect(() => {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    let cancelled = false;
    setCepStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const result = await fetchAddressByCep(digits);
        if (cancelled) return;
        if (!result) {
          setCepStatus("not_found");
          return;
        }
        setCepStatus("idle");
        setForm((f) => ({
          ...f,
          address: result.address || f.address,
          neighborhood: result.neighborhood || f.neighborhood,
          city: result.city || f.city,
        }));
      } catch {
        if (!cancelled) setCepStatus("error");
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cep]);

  useEffect(() => {
    if (!editing) {
      setCreditHistory([]);
      return;
    }
    return CustomerCreditService.subscribeForClient(editing.id, setCreditHistory);
  }, [editing]);

  const filtered = useMemo(() => ClientService.search(clients, term), [clients, term]);
  const liveEditingClient = useMemo(() => (editing ? clients.find((c) => c.id === editing.id) || editing : null), [
    clients,
    editing,
  ]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_CLIENT);
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    const { id, ...rest } = c;
    setForm(rest);
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const errors: { cpf?: boolean; cep?: boolean } = {};
    if (!form.cpf.trim()) errors.cpf = true;
    if (!form.cep.trim()) errors.cep = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("CPF e CEP são obrigatórios. Preencha os campos marcados em vermelho para continuar.");
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        // O crédito não vai junto aqui de propósito: ele só muda através do
        // botão "Ajustar" (que registra no histórico). Se ele fosse reenviado
        // com o valor antigo do formulário, salvar qualquer outro campo
        // desfaria silenciosamente um ajuste de crédito feito durante a
        // mesma edição.
        const { availableCredit, ...rest } = form;
        await ClientService.update(editing.id, rest);
      } else {
        await ClientService.create(form);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    await ClientService.remove(toDelete.id);
    setToDelete(null);
  }

  async function handleAdjustCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || adjustCreditAmount === 0) return;
    setAdjustCreditSaving(true);
    setAdjustCreditError(null);
    try {
      await CustomerCreditService.adjust(
        editing.id,
        adjustCreditAmount,
        adjustCreditReason.trim() || "Ajuste manual",
        { id: user!.id, name: user!.name }
      );
      setAdjustCreditOpen(false);
      setAdjustCreditAmount(0);
      setAdjustCreditReason("");
    } catch (err: any) {
      setAdjustCreditError(err.message || "Erro ao ajustar crédito.");
    } finally {
      setAdjustCreditSaving(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if ((key === "cpf" || key === "cep") && String(value).trim()) {
      setFieldErrors((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Clientes</h1>
          <p className="text-sm text-mist-500">{clients.length} cadastrados</p>
        </div>
        {can("clients", "create") && (
          <button className="btn-primary" onClick={openCreate}>
            + Novo cliente
          </button>
        )}
      </div>

      <input
        className="max-w-md"
        placeholder="Buscar por nome, CPF, telefone, e-mail ou cidade..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>Cidade</th>
              <th>Crédito</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="text-mist-100 font-medium">{c.fullName}</td>
                <td>{c.cpf}</td>
                <td>{c.phone}</td>
                <td>{c.city || "—"}</td>
                <td>{(c.availableCredit || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td className="flex gap-2 justify-end">
                  {c.whatsapp && (
                    <a
                      className="btn-ghost !px-2 !py-1 text-xs"
                      href={`https://wa.me/55${onlyDigits(c.whatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                    >
                      WhatsApp
                    </a>
                  )}
                  {can("clients", "edit") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(c)}>
                      Editar
                    </button>
                  )}
                  {can("clients", "delete") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => setToDelete(c)}>
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-mist-500 py-8">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label>Nome completo *</label>
            <input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
          </div>
          <div>
            <label>CPF *</label>
            <input
              required
              value={form.cpf}
              onChange={(e) => update("cpf", e.target.value)}
              className={fieldErrors.cpf ? "!border-danger !ring-1 !ring-danger" : ""}
            />
            {fieldErrors.cpf && <p className="text-[11px] text-danger mt-1">CPF é obrigatório.</p>}
          </div>
          <div>
            <label>RG</label>
            <input value={form.rg} onChange={(e) => update("rg", e.target.value)} />
          </div>
          <div>
            <label>Data de nascimento</label>
            <input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
          </div>
          <div>
            <label>Local de nascimento</label>
            <input value={form.birthPlace} onChange={(e) => update("birthPlace", e.target.value)} />
          </div>
          <div>
            <label>Telefone *</label>
            <input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label>WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="DDD + número" />
          </div>
          <div>
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label>Instagram</label>
            <input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
          </div>
          <div>
            <label>CEP *</label>
            <input
              required
              value={form.cep}
              onChange={(e) => update("cep", e.target.value)}
              className={fieldErrors.cep ? "!border-danger !ring-1 !ring-danger" : ""}
            />
            {fieldErrors.cep && <p className="text-[11px] text-danger mt-1">CEP é obrigatório.</p>}
            {cepStatus === "loading" && <p className="text-[11px] text-mist-500 mt-1">Buscando endereço...</p>}
            {cepStatus === "not_found" && <p className="text-[11px] text-warn mt-1">CEP não encontrado — preencha o endereço manualmente.</p>}
            {cepStatus === "error" && <p className="text-[11px] text-warn mt-1">Não foi possível consultar o CEP agora — preencha manualmente.</p>}
          </div>
          <div>
            <label>Cidade</label>
            <input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div>
            <label>Bairro</label>
            <input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label>Endereço</label>
            <input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div>
            <label>Nome da mãe</label>
            <input value={form.motherName} onChange={(e) => update("motherName", e.target.value)} />
          </div>
          <div>
            <label>Crédito disponível (R$)</label>
            {editing ? (
              <div className="flex items-center gap-2">
                <input type="number" value={liveEditingClient?.availableCredit ?? form.availableCredit} disabled className="opacity-60" />
                <button type="button" className="btn-secondary !py-2 shrink-0" onClick={() => setAdjustCreditOpen(true)}>
                  Ajustar
                </button>
              </div>
            ) : (
              <input
                type="number"
                step="0.01"
                value={form.availableCredit || ""}
                onChange={(e) => update("availableCredit", Number(e.target.value))}
                placeholder="0"
              />
            )}
            {editing && (
              <p className="text-[11px] text-mist-700 mt-1">
                Não editável direto — use "Ajustar" para que o motivo fique registrado no histórico de crédito.
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label>URL da foto (opcional)</label>
            <input
              value={form.photoUrl}
              onChange={(e) => update("photoUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <label>Observações</label>
            <textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>

          {editing && creditHistory.length > 0 && (
            <div className="md:col-span-2">
              <label>Histórico de crédito</label>
              <div className="card p-3 max-h-40 overflow-y-auto space-y-1.5">
                {creditHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-mist-300">
                      {h.reason} {h.orderNumber ? `(${h.orderNumber})` : ""}
                    </span>
                    <span className={h.delta >= 0 ? "text-success" : "text-danger"}>
                      {h.delta >= 0 ? "+" : ""}
                      {h.delta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <div className="md:col-span-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar cliente"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ajustar crédito (fica registrado no histórico) */}
      <Modal open={adjustCreditOpen} onClose={() => setAdjustCreditOpen(false)} title={`Ajustar crédito — ${editing?.fullName ?? ""}`}>
        <form onSubmit={handleAdjustCredit} className="space-y-4">
          <p className="text-sm text-mist-500">
            Saldo atual: {(liveEditingClient?.availableCredit ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <div>
            <label>Valor do ajuste (R$)</label>
            <input
              type="number"
              step="0.01"
              value={adjustCreditAmount || ""}
              onChange={(e) => setAdjustCreditAmount(Number(e.target.value))}
              placeholder="Positivo para conceder, negativo para remover"
            />
            <p className="text-[11px] text-mist-700 mt-1">Use valor positivo para conceder crédito, negativo para remover.</p>
          </div>
          <div>
            <label>Motivo</label>
            <input
              value={adjustCreditReason}
              onChange={(e) => setAdjustCreditReason(e.target.value)}
              placeholder="Ex: crédito de cortesia, correção de cadastro..."
            />
          </div>
          {adjustCreditError && <p className="text-sm text-danger">{adjustCreditError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAdjustCreditOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={adjustCreditSaving || adjustCreditAmount === 0}>
              {adjustCreditSaving ? "Salvando..." : "Confirmar ajuste"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir cliente"
        message={`Tem certeza que deseja excluir "${toDelete?.fullName}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
