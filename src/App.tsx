import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import ClientsList from "./pages/Clients/ClientsList";
import ProductsList from "./pages/Products/ProductsList";
import OrdersList from "./pages/Orders/OrdersList";
import Settings from "./pages/Settings/Settings";
import Financial from "./pages/Financial/Financial";
import Expenses from "./pages/Expenses/Expenses";
import CashFlow from "./pages/CashFlow/CashFlow";
import CalendarPage from "./pages/Calendar/CalendarPage";
import Reports from "./pages/Reports/Reports";
import PickingList from "./pages/PickingList/PickingList";
import LogsPage from "./pages/Logs/LogsPage";

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter evita configuração extra de servidor no GitHub Pages */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="clientes"
              element={
                <ProtectedRoute requiredModule="clients">
                  <ClientsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="estoque"
              element={
                <ProtectedRoute requiredModule="products">
                  <ProductsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="pedidos"
              element={
                <ProtectedRoute requiredModule="orders">
                  <OrdersList />
                </ProtectedRoute>
              }
            />
            <Route path="configuracoes" element={<Settings />} />
            <Route
              path="financeiro"
              element={
                <ProtectedRoute requiredModule="financial">
                  <Financial />
                </ProtectedRoute>
              }
            />
            <Route
              path="despesas"
              element={
                <ProtectedRoute requiredModule="expenses">
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="caixa"
              element={
                <ProtectedRoute requiredModule="cashFlow">
                  <CashFlow />
                </ProtectedRoute>
              }
            />
            <Route
              path="agenda"
              element={
                <ProtectedRoute requiredModule="calendar">
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="relatorios"
              element={
                <ProtectedRoute requiredModule="reports">
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="lista-separacao" element={<PickingList />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
