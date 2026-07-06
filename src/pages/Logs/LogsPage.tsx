import React, { useEffect, useMemo, useState } from "react";
import { LogService } from "../../services/LogService";
import { LogEntry } from "../../types";
import { useAuth } from "../../hooks/useAuth";

function formatDate(ts: any) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR");
}

export default function LogsPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [term, setTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    return LogService.subscribeRecent(setLogs, 300);
  }, [isAdmin]);

  const modules = useMemo(() => [...new Set(logs.map((l) => l.module))], [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (moduleFilter && l.module !== moduleFilter) return false;
      if (term) {
        const t = term.toLowerCase();
        const haystack = [l.userName, l.action, l.details, l.recordId].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(t)) return false;
      }
      return true;
    });
  }, [logs, term, moduleFilter]);

  if (!isAdmin) {
    return <p className="text-mist-500">Somente administradores podem acessar os logs.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Logs de auditoria</h1>
        <p className="text-sm text-mist-500">Últimos {logs.length} registros — quem fez o quê, quando.</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          className="max-w-sm"
          placeholder="Buscar por usuário, ação ou detalhe..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <select className="max-w-xs" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">Todos os módulos</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Módulo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td>{formatDate(l.createdAt)}</td>
                <td>{l.userName}</td>
                <td className="capitalize">{l.action.replace(/_/g, " ")}</td>
                <td>{l.module}</td>
                <td className="text-mist-500">{l.details || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-mist-500 py-8">
                  Nenhum log encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
