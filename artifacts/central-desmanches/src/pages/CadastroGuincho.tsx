import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Truck, AlertCircle, ArrowLeft, CreditCard, ExternalLink, Clock } from "lucide-react";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";
import GuinchoContractModal from "@/components/guincho/GuinchoContractModal";

const GUINCHO_TOKEN_KEY = "guincho_token";

function maskCnpj(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1-$2");
}

type Step = "form" | "payment" | "success";

export default function CadastroGuincho() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [isLoading, setIsLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<"idle" | "ok" | "error">("idle");
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [acceptedContract, setAcceptedContract] = useState(false);
  const [showContract, setShowContract] = useState(false);

  const [documentType, setDocumentType] = useState<"cnpj" | "cpf">("cnpj");
  const [form, setForm] = useState({
    name: "",
    tradingName: "",
    cnpj: "",
    cpf: "",
    antt: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirmPassword: "",
    description: "",
    zipCode: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    serviceRadius: "50",
  });

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function validateCnpj(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjStatus("idle");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        setCnpjStatus("ok");
        setCnpjMsg("Não foi possível validar agora, mas pode continuar");
        return;
      }
      const data = await res.json();
      if (Number(data.situacao_cadastral) !== 2) {
        const desc = data.descricao_situacao_cadastral ?? String(data.situacao_cadastral);
        setCnpjStatus("error");
        setCnpjMsg(`CNPJ não está ATIVO na Receita Federal (situação: ${desc})`);
        return;
      }
      setCnpjStatus("ok");
      setCnpjMsg("CNPJ ativo e válido ✓");
      const razao = data.razao_social || "";
      const fantasia = data.nome_fantasia || razao;
      if (razao && !form.name) set("name", razao);
      if (fantasia && !form.tradingName) set("tradingName", fantasia);
      if (data.cep) {
        const cepClean = data.cep.replace(/\D/g, "");
        const cepFmt = cepClean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
        setForm((f) => ({
          ...f,
          zipCode: cepFmt || f.zipCode,
          street: data.logradouro || f.street,
          number: data.numero || f.number,
          neighborhood: data.bairro || f.neighborhood,
          city: data.municipio || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      setCnpjStatus("ok");
      setCnpjMsg("Não foi possível validar agora, mas pode continuar");
    } finally {
      setCnpjLoading(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Senha deve ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        name: form.name,
        tradingName: form.tradingName,
        documentType,
        cnpj: documentType === "cnpj" ? form.cnpj.replace(/\D/g, "") : undefined,
        cpf: documentType === "cpf" ? form.cpf.replace(/\D/g, "") : undefined,
        antt: form.antt || undefined,
        email: form.email,
        phone: form.phone.replace(/\D/g, ""),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        password: form.password,
        description: form.description || undefined,
        zipCode: form.zipCode.replace(/\D/g, ""),
        street: form.street,
        number: form.number || undefined,
        neighborhood: form.neighborhood || undefined,
        city: form.city,
        state: form.state,
        serviceRadius: parseInt(form.serviceRadius) || 50,
      };
      const res = await fetch("/api/guinchos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro no cadastro");
      localStorage.setItem(GUINCHO_TOKEN_KEY, data.token);
      if (data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        setStep("payment");
      } else {
        setStep("success");
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro no cadastro", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "payment") {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full space-y-6 shadow-lg">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Quase lá!</h2>
            <p className="text-muted-foreground text-sm">
              Seu cadastro foi criado. Para ativar seu anúncio na plataforma, realize o pagamento da anuidade abaixo.
            </p>
          </div>

          <div className="bg-muted/60 rounded-xl p-5 space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Anuidade Central dos Desmanches</p>
            <p className="text-4xl font-bold text-primary">R$ 80<span className="text-xl font-normal text-muted-foreground">,00</span></p>
            <p className="text-xs text-muted-foreground">válido por 12 meses · PIX, boleto ou cartão</p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => window.open(paymentUrl!, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Ir para o pagamento
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              size="lg"
              onClick={() => setStep("success")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Já realizei o pagamento
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Após a confirmação do pagamento, seu anúncio será ativado automaticamente. Isso pode levar alguns minutos após o pagamento via PIX.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep("success")}
            className="block w-full text-center text-xs text-muted-foreground underline"
          >
            Pagar depois
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-lg">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Cadastro enviado!</h2>
          <p className="text-muted-foreground">
            Seu cadastro foi recebido. Assim que o pagamento for confirmado, seu anúncio será ativado automaticamente.
          </p>
          <p className="text-sm text-muted-foreground">
            Enquanto aguarda, seu painel de guincho já está disponível para você configurar seu perfil.
          </p>
          <Button className="w-full" onClick={() => navigate("/guincho")}>
            Ir para o Painel
          </Button>
          <Link href="/" className="block text-sm text-muted-foreground underline">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <nav className="bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <img src={logoImg} alt="Central dos Desmanches" className="h-10 w-auto" />
        <div className="ml-2">
          <h1 className="text-sm font-semibold">Cadastro de Guincho</h1>
          <p className="text-xs text-muted-foreground">Anuncie seus serviços na plataforma</p>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-card border rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Cadastre seu Guincho</h2>
              <p className="text-sm text-muted-foreground">Preencha os dados para entrar na plataforma</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
            <CreditCard className="h-4 w-4 text-primary shrink-0" />
            <span>Anuidade de <strong>R$ 80,00/ano</strong> — pague ao final do cadastro via PIX, boleto ou cartão.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados da Empresa</h3>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Cadastro *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setDocumentType("cnpj"); setCnpjStatus("idle"); }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    documentType === "cnpj" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Empresa (CNPJ)
                </button>
                <button
                  type="button"
                  onClick={() => { setDocumentType("cpf"); setCnpjStatus("idle"); }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    documentType === "cpf" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Autônomo (CPF)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Guinchos autônomos sem CNPJ podem se cadastrar usando o CPF.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documentType === "cnpj" ? (
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <div className="relative">
                    <Input
                      value={form.cnpj}
                      onChange={(e) => {
                        const v = maskCnpj(e.target.value);
                        set("cnpj", v);
                        setCnpjStatus("idle");
                      }}
                      onBlur={() => validateCnpj(form.cnpj)}
                      placeholder="00.000.000/0000-00"
                      required
                    />
                    {cnpjLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {cnpjStatus === "ok" && (
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{cnpjMsg}</p>
                  )}
                  {cnpjStatus === "error" && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{cnpjMsg}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => set("cpf", maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{documentType === "cnpj" ? "Razão Social *" : "Nome Completo *"}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={documentType === "cnpj" ? "Empresa de Guincho LTDA" : "Nome completo"}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Nome Fantasia *</Label>
                <Input value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} placeholder="Guincho Rápido" required />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>ANTT / RNTRC</Label>
                <Input value={form.antt} onChange={(e) => set("antt", e.target.value)} placeholder="Número do RNTRC (opcional)" />
                <p className="text-xs text-muted-foreground">Registro Nacional de Transportadores Rodoviários de Cargas, se possuir.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição dos Serviços</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ex: Atendemos 24h, guincho plataforma e reboque simples, cobertura na Grande São Paulo..."
                rows={3}
              />
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contato</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" required />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp *</Label>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} placeholder="(11) 99999-9999" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@guincho.com.br" required />
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Localização</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CEP *</Label>
                <div className="relative">
                  <Input
                    value={form.zipCode}
                    onChange={(e) => { const v = maskCep(e.target.value); set("zipCode", v); }}
                    onBlur={() => lookupCep(form.zipCode)}
                    placeholder="00000-000"
                    required
                  />
                  {cepLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Rua *</Label>
                <Input value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="Rua Principal" required />
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
                <Label>Cidade *</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" required />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Raio de Atendimento (km)</Label>
                <Input
                  type="number"
                  min={5}
                  max={500}
                  value={form.serviceRadius}
                  onChange={(e) => set("serviceRadius", e.target.value)}
                  placeholder="50"
                />
                <p className="text-xs text-muted-foreground">Distância máxima que você atende a partir do endereço cadastrado</p>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados de Acesso</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" required />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha *</Label>
                <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder="Repita a senha" required />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3">
              <input
                id="accept-contract"
                type="checkbox"
                checked={acceptedContract}
                onChange={(e) => setAcceptedContract(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer shrink-0"
              />
              <label htmlFor="accept-contract" className="text-sm text-slate-600 cursor-pointer leading-snug">
                Li e aceito o{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowContract(true); }}
                >
                  Contrato de Prestação de Serviços de Divulgação
                </button>{" "}
                da Central dos Desmanches.
              </label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || cnpjStatus === "error" || !acceptedContract}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando cadastro...</> : "Continuar para Pagamento"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/guincho" className="underline text-primary">
                Fazer login
              </Link>
            </p>
          </form>
        </div>
      </div>
      <GuinchoContractModal open={showContract} onClose={() => setShowContract(false)} />
    </div>
  );
}
