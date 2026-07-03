import { useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setMessage("A senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setMessage("As senhas não coincidem."); return; }
    setMessage("");
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(data.message || "Erro ao redefinir senha.");
      }
    } catch {
      setStatus("error");
      setMessage("Erro ao conectar. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/">
        <img src={logoImg} alt="Central dos Desmanches" className="h-20 mb-8 cursor-pointer" />
      </Link>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full space-y-4">
        {status === "success" ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-slate-800">Senha redefinida!</h2>
            <p className="text-slate-500">Sua senha foi atualizada. Agora você pode fazer login com a nova senha.</p>
            <Button asChild className="w-full">
              <Link href="/">Ir para o login</Link>
            </Button>
          </div>
        ) : !token ? (
          <div className="text-center space-y-4">
            <XCircle className="h-14 w-14 mx-auto text-red-400" />
            <h2 className="text-xl font-bold text-slate-800">Link inválido</h2>
            <p className="text-slate-500">Este link de redefinição não é válido. Solicite um novo link.</p>
            <Button asChild variant="outline" className="w-full"><Link href="/">Voltar ao início</Link></Button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <KeyRound className="h-10 w-10 mx-auto text-primary mb-3" />
              <h2 className="text-xl font-bold text-slate-800">Nova senha</h2>
              <p className="text-slate-500 text-sm mt-1">Escolha uma senha segura para sua conta.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  required
                />
              </div>
              {message && (
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 shrink-0" /> {message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={status === "loading"}>
                {status === "loading" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Redefinir senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
