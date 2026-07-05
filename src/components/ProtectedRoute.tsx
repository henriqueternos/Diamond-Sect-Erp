import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ModuleKey } from "../types";

export function ProtectedRoute({
  children,
  requiredModule,
}: {
  children: React.ReactNode;
  requiredModule?: ModuleKey;
}) {
  const { isAuthenticated, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-900 text-mist-500">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredModule && !can(requiredModule, "view")) {
    return (
      <div className="h-screen flex items-center justify-center bg-ink-900 text-mist-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  return <>{children}</>;
}
