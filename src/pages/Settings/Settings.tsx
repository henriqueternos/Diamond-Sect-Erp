import React, { useEffect, useState } from "react";
import { SettingsService } from "../../services/SettingsService";
import { CompanySettings, DocumentSettings } from "../../types";
import { useAuth } from "../../hooks/useAuth";
import EmployeesTab from "./EmployeesTab";

type Tab = "empresa" | "contrato" | "retirada" | "funcionarios";

export default function Settings() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("empresa");

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [contract, setContract] = useState<DocumentSettings | null>(null);
  const [withdrawal, setWithdrawal] = useState<DocumentSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const u1 = SettingsService.subscribeCompany(setCompany);
    const u2 = SettingsService.subscribeContract(setContract);
    const u3 = SettingsService.subscribeWithdrawal(setWithdrawal);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  function flashSaved() {
    setSavedMsg("Salvo com sucesso.");
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    await SettingsService.saveCompany(company);
    flashSaved();
  }
  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    if (!contract) return;
    await SettingsService.saveContract(contract);
    flashSaved();
  }
  async function saveWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawal) return;
    await SettingsService.saveWithdrawal(withdrawal);
    flashSaved();
  }

  if (!isAdmin) {
    return <p className="text-mist-500">Somente administradores podem acessar as configurações.</p>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Configurações</h1>
        <p className="text-sm text-mist-500">
          Esses dados alimentam automaticamente o contrato, a retirada e o pedido interno.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["empresa", "contrato", "retirada", "funcionarios"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}
            onClick={() => setTab(t)}
          >
            {t === "empresa" ? "Empresa" : t === "contrato" ? "Contrato" : t === "retirada" ? "Retirada" : "Funcionários"}
          </button>
        ))}
      </div>

      {savedMsg && <div className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">{savedMsg}</div>}

      {tab === "funcionarios" && <EmployeesTab />}


      {tab === "empresa" && company && (
        <form onSubmit={saveCompany} className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label>Nome fantasia</label>
              <input value={company.tradeName} onChange={(e) => setCompany({ ...company, tradeName: e.target.value })} />
            </div>
            <div>
              <label>Razão social</label>
              <input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} />
            </div>
            <div>
              <label>CNPJ</label>
              <input value={company.cnpj} onChange={(e) => setCompany({ ...company, cnpj: e.target.value })} />
            </div>
            <div>
              <label>Telefone</label>
              <input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label>Endereço</label>
              <input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label>E-mail</label>
              <input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Salvar dados da empresa</button>
          </div>
        </form>
      )}

      {tab === "contrato" && contract && (
        <form onSubmit={saveContract} className="card p-5 space-y-4">
          <div>
            <label>Título</label>
            <input value={contract.title} onChange={(e) => setContract({ ...contract, title: e.target.value })} />
          </div>
          <div>
            <label>Texto inicial</label>
            <textarea rows={3} value={contract.introText} onChange={(e) => setContract({ ...contract, introText: e.target.value })} />
          </div>
          <div>
            <label>Cláusulas (uma por linha)</label>
            <textarea
              rows={6}
              value={contract.clauses.join("\n")}
              onChange={(e) => setContract({ ...contract, clauses: e.target.value.split("\n").filter(Boolean) })}
            />
          </div>
          <div>
            <label>Rodapé</label>
            <input value={contract.footer} onChange={(e) => setContract({ ...contract, footer: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label>Legenda assinatura do cliente</label>
              <input
                value={contract.clientSignatureLabel}
                onChange={(e) => setContract({ ...contract, clientSignatureLabel: e.target.value })}
              />
            </div>
            <div>
              <label>Legenda assinatura da empresa</label>
              <input
                value={contract.companySignatureLabel}
                onChange={(e) => setContract({ ...contract, companySignatureLabel: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Salvar cláusulas do contrato</button>
          </div>
        </form>
      )}

      {tab === "retirada" && withdrawal && (
        <form onSubmit={saveWithdrawal} className="card p-5 space-y-4">
          <div>
            <label>Título</label>
            <input value={withdrawal.title} onChange={(e) => setWithdrawal({ ...withdrawal, title: e.target.value })} />
          </div>
          <div>
            <label>Texto inicial</label>
            <textarea rows={3} value={withdrawal.introText} onChange={(e) => setWithdrawal({ ...withdrawal, introText: e.target.value })} />
          </div>
          <div>
            <label>Cláusulas (uma por linha)</label>
            <textarea
              rows={6}
              value={withdrawal.clauses.join("\n")}
              onChange={(e) => setWithdrawal({ ...withdrawal, clauses: e.target.value.split("\n").filter(Boolean) })}
            />
          </div>
          <div>
            <label>Rodapé</label>
            <input value={withdrawal.footer} onChange={(e) => setWithdrawal({ ...withdrawal, footer: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Salvar cláusulas da retirada</button>
          </div>
        </form>
      )}
    </div>
  );
}
