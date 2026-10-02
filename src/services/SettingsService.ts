import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { CompanySettings, DocumentSettings, OrderType } from "../types";

const companyRef = doc(db, "companySettings", "main");
// Dois modelos de contrato independentes, cada um seu próprio documento —
// "locacao" e "venda" dentro da mesma coleção contractSettings.
const contractRef = (type: OrderType) => doc(db, "contractSettings", type);
const withdrawalRef = doc(db, "withdrawalSettings", "main");

export const DEFAULT_CONTRACT_SETTINGS_LOCACAO: DocumentSettings = {
  title: "CONTRATO DE LOCAÇÃO",
  introText:
    "Pelo presente instrumento particular, de um lado a empresa abaixo qualificada e, de outro, o(a) cliente identificado(a), ajustam entre si o presente contrato de locação, que se rege pelas cláusulas a seguir.",
  clauses: [
    "O(a) cliente é responsável pela guarda e conservação do(s) produto(s) durante o período de locação.",
    "Em caso de dano, perda ou atraso na devolução, será cobrado o valor correspondente conforme avaliação da empresa.",
    "A retirada e a devolução deverão respeitar as datas e horários definidos neste contrato.",
    "O(s) produto(s) locado(s) permanece(m) de propriedade da empresa em todo o período, devendo ser devolvido(s) ao final da locação.",
  ],
  footer: "Este documento foi gerado automaticamente pelo sistema Diamond Sect.",
  clientSignatureLabel: "Nome completo + CPF",
  companySignatureLabel: "Razão social",
};

export const DEFAULT_CONTRACT_SETTINGS_VENDA: DocumentSettings = {
  title: "CONTRATO DE COMPRA E VENDA",
  introText:
    "Pelo presente instrumento particular, de um lado a empresa abaixo qualificada, na condição de vendedora, e de outro, o(a) cliente identificado(a), na condição de compradora(a), ajustam entre si o presente contrato de compra e venda, que se rege pelas cláusulas a seguir.",
  clauses: [
    "A propriedade do(s) produto(s) é transferida ao(à) cliente mediante a quitação integral do valor acordado.",
    "O(a) cliente declara ter examinado o(s) produto(s) e aceita seu estado no ato da entrega.",
    "Trocas e devoluções seguem a política comercial vigente da empresa, informada no ato da venda.",
  ],
  footer: "Este documento foi gerado automaticamente pelo sistema Diamond Sect.",
  clientSignatureLabel: "Nome completo + CPF",
  companySignatureLabel: "Razão social",
};

// Mantido para compatibilidade com código antigo que ainda não tenha sido
// atualizado — aponta para o modelo de locação (era o único que existia).
export const DEFAULT_CONTRACT_SETTINGS = DEFAULT_CONTRACT_SETTINGS_LOCACAO;

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

  /** type: "locacao" ou "venda" — cada um tem seu próprio modelo de
   * contrato, configurado e usado separadamente. */
  async getContract(type: OrderType): Promise<DocumentSettings> {
    const defaults = type === "venda" ? DEFAULT_CONTRACT_SETTINGS_VENDA : DEFAULT_CONTRACT_SETTINGS_LOCACAO;
    const snap = await getDoc(contractRef(type));
    return snap.exists() ? ({ ...defaults, ...snap.data() } as DocumentSettings) : defaults;
  },
  async saveContract(type: OrderType, data: DocumentSettings) {
    await setDoc(contractRef(type), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },
  subscribeContract(type: OrderType, cb: (v: DocumentSettings) => void) {
    const defaults = type === "venda" ? DEFAULT_CONTRACT_SETTINGS_VENDA : DEFAULT_CONTRACT_SETTINGS_LOCACAO;
    return onSnapshot(contractRef(type), (snap) => {
      cb(snap.exists() ? ({ ...defaults, ...snap.data() } as DocumentSettings) : defaults);
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
