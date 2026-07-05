import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { CompanySettings, DocumentSettings } from "../types";

const companyRef = doc(db, "companySettings", "main");
const contractRef = doc(db, "contractSettings", "main");
const withdrawalRef = doc(db, "withdrawalSettings", "main");

export const DEFAULT_CONTRACT_SETTINGS: DocumentSettings = {
  title: "CONTRATO DE LOCAÇÃO / VENDA",
  introText:
    "Pelo presente instrumento particular, de um lado a empresa abaixo qualificada e, de outro, o(a) cliente identificado(a), ajustam entre si o presente contrato, que se rege pelas cláusulas a seguir.",
  clauses: [
    "O(a) cliente é responsável pela guarda e conservação do(s) produto(s) durante o período de locação.",
    "Em caso de dano, perda ou atraso na devolução, será cobrado o valor correspondente conforme avaliação da empresa.",
    "A retirada e a devolução deverão respeitar as datas e horários definidos neste contrato.",
  ],
  footer: "Este documento foi gerado automaticamente pelo sistema Diamond Sect.",
  clientSignatureLabel: "Nome completo + CPF",
  companySignatureLabel: "Razão social",
};

export const DEFAULT_WITHDRAWAL_SETTINGS: DocumentSettings = {
  title: "DOCUMENTO DE RETIRADA",
  introText: "Este documento formaliza a retirada do(s) produto(s) abaixo relacionado(s) pelo(a) cliente.",
  clauses: [
    "O(a) cliente confere e aceita o(s) produto(s) no estado em que se encontram no ato da retirada.",
    "A devolução deve ocorrer na data e horário combinados, sob pena de cobrança de diária adicional.",
  ],
  footer: "Este documento foi gerado automaticamente pelo sistema Diamond Sect.",
  clientSignatureLabel: "Nome completo + CPF",
  companySignatureLabel: "Razão social",
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  tradeName: "",
  legalName: "",
  cnpj: "",
  address: "",
  phone: "",
  email: "",
};

export const SettingsService = {
  async getCompany(): Promise<CompanySettings> {
    const snap = await getDoc(companyRef);
    return snap.exists() ? ({ ...DEFAULT_COMPANY_SETTINGS, ...snap.data() } as CompanySettings) : DEFAULT_COMPANY_SETTINGS;
  },
  async saveCompany(data: CompanySettings) {
    await setDoc(companyRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },
  subscribeCompany(cb: (v: CompanySettings) => void) {
    return onSnapshot(companyRef, (snap) => {
      cb(snap.exists() ? ({ ...DEFAULT_COMPANY_SETTINGS, ...snap.data() } as CompanySettings) : DEFAULT_COMPANY_SETTINGS);
    });
  },

  async getContract(): Promise<DocumentSettings> {
    const snap = await getDoc(contractRef);
    return snap.exists() ? ({ ...DEFAULT_CONTRACT_SETTINGS, ...snap.data() } as DocumentSettings) : DEFAULT_CONTRACT_SETTINGS;
  },
  async saveContract(data: DocumentSettings) {
    await setDoc(contractRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },
  subscribeContract(cb: (v: DocumentSettings) => void) {
    return onSnapshot(contractRef, (snap) => {
      cb(snap.exists() ? ({ ...DEFAULT_CONTRACT_SETTINGS, ...snap.data() } as DocumentSettings) : DEFAULT_CONTRACT_SETTINGS);
    });
  },

  async getWithdrawal(): Promise<DocumentSettings> {
    const snap = await getDoc(withdrawalRef);
    return snap.exists()
      ? ({ ...DEFAULT_WITHDRAWAL_SETTINGS, ...snap.data() } as DocumentSettings)
      : DEFAULT_WITHDRAWAL_SETTINGS;
  },
  async saveWithdrawal(data: DocumentSettings) {
    await setDoc(withdrawalRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },
  subscribeWithdrawal(cb: (v: DocumentSettings) => void) {
    return onSnapshot(withdrawalRef, (snap) => {
      cb(
        snap.exists()
          ? ({ ...DEFAULT_WITHDRAWAL_SETTINGS, ...snap.data() } as DocumentSettings)
          : DEFAULT_WITHDRAWAL_SETTINGS
      );
    });
  },
};
