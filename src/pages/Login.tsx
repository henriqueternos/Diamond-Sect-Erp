import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DiamondMark } from "../components/DiamondMark";
import { Modal } from "../components/Modal";
import { AuthService } from "../services/AuthService";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await AuthService.login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetMsg(null);
    setResetLoading(true);
    try {
      const email = await AuthService.resetPassword(resetUsername);
      setResetMsg(`Enviamos um link de redefinição de senha para ${email}.`);
    } catch (err: any) {
      setResetError(err.message || "Não foi possível enviar o e-mail de redefinição.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 opacity-20 blur-sm">
        <DiamondMark size={420} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <DiamondMark size={56} />
          <h1 className="font-display text-4xl mt-4 text-mist-100">Diamond Sect</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-mist-500 mt-1">Sistema de Locação</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-7 space-y-4">
          <div>
            <label>Usuário</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            className="text-xs text-mist-500 hover:text-diamond w-full text-center"
            onClick={() => {
              setResetUsername(username);
              setResetMsg(null);
              setResetError(null);
              setResetOpen(true);
            }}
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="text-center text-xs text-mist-700 mt-6">
          Acesso restrito. Após 5 tentativas incorretas, o login será bloqueado temporariamente.
        </p>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Redefinir senha">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label>Usuário</label>
            <input required value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} />
          </div>
          <p className="text-xs text-mist-500">Enviaremos um link de redefinição para o e-mail vinculado a esse usuário.</p>
          {resetMsg && (
            <div className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">{resetMsg}</div>
          )}
          {resetError && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{resetError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setResetOpen(false)}>
              Fechar
            </button>
            <button type="submit" className="btn-primary" disabled={resetLoading}>
              {resetLoading ? "Enviando..." : "Enviar link"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
