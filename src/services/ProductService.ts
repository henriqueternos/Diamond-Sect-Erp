import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { Product, ProductStatus } from "../types";

const productsCol = collection(db, "products");

/** Recalcula o status "resumo" do produto a partir das quantidades. */
export function computeStatus(p: Partial<Product>): ProductStatus {
  const available = p.availableQuantity ?? 0;
  if (available > 0) return "disponivel";
  if ((p.fittingQuantity ?? 0) > 0) return "em_prova";
  if ((p.rentedQuantity ?? 0) > 0) return "alugado";
  if ((p.reservedQuantity ?? 0) > 0) return "reservado";
  if ((p.laundryQuantity ?? 0) > 0) return "lavanderia";
  if ((p.maintenanceQuantity ?? 0) > 0) return "manutencao";
  return "indisponivel";
}

export const ProductService = {
  subscribeAll(callback: (products: Product[]) => void) {
    const q = query(productsCol, orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[]);
    });
  },

  async getById(id: string): Promise<Product | null> {
    const snap = await getDoc(doc(db, "products", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as Product;
  },

  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt" | "status">) {
    const total = data.totalQuantity ?? 0;
    const payload = {
      ...data,
      availableQuantity: data.availableQuantity ?? total,
      reservedQuantity: data.reservedQuantity ?? 0,
      fittingQuantity: data.fittingQuantity ?? 0,
      rentedQuantity: data.rentedQuantity ?? 0,
      laundryQuantity: data.laundryQuantity ?? 0,
      maintenanceQuantity: data.maintenanceQuantity ?? 0,
      unavailableQuantity: data.unavailableQuantity ?? 0,
    };
    const status = computeStatus(payload);
    const ref = await addDoc(productsCol, {
      ...payload,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Product>) {
    const current = await this.getById(id);
    const merged = { ...current, ...data } as Product;
    const status = computeStatus(merged);
    await updateDoc(doc(db, "products", id), {
      ...data,
      status,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string) {
    await deleteDoc(doc(db, "products", id));
  },

  /** Move `qty` unidades de uma quantidade para outra (ex.: disponível -> em prova). */
  async moveQuantity(
    id: string,
    from: keyof Pick<
      Product,
      | "availableQuantity"
      | "reservedQuantity"
      | "fittingQuantity"
      | "rentedQuantity"
      | "laundryQuantity"
      | "maintenanceQuantity"
      | "unavailableQuantity"
    >,
    to: keyof Pick<
      Product,
      | "availableQuantity"
      | "reservedQuantity"
      | "fittingQuantity"
      | "rentedQuantity"
      | "laundryQuantity"
      | "maintenanceQuantity"
      | "unavailableQuantity"
    >,
    qty: number
  ) {
    const product = await this.getById(id);
    if (!product) throw new Error("Produto não encontrado.");
    const fromQty = (product[from] as number) ?? 0;
    if (fromQty < qty) {
      throw new Error(`Quantidade insuficiente em "${from}" para mover.`);
    }
    const updated: Partial<Product> = {
      [from]: fromQty - qty,
      [to]: ((product[to] as number) ?? 0) + qty,
    } as Partial<Product>;
    await this.update(id, updated);
  },

  search(products: Product[], term: string): Product[] {
    if (!term.trim()) return products;
    const t = term.toLowerCase();
    return products.filter((p) =>
      [
        p.name,
        p.internalCode,
        p.barcode,
        p.qrCode,
        p.brand,
        p.color,
        p.category,
        p.subcategory,
        p.productType,
        p.size,
        p.gender,
        p.material,
        p.supplier,
        p.status,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(t))
    );
  },
};
