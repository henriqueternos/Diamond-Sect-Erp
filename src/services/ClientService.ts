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
import { Client } from "../types";

const clientsCol = collection(db, "clients");

export const ClientService = {
  /** Escuta a lista de clientes em tempo real (usado nas telas de listagem). */
  subscribeAll(callback: (clients: Client[]) => void) {
    const q = query(clientsCol, orderBy("fullName", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Client[]);
    });
  },

  async getById(id: string): Promise<Client | null> {
    const snap = await getDoc(doc(db, "clients", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as Client;
  },

  async create(data: Omit<Client, "id" | "createdAt" | "updatedAt">) {
    const ref = await addDoc(clientsCol, {
      ...data,
      availableCredit: data.availableCredit ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Client>) {
    await updateDoc(doc(db, "clients", id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string) {
    await deleteDoc(doc(db, "clients", id));
  },

  /** Filtro local — a lista completa já vem do listener em tempo real. */
  search(clients: Client[], term: string): Client[] {
    if (!term.trim()) return clients;
    const t = term.toLowerCase();
    return clients.filter((c) =>
      [c.fullName, c.cpf, c.phone, c.whatsapp, c.email, c.city]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(t))
    );
  },
};
