import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { AuthService } from "../services/AuthService";
import { AppUser } from "../types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const p = await AuthService.getProfile(uid);
    // Se a conta foi desativada (mesmo com a sessão ainda válida no navegador,
    // ex.: aba deixada aberta), força a saída em vez de deixar continuar.
    if (p && p.active === false) {
      await AuthService.logout(p);
      setProfile(null);
      return;
    }
    setProfile(p);
  }

  useEffect(() => {
    const unsub = AuthService.onChange(async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile(user.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshProfile = async () => {
    if (firebaseUser) await loadProfile(firebaseUser.uid);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
