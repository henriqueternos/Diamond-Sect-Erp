import { useAuthContext } from "../contexts/AuthContext";
import { AuthService } from "../services/AuthService";
import { ModuleKey, PermissionAction } from "../types";

export function useAuth() {
  const { firebaseUser, profile, loading, refreshProfile } = useAuthContext();

  function can(moduleKey: ModuleKey, action: PermissionAction) {
    return AuthService.hasPermission(profile, moduleKey, action);
  }

  return {
    firebaseUser,
    user: profile,
    isAuthenticated: Boolean(firebaseUser && profile),
    loading,
    isAdmin: profile?.role === "admin",
    can,
    refreshProfile,
  };
}
