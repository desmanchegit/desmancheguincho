import { useState } from "react";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2, TrendingUp, ShieldCheck, Users, Star, Package,
  MapPin, Building2, UserCheck, FileText, ImageIcon, Lock,
  Loader2, ArrowLeft, Upload, ChevronRight, Search, AlertCircle,
  Info, CreditCard, Calendar,
} from "lucide-react";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

const BENEFITS = [
  { icon: TrendingUp, title: "Aumente suas vendas", desc: "Acesse milhares de clientes e oficinas buscando peças ativamente. Receba pedidos qualificados direto no seu painel." },
  { icon: ShieldCheck, title: "Credencial de confiança", desc: "O selo 'Desmanche Credenciado' aumenta a percepção de qualidade e segurança pelos compradores." },
  { icon: Users, title: "Rede nacional de compradores", desc: "Conecte-se com oficinas mecânicas, funileiros e clientes de todo o Brasil em um só lugar." },
  { icon: Star, title: "Avaliações e reputação", desc: "Construa sua reputação com avaliações reais de clientes. Quanto melhor sua nota, mais visibilidade." },
  { icon: Package, title: "Gestão de pedidos", desc: "Painel completo para gerenciar propostas, negociações e histórico de vendas com clareza." },
  { icon: Lock, title: "Pague só por negociação fechada", desc: "R$ 25 por negociação concluída, com teto de R$ 350/mês. Sem mensalidade, sem surpresa." },
];

const STEPS = [
  { icon: Building2, label: "Empresa" },
  { icon: ImageIcon, label: "Logotipo" },
  { icon: FileText, label: "Documentos" },
  { icon: Lock, label: "Acesso" },
  { icon: CreditCard, label: "Plano" },
];

const VEHICLE_SEGMENTS = [
  { id: "car",          label: "Carro",             icon: "🚗" },
  { id: "motorcycle",   label: "Moto",              icon: "🏍️" },
  { id: "truck",        label: "Caminhão",           icon: "🚛" },
  { id: "bus",          label: "Ônibus",             icon: "🚌" },
  { id: "van",          label: "Van / Utilitário",   icon: "🚐" },
  { id: "agricultural", label: "Trator / Agrícola",  icon: "🚜" },
  { id: "other",        label: "Outro",              icon: "🔧" },
];

const SITUACAO_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "Nula",     color: "bg-gray-100 text-gray-600" },
  2: { label: "Ativa",    color: "bg-green-100 text-green-700" },
  3: { label: "Suspensa", color: "bg-yellow-100 text-yellow-700" },
  4: { label: "Inapta",   color: "bg-red-100 text-red-700" },
  8: { label: "Baixada",  color: "bg-red-100 text-red-700" },
};

export default function CadastroDesmanche() {
  const { toast } = useToast();
  const { registerDesmanche } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    tradingName: "",
    cnpj: "",
    phone: "",
    naturezaJuridica: "",
    situacaoCadastral: 0,
    // Address (auto-filled from CNPJ)
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    // Responsible (auto-filled from CNPJ qsa[0])
    responsibleName: "",
    responsibleCpf: "",
    responsibleRole: "",
    // Access
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [alvaraFile, setAlvaraFile] = useState<File | null>(null);
  const [alvaraExpiry, setAlvaraExpiry] = useState("");
  const [detranExpiry, setDetranExpiry] = useState("");
  const [docResponsavelFile, setDocResponsavelFile] = useState<File | null>(null);
  const [docEmpresaFile, setDocEmpresaFile] = useState<File | null>(null);
  const [detranFile, setDetranFile] = useState<File | null>(null);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<"idle" | "found" | "error">("idle");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const formatPhone = (raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return clean;
  };

  const fetchCnpj = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    setCnpjStatus("idle");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();

      const phone = data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : "";
      const cepFormatted = data.cep ? data.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";
      const responsible = data.qsa?.[0];

      setForm((prev) => ({
        ...prev,
        companyName:      data.razao_social        || prev.companyName,
        tradingName:      data.nome_fantasia || data.razao_social || prev.tradingName,
        phone:            phone              || prev.phone,
        naturezaJuridica: data.natureza_juridica   || prev.naturezaJuridica,
        situacaoCadastral:data.situacao_cadastral  ?? prev.situacaoCadastral,
        zipCode:          cepFormatted       || prev.zipCode,
        street:           data.logradouro           || prev.street,
        number:           data.numero               || prev.number,
        complement:       data.complemento          || prev.complement,
        neighborhood:     data.bairro               || prev.neighborhood,
        city:             data.municipio            || prev.city,
        state:            data.uf                   || prev.state,
        responsibleName:  responsible?.nome_socio          || prev.responsibleName,
        responsibleRole:  responsible?.qualificacao_socio  || prev.responsibleRole,
      }));
      setCnpjStatus("found");
    } catch {
      setCnpjStatus("error");
    } finally {
      setCnpjLoading(false);
    }
  };

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          street:       data.logradouro  || "",
          neighborhood: data.bairro      || "",
          city:         data.localidade  || "",
          state:        data.uf          || "",
        }));
      }
    } catch {}
  };

  const uploadFile = async (file: File, token: string): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error("Falha no upload do arquivo");
    return (await res.json()).url;
  };

  const registerDocument = async (desmancheId: string, type: string, name: string, url: string, token: string, validUntil?: number) => {
    const body: Record<string, unknown> = { desmancheId, type, name, url };
    if (validUntil) body.validUntil = validUntil;
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Falha ao registrar documento");
  };

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (!alvaraFile || !docResponsavelFile || !docEmpresaFile || !detranFile) {
      toast({ title: "Envie todos os 4 documentos obrigatórios", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await registerDesmanche({
        companyName:     form.companyName,
        tradingName:     form.tradingName,
        cnpj:            form.cnpj,
        email:           form.email,
        phone:           form.phone,
        password:        form.password,
        plan:            "monthly",
        responsibleName: form.responsibleName,
        responsibleCpf:  form.responsibleCpf,
      });

      const token = localStorage.getItem("peca_rapida_token") as string;
      const desmancheId = (user as any)?.id as string;

      if (form.zipCode) {
        await fetch("/api/desmanches/me/address", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            zipCode:    form.zipCode,
            street:     form.street,
            number:     form.number,
            complement: form.complement,
            city:       form.city,
            state:      form.state,
          }),
        });
      }

      if (logoFile) {
        const logoUrl = await uploadFile(logoFile, token);
        await fetch("/api/desmanches/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ logo: logoUrl }),
        });
      }

      if (selectedVehicleTypes.length > 0) {
        await fetch("/api/desmanches/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ vehicleTypes: selectedVehicleTypes }),
        });
      }

      const toTs = (dateStr: string) => dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : undefined;
      const docs = [
        { file: alvaraFile!,        type: "alvara",                 name: "Alvará de Funcionamento",               validUntil: toTs(alvaraExpiry) },
        { file: docResponsavelFile!, type: "documento_responsavel",  name: "Documento do Responsável",              validUntil: undefined },
        { file: docEmpresaFile!,     type: "documento_empresa",      name: "Documento da Empresa / Contrato Social", validUntil: undefined },
        { file: detranFile!,         type: "credenciamento_detran",  name: "Credenciamento Detran",                 validUntil: toTs(detranExpiry) },
      ];
      for (const doc of docs) {
        const url = await uploadFile(doc.file, token);
        await registerDocument(desmancheId, doc.type, doc.name, url, token, doc.validUntil);
      }

      // Configura cobrança como por transação (único modelo disponível)
      try {
        const billingToken = localStorage.getItem("peka_rapida_token") as string;
        await fetch("/api/billing/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${billingToken}` },
          body: JSON.stringify({ billingModel: "per_transaction" }),
        });
      } catch {
        // Não-crítico: pode ser configurado posteriormente
      }
      toast({ title: "Cadastro realizado!", description: "Seu cadastro foi enviado para aprovação. Você já pode acessar seu painel." });
      navigate("/desmanche");
    } catch (err: any) {
      toast({ title: "Erro no cadastro", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVehicleType = (id: string) => {
    setSelectedVehicleTypes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const canAdvance = () => {
    if (step === 0) return !!(form.companyName && form.tradingName && form.cnpj && form.phone && selectedVehicleTypes.length > 0);
    if (step === 1) return true;
    if (step === 2) return !!(alvaraFile && alvaraExpiry && docResponsavelFile && docEmpresaFile && detranFile && detranExpiry);
    if (step === 3) return !!(form.email && form.password && form.confirmPassword && form.password === form.confirmPassword);
    if (step === 4) return acceptedTerms; // precisa aceitar os termos
    return false;
  };

  const situacao = form.situacaoCadastral ? SITUACAO_MAP[form.situacaoCadastral] : null;

  const FileUploadField = ({
    label, file, onChange, required = false,
  }: { label: string; file: File | null; onChange: (f: File) => void; required?: boolean }) => (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <label className="flex items-center gap-3 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        {file ? (
          <><CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /><span className="text-sm font-medium text-green-700 truncate">{file.name}</span></>
        ) : (
          <><Upload className="h-5 w-5 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground">Clique para selecionar (PDF, JPG, PNG)</span></>
        )}
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/">
            <img src={logoImg} alt="Central dos Desmanches" className="h-20 w-auto cursor-pointer" />
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Button>
          </Link>
        </div>
      </nav>

      <div className="bg-gradient-to-b from-foreground to-foreground/90 text-background py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <Badge className="mb-4 bg-primary text-primary-foreground">Apenas Empresas Credenciadas</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Cadastre seu desmanche e<br />
            <span className="text-primary">aumente suas vendas</span>
          </h1>
          <p className="text-lg text-background/70 mb-8">
            Junte-se à maior rede de desmanches do Brasil. Pague R$ 25 por negociação concluída, com teto de R$ 350/mês.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="border-muted">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0"><b.icon className="h-5 w-5 text-primary" /></div>
                  <div><h3 className="font-semibold mb-1">{b.title}</h3><p className="text-sm text-muted-foreground">{b.desc}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Formulário de Credenciamento</h2>
            <p className="text-muted-foreground">Preencha todos os dados para enviar seu cadastro para análise.</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute inset-y-1/2 left-0 right-0 h-0.5 bg-muted -z-0" />
            {STEPS.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-8 space-y-5">

              {/* ── STEP 0: Empresa (CNPJ auto-fill tudo) ─── */}
              {step === 0 && (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> Dados da Empresa
                  </h3>

                  {/* CNPJ */}
                  <div className="space-y-2">
                    <Label>CNPJ <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input
                        placeholder="00.000.000/0000-00"
                        value={form.cnpj}
                        onChange={(e) => {
                          set("cnpj", e.target.value);
                          setCnpjStatus("idle");
                          fetchCnpj(e.target.value);
                        }}
                        className="pr-10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cnpjLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {!cnpjLoading && cnpjStatus === "found" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {!cnpjLoading && cnpjStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                        {!cnpjLoading && cnpjStatus === "idle" && <Search className="h-4 w-4 text-muted-foreground/40" />}
                      </div>
                    </div>
                    {cnpjStatus === "found" && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Dados preenchidos automaticamente pela Receita Federal
                      </p>
                    )}
                    {cnpjStatus === "error" && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> CNPJ não encontrado na Receita Federal. Preencha manualmente.
                      </p>
                    )}
                  </div>

                  {/* Situação Cadastral */}
                  {situacao && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">Situação Receita Federal:</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${situacao.color}`}>{situacao.label}</span>
                      {form.naturezaJuridica && (
                        <span className="text-xs text-muted-foreground ml-auto">{form.naturezaJuridica}</span>
                      )}
                    </div>
                  )}

                  {/* Razão Social */}
                  <div className="space-y-2">
                    <Label>Razão Social <span className="text-destructive">*</span></Label>
                    <Input placeholder="Nome jurídico da empresa" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
                  </div>

                  {/* Nome Fantasia */}
                  <div className="space-y-2">
                    <Label>Nome Fantasia <span className="text-destructive">*</span></Label>
                    <Input placeholder="Como é conhecido o seu desmanche" value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} />
                  </div>

                  {/* Telefone */}
                  <div className="space-y-2">
                    <Label>Telefone / WhatsApp <span className="text-destructive">*</span></Label>
                    <Input placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>

                  {/* Endereço */}
                  <div className="border-t pt-4 mt-2 space-y-4">
                    <h4 className="font-semibold flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4 text-primary" /> Endereço
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <Input
                          placeholder="00000-000"
                          value={form.zipCode}
                          onChange={(e) => { set("zipCode", e.target.value); fetchCep(e.target.value); }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input placeholder="Bairro" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Logradouro</Label>
                      <Input placeholder="Rua, Avenida, Estrada..." value={form.street} onChange={(e) => set("street", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input placeholder="Nº" value={form.number} onChange={(e) => set("number", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Complemento</Label>
                        <Input placeholder="Sala, Galpão..." value={form.complement} onChange={(e) => set("complement", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input placeholder="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input placeholder="UF" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
                      </div>
                    </div>
                  </div>

                  {/* Responsável Legal */}
                  <div className="border-t pt-4 mt-2 space-y-4">
                    <h4 className="font-semibold flex items-center gap-2 text-base">
                      <UserCheck className="h-4 w-4 text-primary" /> Responsável Legal
                    </h4>
                    {form.responsibleName && form.responsibleRole && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-sm">
                        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Responsável encontrado na Receita Federal:</span>
                        <span className="font-medium ml-1">{form.responsibleName}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{form.responsibleRole}</Badge>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Nome do Responsável</Label>
                      <Input placeholder="Nome completo" value={form.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF do Responsável</Label>
                      <Input placeholder="000.000.000-00" value={form.responsibleCpf} onChange={(e) => set("responsibleCpf", e.target.value)} />
                    </div>
                  </div>

                  {/* Segmentos de Atendimento */}
                  <div className="border-t pt-4 mt-2 space-y-4">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2 text-base">
                        <Package className="h-4 w-4 text-primary" /> Segmentos que Você Atende <span className="text-destructive">*</span>
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">Selecione os tipos de veículos para os quais você tem peças. Você só receberá pedidos dessas categorias.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {VEHICLE_SEGMENTS.map((seg) => {
                        const selected = selectedVehicleTypes.includes(seg.id);
                        return (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => toggleVehicleType(seg.id)}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/30"
                            }`}
                          >
                            <span className="text-lg">{seg.icon}</span>
                            {seg.label}
                            {selected && <CheckCircle2 className="h-4 w-4 ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {selectedVehicleTypes.length === 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Selecione pelo menos um segmento para continuar.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── STEP 1: Logotipo ────────────────────────── */}
              {step === 1 && (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" /> Logotipo
                  </h3>
                  <p className="text-sm text-muted-foreground">Envie o logotipo ou foto de fachada do seu desmanche. Aumenta a confiança dos compradores. (Opcional)</p>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                    <input type="file" className="hidden" accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                      }}
                    />
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo preview" className="h-32 w-32 object-contain rounded-lg mb-2" />
                      : <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    }
                    <span className="text-sm text-muted-foreground">{logoFile ? logoFile.name : "Clique para selecionar (JPG, PNG, WebP)"}</span>
                  </label>
                </>
              )}

              {/* ── STEP 2: Documentos ──────────────────────── */}
              {step === 2 && (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Documentos
                  </h3>
                  <p className="text-sm text-muted-foreground">Todos os documentos abaixo são obrigatórios para análise do credenciamento.</p>

                  {/* Alvará */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <FileUploadField label="Alvará de Funcionamento" file={alvaraFile} onChange={setAlvaraFile} required />
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Data de Vencimento do Alvará <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={alvaraExpiry}
                        onChange={(e) => setAlvaraExpiry(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  {/* Detran */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <FileUploadField label="Credenciamento Detran" file={detranFile} onChange={setDetranFile} required />
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Data de Vencimento do Credenciamento Detran <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={detranExpiry}
                        onChange={(e) => setDetranExpiry(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  <FileUploadField label="Documento do Responsável (RG ou CNH)" file={docResponsavelFile} onChange={setDocResponsavelFile} required />
                  <FileUploadField label="Documento da Empresa (Contrato Social ou CNPJ)" file={docEmpresaFile} onChange={setDocEmpresaFile} required />
                </>
              )}

              {/* ── STEP 4: Plano ───────────────────────────── */}
              {step === 4 && (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" /> Cobrança da Plataforma
                  </h3>

                  <div className="rounded-xl border-2 border-primary bg-primary/5 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-base">Por Operação</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      R$ 25,00 por negociação concluída. Ao atingir R$ 350,00 no mês, as demais operações são isentas de cobrança.
                    </p>
                  </div>
                </>
              )}

              {/* ── STEP 3: Acesso ──────────────────────────── */}
              {step === 3 && (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" /> Dados de Acesso
                  </h3>
                  <div className="space-y-2">
                    <Label>E-mail <span className="text-destructive">*</span></Label>
                    <Input type="email" placeholder="contato@seudesmanche.com.br" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder="Repita a senha" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-xs text-destructive">Senhas não conferem</p>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                    <p className="text-sm font-medium">Resumo do cadastro</p>
                    <p className="text-sm text-muted-foreground">{form.tradingName} — {form.cnpj}</p>
                    {form.street && <p className="text-sm text-muted-foreground">{form.street}{form.number ? `, ${form.number}` : ""} — {form.city}/{form.state}</p>}
                    {form.responsibleName && <p className="text-sm text-muted-foreground">Responsável: {form.responsibleName}</p>}
                  </div>
                </>
              )}

              {/* Aceite de termos — só mostra no passo final */}
              {step === 4 && (
                <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3 mt-2">
                  <input
                    id="accept-terms-desmanche"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer"
                    data-testid="checkbox-accept-terms-desmanche"
                  />
                  <label htmlFor="accept-terms-desmanche" className="text-sm text-slate-600 cursor-pointer leading-snug">
                    Li e aceito a{" "}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowPrivacy(true); }}
                    >
                      Política de Privacidade e Termos de Uso
                    </button>{" "}
                    da Central dos Desmanches.{" "}
                    <span className="text-destructive">*</span>
                  </label>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
                  Voltar
                </Button>
                {step < 3 && (
                  <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()} className="gap-1">
                    Continuar <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={() => setStep(4)} disabled={!canAdvance()} className="gap-1">
                    Escolher Plano <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {step === 4 && (
                  <Button onClick={handleSubmit} disabled={isSubmitting || !canAdvance()} className="gap-2">
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                      : <><CheckCircle2 className="h-4 w-4" /> Enviar Cadastro</>
                    }
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem cadastro?{" "}
            <Link href="/" className="text-primary hover:underline font-medium">
              Entrar na plataforma
            </Link>
          </p>
        </div>
      </div>
      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
}
