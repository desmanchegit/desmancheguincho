import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Info, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoginModalProps {
  children?: React.ReactNode;
  defaultOpen?: boolean;
}

function TestCredentials({ email, password }: { email: string; password: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/60 border border-border px-3 py-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
      <div>
        <span className="font-semibold text-foreground/70">Acesso de teste:</span>
        <br />
        <span className="font-mono">{email}</span>
        <br />
        <span className="font-mono">Senha: {password}</span>
      </div>
    </div>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      setSent(true);
      toast({ title: data.message });
    } catch {
      toast({ title: "Erro ao enviar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 mt-4 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
        <p className="font-semibold text-slate-800">Verifique seu e-mail!</p>
        <p className="text-sm text-slate-500">Se o endereço estiver cadastrado, você receberá as instruções de recuperação em breve.</p>
        <Button variant="ghost" className="gap-2 w-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="text-sm text-slate-500 mb-1">
        Informe o e-mail cadastrado e enviaremos as instruções para redefinir sua senha.
      </div>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Seu e-mail</Label>
        <Input
          id="forgot-email"
          type="email"
          placeholder="seu@email.com"
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          required
          data-testid="input-forgot-email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar link de recuperação"}
      </Button>
      <Button type="button" variant="ghost" className="w-full gap-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Voltar ao login
      </Button>
    </form>
  );
}

export function LoginModal({ children, defaultOpen = false }: LoginModalProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<"client" | "desmanche">("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const { login, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "client" | "desmanche");
    setEmail("");
    setPassword("");
    setShowForgot(false);
  };

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (!val) setShowForgot(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, activeTab === "desmanche" ? "desmanche" : "user");
      setOpen(false);
      if (activeTab === "desmanche") {
        navigate("/desmanche");
      } else {
        navigate("/cliente");
      }
    } catch (error) {
    }
  };

  const loginForm = (label: string, emailId: string) => (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor={emailId}>{label}</Label>
        <Input
          id={emailId}
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid={`input-${emailId}`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${emailId}-password`}>Senha</Label>
        <Input
          id={`${emailId}-password`}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          data-testid={`input-${emailId}-password`}
        />
      </div>
      <div className="text-right">
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="text-xs text-primary hover:underline"
          data-testid="link-forgot-password"
        >
          Esqueci minha senha
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
        ) : (
          `Entrar como ${activeTab === "client" ? "Cliente" : "Desmanche"}`
        )}
      </Button>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{showForgot ? "Recuperar senha" : "Entrar na plataforma"}</DialogTitle>
          <DialogDescription>
            {showForgot
              ? "Enviaremos um link de redefinição para o seu e-mail."
              : "Acesse sua conta para gerenciar pedidos e propostas."}
          </DialogDescription>
        </DialogHeader>

        {showForgot ? (
          <ForgotPasswordForm onBack={() => setShowForgot(false)} />
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Cliente</TabsTrigger>
              <TabsTrigger value="desmanche">Desmanche</TabsTrigger>
            </TabsList>

            <TabsContent value="client">
              <TestCredentials email="recriarme@gmail.com" password="debora123" />
              {loginForm("Email", "client-email")}
            </TabsContent>

            <TabsContent value="desmanche">
              <TestCredentials email="contato@irmaossilva.com" password="desmanche123" />
              {loginForm("Email do Desmanche", "desmanche-email")}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
