import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { DiamondMark } from "../components/DiamondMark";
import { GlobalSearch } from "../components/GlobalSearch";
import { NotificationsBell } from "../components/NotificationsBell";
import { useAuth } from "../hooks/useAuth";
import { AuthService } from "../services/AuthService";

const NAV_ITEMS: { to: string; label: string; icon: string }[] = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/agenda", label: "Agenda", icon: "▦" },
  { to: "/clientes", label: "Clientes", icon: "☺" },
  { to: "/estoque", label: "Estoque", icon: "▤" },
  { to: "/pedidos", label: "Pedidos", icon: "▣" },
  { to: "/financeiro", label: "Financeiro", icon: "$" },
  { to: "/caixa", label: "Caixa", icon: "▢" },
  { to: "/despesas", label: "Despesas", icon: "▼" },
  { to: "/relatorios", label: "Relatórios", icon: "▥" },
  { to: "/lista-separacao", label: "Lista de separação", icon: "☰" },
  { to: "/configuracoes", label: "Configurações", icon: "⚙" },
  { to: "/logs", label: "Logs", icon: "▧" },
];

// Breakpoint em que o menu deixa de ser uma gaveta e passa a ficar sempre
// visível. Usamos "lg" (1024px) de propósito — em vez de "md" (768px) —
// porque celulares na horizontal costumam ficar entre 650 e 930px de
// largura, e continuar tratando essa faixa como "gaveta" evita o menu
// disputar espaço com o conteúdo justamente na orientação que mais dava
// problema.
export function MainLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await AuthService.logout(user);
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-ink-900">
      {/* Fundo escurecido atrás do menu, só quando ele está aberto como gaveta */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* O menu usa position:fixed com inset-y-0 em vez de uma altura calculada
          (h-screen / 100dvh) — assim ele fica preso à janela de verdade em
          qualquer navegador, sem depender de recálculo de altura durante a
          rolagem (que é o que travava no Safari do iPhone, na horizontal). */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          ${collapsed ? "lg:w-[76px]" : "lg:w-64"} w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
          bg-ink-800 border-r border-ink-600
          transition-transform lg:transition-[width] duration-200
        `}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-ink-600 shrink-0">
          <DiamondMark size={30} />
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="font-display text-lg leading-none text-mist-100 truncate">Diamond Sect</p>
            <p className="text-[10px] tracking-widest text-mist-500 uppercase">Locação</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overscroll-contain">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-diamond/10 text-diamond border border-diamond/30"
                    : "text-mist-500 hover:text-mist-100 hover:bg-ink-700"
                }`
              }
            >
              <span className="text-base w-4 text-center shrink-0">{item.icon}</span>
              <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-ink-600 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="btn-ghost w-full !justify-start text-xs mb-2 hidden lg:flex"
          >
            {collapsed ? "»" : "« Recolher menu"}
          </button>
          <div className={`px-1 mb-2 min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="text-sm text-mist-100 truncate">{user?.name}</p>
            <p className="text-xs text-mist-500 truncate">{user?.role === "admin" ? "Administrador" : user?.role}</p>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full text-xs">
            Sair
          </button>
        </div>
      </aside>

      {/* Deixa espaço pro menu fixo em telas grandes; no celular o menu fica
          fora da tela, então não precisa de margem nenhuma aqui. */}
      <div className={`min-h-screen flex flex-col ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"} transition-[padding] duration-200`}>
        <header className="sticky top-0 z-20 h-16 border-b border-ink-600 bg-ink-800/95 backdrop-blur flex items-center px-3 md:px-6 gap-2 md:gap-4 shrink-0">
          <button
            className="lg:hidden btn-ghost !px-2 !py-2 text-lg shrink-0"
            onClick={() => {
              setCollapsed(false);
              setMobileOpen(true);
            }}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
            <NotificationsBell />
            <div className="hidden sm:block text-xs text-mist-500">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
