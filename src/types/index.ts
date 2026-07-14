import { Timestamp } from "firebase/firestore";

/** ---------- USUÁRIOS / PERMISSÕES ---------- */

export type ModuleKey =
  | "dashboard"
  | "clients"
  | "orders"
  | "products"
  | "financial"
  | "reports"
  | "contracts"
  | "withdrawal"
  | "settings"
  | "cashFlow"
  | "expenses"
  | "calendar";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "print"
  | "downloadPdf"
  | "sendEmail";

export type Permissions = Record<ModuleKey, Partial<Record<PermissionAction, boolean>>>;

export type UserRole = "admin" | "manager" | "seller" | "assistant";

export interface AppUser {
  id: string; // uid do Firebase Auth
  loginUsername: string; // ex: "Henrique"
  email: string; // e-mail interno vinculado (ex: henrique@diamondsect.local)
  name: string;
  role: UserRole;
  active: boolean;
  permissions: Permissions;
  createdAt?: Timestamp;
}

/** ---------- CLIENTES ---------- */

export interface Client {
  id: string;
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  birthPlace?: string;
  phone: string;
  whatsapp: string;
  email?: string;
  cep: string;
  city?: string;
  address?: string;
  neighborhood?: string;
  instagram?: string;
  motherName?: string;
  notes?: string;
  availableCredit: number;
  photoUrl?: string; // URL opcional digitada manualmente (sem upload)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** ---------- PRODUTOS / ESTOQUE ---------- */

export type ProductStatus =
  | "disponivel"
  | "reservado"
  | "em_prova"
  | "alugado"
  | "lavanderia"
  | "manutencao"
  | "indisponivel";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  em_prova: "Em prova",
  alugado: "Alugado",
  lavanderia: "Lavanderia",
  manutencao: "Manutenção",
  indisponivel: "Indisponível",
};

export interface Product {
  id: string;
  productType: string; // Tipo do produto
  category: string;
  subcategory?: string;
  name: string;
  internalCode: string;
  barcode?: string;
  qrCode?: string;
  brand?: string;
  color?: string;
  size?: string;
  gender?: string;
  material?: string;
  supplier?: string;
  costValue: number;
  rentValue: number;
  saleValue: number;
  purchaseDate?: string;
  notes?: string;
  photoUrl?: string; // URL opcional (sem upload)

  /** Componentes internos do produto (ex.: Paletó, Calça, Colete de um
   * terno). Genérico — qualquer produto pode ter, não só ternos. Vazio ou
   * ausente = produto sem componentes, funciona como sempre funcionou.
   * A disponibilidade de cada componente é calculada por período (mesma
   * lógica de conflito de datas), não por um contador fixo separado. */
  componentNames?: string[];

  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  fittingQuantity: number; // em prova
  rentedQuantity: number;
  laundryQuantity: number;
  maintenanceQuantity: number;
  unavailableQuantity: number;

  status: ProductStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** ---------- PEDIDOS ---------- */

export type OrderType = "venda" | "locacao";

export type OrderStatus =
  | "orcamento"
  | "confirmado"
  | "em_prova"
  | "ajuste_andamento"
  | "pronto_retirada"
  | "retirado"
  | "devolvido"
  | "finalizado"
  | "cancelado";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  orcamento: "Orçamento",
  confirmado: "Confirmado",
  em_prova: "Em prova",
  ajuste_andamento: "Ajuste em andamento",
  pronto_retirada: "Pronto para retirada",
  retirado: "Retirado",
  devolvido: "Devolvido",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/** Status disponíveis no seletor comum de "andamento do pedido". Não inclui
 * "cancelado" de propósito — cancelar exige aprovação de admin/gerente pelo
 * fluxo dedicado (menu do pedido), não pelo seletor rápido de status. */
export const CHANGEABLE_ORDER_STATUSES = Object.entries(ORDER_STATUS_LABELS).filter(
  ([key]) => key !== "cancelado"
) as [OrderStatus, string][];

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "credito"
  | "debito"
  | "credito_cliente";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  credito_cliente: "Crédito do cliente",
};

export type ClientCategory = "noivo" | "padrinho_madrinha" | "debutante" | "convidado";

export const CLIENT_CATEGORY_LABELS: Record<ClientCategory, string> = {
  noivo: "Noivo(a)",
  padrinho_madrinha: "Padrinho/Madrinha",
  debutante: "Debutante",
  convidado: "Convidado(a)",
};

export interface OrderItem {
  productId: string;
  productName: string;
  internalCode: string;
  quantity: number;
  unitValue: number; // rentValue ou saleValue conforme o tipo do pedido
  /** Só relevante se o produto tiver componentNames. Quais componentes
   * foram locados nessa linha (ex.: ["Paletó","Colete"]). Pedidos antigos
   * sem esse campo, num produto com componentes, são tratados como se
   * tivessem selecionado o conjunto completo (compatibilidade). */
  components?: string[];
}

export interface Order {
  id: string;
  orderNumber: string; // DS-000001
  clientId: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  type: OrderType;
  items: OrderItem[];

  clientCategory: ClientCategory;
  clientCategoryNotes?: string; // uso interno — nunca aparece no contrato

  orderDate: string;
  eventDate?: string;
  fittingDate?: string;
  fittingTime?: string;
  fittingNotes?: string;
  pickupDate?: string;
  returnDate?: string;

  discount: number;
  surcharge: number;
  creditUsed: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  cardBrand?: string;

  totalValue: number; // soma dos itens
  openValue: number; // total - desconto + acréscimo - crédito usado - pago

  orderDetails?: string; // aparece no contrato
  internalNotes?: string; // não aparece no contrato

  status: OrderStatus;
  sellerId?: string;
  sellerName?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** ---------- LOGS ---------- */

export interface LogEntry {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  module: ModuleKey | "auth" | "cashFlow" | "orders";
  recordId?: string;
  details?: string;
  createdAt?: Timestamp;
}

/** ---------- CONFIGURAÇÕES (Empresa / Contrato / Retirada) ---------- */

export interface CompanySettings {
  tradeName: string; // Nome fantasia
  legalName: string; // Razão social
  cnpj: string;
  address: string;
  phone: string;
  email: string;
}

export interface DocumentSettings {
  title: string;
  introText: string;
  clauses: string[]; // uma cláusula por item
  footer: string;
  clientSignatureLabel: string; // ex: "Nome completo + CPF"
  companySignatureLabel: string; // ex: "Razão social"
}

/** ---------- FINANCEIRO: PAGAMENTOS ---------- */

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  cardBrand?: string;
  date: string; // YYYY-MM-DD
  registeredBy: string;
  registeredByName: string;
  createdAt?: Timestamp;
}

/** ---------- DESPESAS ---------- */

export type ExpenseCategory =
  | "energia"
  | "internet"
  | "lavanderia"
  | "costureira"
  | "funcionarios"
  | "material"
  | "outras";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  energia: "Energia",
  internet: "Internet",
  lavanderia: "Lavanderia",
  costureira: "Costureira",
  funcionarios: "Funcionários",
  material: "Material",
  outras: "Outras despesas",
};

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  createdAt?: Timestamp;
}

/** ---------- CAIXA (CONTROLE DE CAIXA) ---------- */

export interface CashEntry {
  id: string;
  type: "entrada" | "saida" | "sangria";
  amount: number;
  description: string;
  userName: string;
  createdAt: string; // ISO datetime, gerado no cliente
}

export interface CashRegister {
  id: string; // data no formato YYYY-MM-DD
  date: string;
  status: "aberto" | "fechado";
  openingBalance: number;
  entries: CashEntry[];
  closingBalance?: number;
  openedBy?: string;
  openedByName?: string;
  closedBy?: string;
  closedByName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** ---------- AGENDA (eventos personalizados; provas/retiradas/devoluções
 *  vêm diretamente dos pedidos e não precisam ser duplicadas aqui) ---------- */

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
}

export type AgendaItemType = "evento" | "prova" | "retirada" | "devolucao";

export interface AgendaItem {
  type: AgendaItemType;
  date: string;
  time?: string;
  title: string;
  subtitle?: string;
  orderId?: string;
  orderNumber?: string;
  eventId?: string;
  clientId?: string;
}

