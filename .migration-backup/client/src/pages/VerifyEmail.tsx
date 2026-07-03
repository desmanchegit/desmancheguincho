import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

export default function VerifyEmail() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "notoken">(token ? "loading" : "notoken");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "E-mail confirmado com sucesso!");
        } else {
          setStatus("error");
          setMessage(data.message || "Link inválido ou expirado.");
        }
      } catch {
        setStatus("error");
        setMessage("Erro ao conectar. Tente novamente.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/">
        <img src={logoImg} alt="Central dos Desmanches" className="h-20 mb-8 cursor-pointer" />
      </Link>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-14 w-14 mx-auto text-primary animate-spin" />
            <h2 className="text-xl font-bold text-slate-800">Verificando seu e-mail...</h2>
            <p className="text-slate-500">Aguarde um momento.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-slate-800">E-mail confirmado!</h2>
            <p className="text-slate-500">{message}</p>
            <p className="text-slate-500">Agora você pode solicitar pedidos de peças.</p>
            <Button asChild className="mt-2 w-full">
              <Link href="/cliente">Ir para o painel</Link>
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-14 w-14 mx-auto text-red-500" />
            <h2 className="text-xl font-bold text-slate-800">Link inválido</h2>
            <p className="text-slate-500">{message}</p>
            <p className="text-slate-400 text-sm">O link pode ter expirado (validade de 24h). Faça login e solicite um novo e-mail de verificação.</p>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/">Voltar ao início</Link>
            </Button>
          </>
        )}
        {status === "notoken" && (
          <>
            <MailCheck className="h-14 w-14 mx-auto text-slate-300" />
            <h2 className="text-xl font-bold text-slate-800">Verifique seu e-mail</h2>
            <p className="text-slate-500">Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta.</p>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/">Voltar ao início</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
