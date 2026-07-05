import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getSecondaryAuth } from "../firebase/secondaryAuth";
import { AppUser, ModuleKey, PermissionAction, Permissions, UserRole } from "../types";
import { LogService } from "./LogService";

const usersCol = collection(db, "users");

export const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "clients",
  "orders",
  "products",
  "financial",
  "reports",
  "contracts",
  "withdrawal",
  "settings",
  "cashFlow",
  "expenses",
  "calendar",
];

export const ALL_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "print", "downloadPdf", "sendEmail"];

export function emptyPermissions(): Permissions {
  const perms = {} as Permissions;
  ALL_MODULES.forEach((m) => {
    perms[m] = {};
  });
  return perms;
}

/** Permissões padrão sugeridas para um vendedor: opera o dia a dia, mas não
 * mexe em configurações nem exclui pedidos. */
export function defaultSellerPermissions(): Permissions {
  const perms = emptyPermissions();
  (["dashboard", "clients", "orders", "products", "calendar"] as ModuleKey[]).forEach((m) => {
    perms[m] = { view: true, create: true, edit: true, print: true, downloadPdf: true, sendEmail: true };
  });
  perms.financial = { view: true };
  perms.reports = { view: true };
  return perms;
}

export const EmployeeService = {
  subscribeAll(callback: (users: AppUser[]) => void) {
    const q = query(usersCol, orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AppUser[]);
    });
  },

  /** Cria a conta no Authentication (via app secundário) e o perfil no Firestore. */
  async create(
    data: { loginUsername: string; email: string; password: string; name: string; role: UserRole; permissions: Permissions },
    admin: { id: string; name: string }
  ) {
    const secondaryAuth = getSecondaryAuth();
    const credential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
    const uid = credential.user.uid;
    await signOut(secondaryAuth); // não deixa a sessão secundária pendurada

    await setDoc(doc(db, "users", uid), {
      loginUsername: data.loginUsername,
      email: data.email,
      name: data.name,
      role: data.role,
      active: true,
      permissions: data.permissions,
      createdAt: serverTimestamp(),
    });

    await LogService.record({
      userId: admin.id,
      userName: admin.name,
      action: "funcionario_criado",
      module: "settings",
      recordId: uid,
      details: `Funcionário ${data.name} (${data.loginUsername}) criado`,
    });

    return uid;
  },

  async updatePermissions(uid: string, permissions: Permissions, admin: { id: string; name: string }) {
    await updateDoc(doc(db, "users", uid), { permissions });
    await LogService.record({
      userId: admin.id,
      userName: admin.name,
      action: "permissoes_alteradas",
      module: "settings",
      recordId: uid,
    });
  },

  async setActive(uid: string, active: boolean, admin: { id: string; name: string }) {
    await updateDoc(doc(db, "users", uid), { active });
    await LogService.record({
      userId: admin.id,
      userName: admin.name,
      action: active ? "funcionario_ativado" : "funcionario_desativado",
      module: "settings",
      recordId: uid,
    });
  },

  async updateBasicInfo(uid: string, data: { name: string; role: UserRole }) {
    await updateDoc(doc(db, "users", uid), data);
  },
};
