import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { AppUser, Permissions } from "../types";
import { LogService } from "./LogService";

const usersCol = collection(db, "users");

const LOCKOUT_KEY_PREFIX = "ds_login_attempts_";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
}

function readLockout(username: string): LockoutState {
  const raw = localStorage.getItem(LOCKOUT_KEY_PREFIX + username.toLowerCase());
  if (!raw) return { attempts: 0, lockedUntil: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function writeLockout(username: string, state: LockoutState) {
  localStorage.setItem(
    LOCKOUT_KEY_PREFIX + username.toLowerCase(),
    JSON.stringify(state)
  );
}

export const AuthService = {
  /** Permite login digitando apenas o "usuário" (ex: Henrique). Internamente
   *  buscamos no Firestore qual e-mail está vinculado a esse login. */
  async findEmailByUsername(username: string): Promise<string | null> {
    const q = query(
      usersCol,
      where("loginUsername", "==", username.trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data() as AppUser;
    return data.email ?? null;
  },

  isLockedOut(username: string): { locked: boolean; minutesLeft?: number } {
    const state = readLockout(username);
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      return {
        locked: true,
        minutesLeft: Math.ceil((state.lockedUntil - Date.now()) / 60000),
      };
    }
    return { locked: false };
  },

  async registerFailedAttempt(username: string) {
    const state = readLockout(username);
    const attempts = state.attempts + 1;
    const next: LockoutState = { attempts, lockedUntil: null };
    if (attempts >= MAX_ATTEMPTS) {
      next.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    }
    writeLockout(username, next);
    await LogService.record({
      userId: "anonimo",
      userName: username,
      action: "login_falhou",
      module: "auth",
      details: `Tentativa ${attempts}/${MAX_ATTEMPTS}`,
    });
    return next;
  },

  clearAttempts(username: string) {
    localStorage.removeItem(LOCKOUT_KEY_PREFIX + username.toLowerCase());
  },

  async login(username: string, password: string) {
    const lock = this.isLockedOut(username);
    if (lock.locked) {
      throw new Error(
        `Conta bloqueada temporariamente. Tente novamente em ${lock.minutesLeft} minuto(s).`
      );
    }

    const email = await this.findEmailByUsername(username);
    if (!email) {
      await this.registerFailedAttempt(username);
      throw new Error("Usuário não encontrado.");
    }

    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      await this.registerFailedAttempt(username);
      throw new Error("Usuário ou senha inválidos.");
    }

    const profile = await this.getProfile(credential.user.uid);
    if (profile && profile.active === false) {
      await signOut(auth);
      await LogService.record({
        userId: credential.user.uid,
        userName: username,
        action: "login_bloqueado_inativo",
        module: "auth",
      });
      throw new Error("Este usuário está desativado. Fale com o administrador do sistema.");
    }

    this.clearAttempts(username);
    await LogService.record({
      userId: credential.user.uid,
      userName: username,
      action: "login_sucesso",
      module: "auth",
    });
    return credential.user;
  },

  /** Envia e-mail de redefinição de senha (Firebase cuida do link, sem backend próprio). */
  async resetPassword(username: string) {
    const email = await this.findEmailByUsername(username);
    if (!email) {
      throw new Error("Usuário não encontrado.");
    }
    await sendPasswordResetEmail(auth, email);
    return email;
  },

  async logout(currentUser?: AppUser | null) {
    if (currentUser) {
      await LogService.record({
        userId: currentUser.id,
        userName: currentUser.name,
        action: "logout",
        module: "auth",
      });
    }
    await signOut(auth);
  },

  onChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  async getProfile(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as AppUser;
  },

  hasPermission(
    user: AppUser | null,
    moduleKey: keyof Permissions,
    action: keyof Permissions[keyof Permissions]
  ): boolean {
    if (!user) return false;
    if (user.role === "admin") return true;
    return Boolean(user.permissions?.[moduleKey]?.[action]);
  },
};
