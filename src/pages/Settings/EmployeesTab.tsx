import React, { useEffect, useState } from "react";
import { EmployeeService, ALL_MODULES, ALL_ACTIONS, emptyPermissions, defaultSellerPermissions } from "../../services/EmployeeService";
import { AppUser, ModuleKey, PermissionAction, Permissions, UserRole } from "../../types";
import { Modal } from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  clients: "Clientes",
  orders: "Pedidos",
  products: "Estoque",
  financial: "Financeiro",
  reports: "Relatórios",
  contracts: "Contratos",
  withdrawal: "Retirada",
  settings: "Configurações",
  cashFlow: "Caixa",
  expenses: "Despesas",
  calendar: "Agenda",
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  print: "Imprimir",
  downloadPdf: "Baixar PDF",
  sendEmail: "E-mail",
};

function PermissionMatrixTable({
  value,
  onToggle,
}: {
  value: Permissions;
  onToggle: (mod: ModuleKey, action: PermissionAction) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-shell">
        <thead>
          <tr>
            <th>Módulo</th>
            {ALL_ACTIONS.map((a) => (
              <th key={a} className="text-center">
                {ACTION_LABELS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_MODULES.map((mod) => (
            <tr key={mod}>
              <td className="text-mist-100">{MODULE_LABELS[mod]}</td>
              {ALL_ACTIONS.map((action) => (
                <td key={action} className="text-center">
                  <input
                    type="checkbox"
                    className="!w-auto"
                    checked={Boolean(value[mod]?.[action])}
                    onChange={() => onToggle(mod, action)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployeesTab() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<AppUser | null>(null);
  const [permDraft, setPermDraft] = useState<Permissions>(emptyPermissions());
  const [editOpen, setEditOpen] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("seller");
  const [editPermissions, setEditPermissions] = useState<Permissions>(defaultSellerPermissions());

  const [loginUsername, setLoginUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("seller");
  const [createPermissions, setCreatePermissions] = useState<Permissions>(defaultSellerPermissions());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => EmployeeService.subscribeAll(setEmployees), []);

  function toggleCreatePermission(mod: ModuleKey, action: PermissionAction) {
    setCreatePermissions((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] },
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await EmployeeService.create(
        {
          loginUsername,
          email,
          password,
          name,
          role,
          permissions: role === "admin" ? emptyPermissions() : createPermissions,
        },
        { id: user!.id, name: user!.name }
      );
      setCreateOpen(false);
      setLoginUsername("");
      setName("");
      setEmail("");
      setPassword("");
      setRole("seller");
      setCreatePermissions(defaultSellerPermissions());
    } catch (err: any) {
      setError(err.message || "Erro ao criar funcionário.");
    } finally {
      setSaving(false);
    }
  }

  function openPermissions(emp: AppUser) {
    setPermOpen(emp);
    setPermDraft(emp.permissions && Object.keys(emp.permissions).length ? emp.permissions : emptyPermissions());
  }

  function toggle(mod: ModuleKey, action: PermissionAction) {
    setPermDraft((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] },
    }));
  }

  async function savePermissions() {
    if (!permOpen) return;
    await EmployeeService.updatePermissions(permOpen.id, permDraft, { id: user!.id, name: user!.name });
    setPermOpen(null);
  }

  async function toggleActive(emp: AppUser) {
    await EmployeeService.setActive(emp.id, !emp.active, { id: user!.id, name: user!.name });
  }

  function openEditBasic(emp: AppUser) {
    setEditOpen(emp);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditPermissions(emp.permissions && Object.keys(emp.permissions).length ? emp.permissions : defaultSellerPermissions());
  }

  function toggleEditPermission(mod: ModuleKey, action: PermissionAction) {
    setEditPermissions((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] },
    }));
  }

  async function handleSaveBasic(e: React.FormEvent) {
    e.preventDefault();
    if (!editOpen) return;
    await EmployeeService.updateBasicInfo(editOpen.id, { name: editName, role: editRole });
    await EmployeeService.updatePermissions(
      editOpen.id,
      editRole === "admin" ? emptyPermissions() : editPermissions,
      { id: user!.id, name: user!.name }
    );
    setEditOpen(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-mist-500">{employees.length} funcionário(s) cadastrado(s)</p>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          + Novo funcionário
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Login</th>
              <th>Cargo</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="text-mist-100">{e.name}</td>
                <td>{e.loginUsername}</td>
                <td className="capitalize">{e.role === "admin" ? "Administrador" : e.role}</td>
                <td>
                  <span className={`badge ${e.active ? "bg-success/15 text-success" : "bg-ink-600 text-mist-500"}`}>
                    {e.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="flex gap-2 justify-end">
                  {e.role !== "admin" && (
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openPermissions(e)}>
                      Permissões
                    </button>
                  )}
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEditBasic(e)}>
                    Editar
                  </button>
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggleActive(e)}>
                    {e.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-mist-500 py-6">
                  Nenhum funcionário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Editar nome/cargo/permissões */}
      <Modal open={Boolean(editOpen)} onClose={() => setEditOpen(null)} title={`Editar — ${editOpen?.name ?? ""}`} wide>
        <form onSubmit={handleSaveBasic} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label>Nome completo</label>
              <input required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label>Cargo (rótulo)</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                <option value="seller">Vendedor(a)</option>
                <option value="manager">Gerente</option>
                <option value="assistant">Assistente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <p className="font-display text-lg mb-1">Permissões</p>
            {editRole === "admin" ? (
              <p className="text-xs text-mist-500">
                Administrador tem acesso total a tudo automaticamente — a matriz não se aplica a este cargo.
              </p>
            ) : (
              <PermissionMatrixTable value={editPermissions} onToggle={toggleEditPermission} />
            )}
          </div>

          <p className="text-xs text-mist-500">
            Login e e-mail não podem ser alterados por aqui (estão vinculados à conta no Firebase Authentication).
            Regra fixa: cancelar um pedido exige aprovação de administrador ou gerente, independentemente desta matriz.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      {/* Criar funcionário */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo funcionário" wide>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label>Nome completo</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Login (usado para entrar no sistema)</label>
              <input required value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Ex: Maria" />
            </div>
            <div>
              <label>E-mail interno (vinculado ao login)</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@diamondsect.local"
              />
            </div>
            <div>
              <label>Senha inicial</label>
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label>Cargo (rótulo)</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="seller">Vendedor(a)</option>
                <option value="manager">Gerente</option>
                <option value="assistant">Assistente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <p className="font-display text-lg mb-1">Permissões</p>
            {role === "admin" ? (
              <p className="text-xs text-mist-500">
                Administrador tem acesso total a tudo automaticamente — a matriz abaixo não se aplica a este cargo.
              </p>
            ) : (
              <>
                <p className="text-xs text-mist-500 mb-3">
                  Marque o que esse funcionário pode fazer em cada módulo. Já vem com uma sugestão padrão marcada —
                  ajuste como preferir antes de criar.
                </p>
                <PermissionMatrixTable value={createPermissions} onToggle={toggleCreatePermission} />
              </>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <p className="text-xs text-mist-500">
            Regra fixa do sistema: cancelar um pedido exige aprovação de administrador ou gerente, independentemente desta matriz.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Criando..." : "Criar funcionário"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Matriz de permissões (editar depois de criado) */}
      <Modal open={Boolean(permOpen)} onClose={() => setPermOpen(null)} title={`Permissões — ${permOpen?.name ?? ""}`} wide>
        <PermissionMatrixTable value={permDraft} onToggle={toggle} />
        <p className="text-xs text-mist-500 mt-3">Regra fixa do sistema: cancelar um pedido exige aprovação de administrador ou gerente, independentemente desta matriz.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setPermOpen(null)}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={savePermissions}>
            Salvar permissões
          </button>
        </div>
      </Modal>
    </div>
  );
}
