import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import { Truck, LogOut, User, Clock, CheckCircle2, XCircle, Loader2, Save, Phone, MapPin, AlertCircle, Camera } from "lucide-react";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

const GUINCHO_TOKEN_KEY = "guincho_token";

function getGuinchoToken(): string | null {
  return localStorage.getItem(GUINCHO_TOKEN_KEY);
}

function removeGuinchoToken() {
  localStorage.removeItem(GUINCHO_TOKEN_KEY);
}

async function guinchoRequest(method: string, url: string, data?: unknown) {
  const token = getGuinchoToken();
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return res;
}

type GuinchoUser = {
  id: string;
  name: string;
  tradingName: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  description: string | null;
  zipCode: string;
  street: string;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  serviceRadius: number;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  rejectionReason: string | null;
  type: "guincho";
};

function maskPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function GuinchoLoginPage({ onLogin }: { onLogin: (user: GuinchoUser) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/guinchos/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro no login");
      localStorage.setItem(GUINCHO_TOKEN_KEY, data.token);
      onLogin(data.user);
    } catch (err: any) {
      toast({ title: err.message || "Credenciais inválidas", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img src={logoImg} alt="Central dos Desmanches" className="h-28 w-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold flex items-center gap-2 justify-center">
              <Truck className="h-6 w-6 text-primary" />
              Painel do Guincho
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@guincho.com" required />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : "Entrar"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Não tem conta?{" "}
            <Link href="/cadastro-guincho" className="underline text-primary">Cadastrar</Link>
          </p>
        </div>
        <p className="text-center text-xs">
          <Link href="/" className="text-muted-foreground underline">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}

function StatusBanner({ status, rejectionReason }: { status: string; rejectionReason: string | null }) {
  if (status === "active") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span><strong>Perfil ativo!</strong> Seu guincho está visível no catálogo público.</span>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
        <Clock className="h-4 w-4 shrink-0 text-yellow-600" />
        <span><strong>Aguardando aprovação.</strong> Nossa equipe revisará seu cadastro em breve.</span>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
        <div>
          <strong>Cadastro não aprovado.</strong>
          {rejectionReason && <p className="mt-0.5 text-xs">{rejectionReason}</p>}
          <p className="text-xs mt-1">Entre em contato pelo suporte para mais informações.</p>
        </div>
      </div>
    );
  }
  if (status === "inactive") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Seu perfil está <strong>inativo</strong>. Entre em contato com o suporte.</span>
      </div>
    );
  }
  return null;
}

function ProfileTab({ user, onUpdate }: { user: GuinchoUser; onUpdate: (u: GuinchoUser) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onError: (err) => toast({ title: err.message || "Erro ao enviar foto", variant: "destructive" }),
  });
  const [form, setForm] = useState({
    tradingName: user.tradingName,
    phone: user.phone,
    whatsapp: user.whatsapp,
    description: user.description ?? "",
    serviceRadius: String(user.serviceRadius),
    zipCode: user.zipCode ?? "",
    street: user.street ?? "",
    number: user.number ?? "",
    neighborhood: user.neighborhood ?? "",
    city: user.city ?? "",
    state: user.state ?? "",
  });

  const set = (f: string, v: string) => setForm((prev) => ({ ...prev, [f]: v }));

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (!result) return;
    const photoUrl = `/api/storage${result.objectPath}`;
    try {
      const res = await guinchoRequest("PATCH", "/api/guinchos/me", { photoUrl });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onUpdate({ ...user, ...data });
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao salvar foto", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setForm((f) => ({
        ...f,
        street: data.logradouro || f.street,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }));
    } catch {}
    finally { setCepLoading(false); }
  }

  async function handleSave() {
    setIsLoading(true);
    try {
      const res = await guinchoRequest("PATCH", "/api/guinchos/me", {
        tradingName: form.tradingName,
        phone: form.phone.replace(/\D/g, ""),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        description: form.description || undefined,
        serviceRadius: parseInt(form.serviceRadius) || 50,
        zipCode: form.zipCode.replace(/\D/g, "") || undefined,
        street: form.street || undefined,
        number: form.number || undefined,
        neighborhood: form.neighborhood || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onUpdate({ ...user, ...data });
      toast({ title: "Perfil atualizado!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Foto do Guincho</Label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-muted border overflow-hidden flex items-center justify-center shrink-0">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.tradingName} className="w-full h-full object-cover" />
            ) : (
              <Truck className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Camera className="mr-2 h-4 w-4" />Enviar Foto</>}
            </Button>
            <p className="text-xs text-muted-foreground">Aparece no catálogo público. JPG ou PNG.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome Fantasia</Label>
          <Input value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input value={user.cnpj} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>WhatsApp</Label>
          <Input value={form.whatsapp} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={user.email} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Raio de Atendimento (km)</Label>
          <Input type="number" min={5} max={500} value={form.serviceRadius} onChange={(e) => set("serviceRadius", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição dos Serviços</Label>
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="Ex: Atendemos 24h, guincho plataforma e reboque simples..."
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Endereço</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>CEP</Label>
            <div className="relative">
              <Input
                value={maskCep(form.zipCode)}
                onChange={(e) => set("zipCode", e.target.value.replace(/\D/g, ""))}
                onBlur={() => lookupCep(form.zipCode)}
                placeholder="00000-000"
              />
              {cepLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Rua</Label>
            <Input value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="Rua Principal" />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="123" />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Centro" />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Alterações</>}
      </Button>
    </div>
  );
}

export default function GuinhoDashboard() {
  const [user, setUser] = useState<GuinchoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("status");

  useEffect(() => {
    const token = getGuinchoToken();
    if (!token) { setIsLoading(false); return; }
    guinchoRequest("GET", "/api/guinchos/me").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        removeGuinchoToken();
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  function handleLogout() {
    removeGuinchoToken();
    setUser(null);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <GuinchoLoginPage onLogin={(u) => setUser(u as GuinchoUser)} />;
  }

  const tabs = [
    { key: "status", label: "Status", icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: "profile", label: "Meu Perfil", icon: <User className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      <nav className="bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <img src={logoImg} alt="Central dos Desmanches" className="h-10 w-auto" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{user.tradingName}</p>
          <p className="text-xs text-muted-foreground">Painel do Guincho</p>
        </div>
        <Link href="/guinchos">
          <Button variant="outline" size="sm" className="hidden sm:flex">Ver Catálogo</Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10 gap-1.5">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </nav>

      <div className="max-w-3xl mx-auto p-4 py-6 space-y-5">
        <StatusBanner status={user.status} rejectionReason={user.rejectionReason} />

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5">
          {activeTab === "status" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Resumo do Perfil</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.status === "active" ? "default" : user.status === "pending" ? "secondary" : "destructive"}>
                      {user.status === "active" ? "Ativo" : user.status === "pending" ? "Aguardando" : user.status === "rejected" ? "Reprovado" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Localização</p>
                  <p className="text-sm font-medium">{user.city} – {user.state}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">WhatsApp</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium">{user.whatsapp}</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Raio de Atendimento</p>
                  <p className="text-sm font-medium">{user.serviceRadius} km</p>
                </div>
              </div>

              {user.status === "active" && (
                <div className="pt-2">
                  <Link href="/guinchos">
                    <Button variant="outline" className="w-full sm:w-auto">
                      <Truck className="mr-2 h-4 w-4" />
                      Ver meu perfil no catálogo
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Meu Perfil</h2>
              <ProfileTab user={user} onUpdate={setUser} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
