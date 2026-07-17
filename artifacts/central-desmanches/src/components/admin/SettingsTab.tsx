import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Settings, Clock, DollarSign, AlertTriangle,
  Zap, CheckCircle2, Eye, EyeOff, ExternalLink, ShieldAlert,
} from "lucide-react";

interface SystemSettings {
  reviewDeadlineDays: string;
  maxOverdueBeforeBlock: string;
  perTransactionAmount: string;
  monthlyCapAmount: string;
  licenseAlertDays: string;
  staleNegotiationDays: string;
  asaasApiKey?: string;
  asaasEnvironment?: string;
}

export default function SettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SystemSettings>({
    reviewDeadlineDays: "10",
    maxOverdueBeforeBlock: "1",
    perTransactionAmount: "25",
    monthlyCapAmount: "200",
    licenseAlertDays: "30",
    staleNegotiationDays: "30",
    asaasApiKey: "",
    asaasEnvironment: "sandbox",
  });
  const [showKey, setShowKey] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) setForm(prev => ({ ...prev, ...settings }));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: SystemSettings) => {
      const res = await apiRequest("PATCH", "/api/admin/settings", data);
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/admin/settings"], data);
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar configurações", variant: "destructive" }),
  });

  const f = (key: keyof SystemSettings) => ({
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const hasAsaasKey = !!(form.asaasApiKey && form.asaasApiKey.length > 0);
  const maskedKey = hasAsaasKey && !showKey
    ? form.asaasApiKey!.slice(0, 6) + "••••••••••••••••" + form.asaasApiKey!.slice(-4)
    : form.asaasApiKey;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Configurações do Sistema</h1>
        <p className="text-slate-500 mt-1">Ajuste os parâmetros de cobrança, avaliação e integrações externas.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Asaas Integration ─────────────────────────────── */}
          <Card data-tour="admin-settings-asaas" className="border-blue-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" /> Integração Asaas
                {hasAsaasKey ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 ml-1">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 ml-1">
                    Não configurado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Gateway de pagamentos para cobranças automáticas via PIX e boleto.
                {" "}
                <a
                  href="https://www.asaas.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  Criar conta Asaas <ExternalLink className="h-3 w-3" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label>Chave de API Asaas</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder="$aact_... ou $aasp_..."
                        value={showKey ? (form.asaasApiKey ?? "") : (maskedKey ?? "")}
                        onChange={(e) => setForm(p => ({ ...p, asaasApiKey: e.target.value }))}
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Encontre sua chave em: Minha Conta → Integrações → Chave de API.
                    Prefixo <code className="bg-slate-100 px-1 rounded">$aact_</code> para sandbox,{" "}
                    <code className="bg-slate-100 px-1 rounded">$aasp_</code> para produção.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Ambiente</Label>
                  <div className="flex gap-3">
                    {(["sandbox", "production"] as const).map((env) => (
                      <label
                        key={env}
                        className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.asaasEnvironment === env
                            ? env === "production"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="asaasEnvironment"
                          value={env}
                          checked={form.asaasEnvironment === env}
                          onChange={() => setForm(p => ({ ...p, asaasEnvironment: env }))}
                          className="sr-only"
                        />
                        {env === "sandbox" ? "Sandbox (testes)" : "Produção (real)"}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Use Sandbox para testar antes de cobrar de verdade.
                  </p>
                </div>
              </div>

              {!hasAsaasKey && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Sem a chave Asaas, as cobranças são registradas no sistema mas <strong>não geram cobrança real</strong>.
                    Configure a chave para ativar PIX e boleto automáticos.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── License Alert ──────────────────────────────────── */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" /> Alerta de Vencimento de Licença
              </CardTitle>
              <CardDescription>
                Quantos dias antes do vencimento o sistema alerta o desmanche e o admin sobre a licença do Detran.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Dias antes do vencimento para disparar alerta</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={365} {...f("licenseAlertDays")} className="max-w-[120px]" />
                  <span className="text-sm text-slate-500">dias</span>
                </div>
                <p className="text-xs text-slate-400">
                  O desmanche verá um aviso no painel e o admin receberá a lista de licenças próximas do vencimento.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Stale Negotiations ──────────────────────────────── */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Negociações Paradas
              </CardTitle>
              <CardDescription>
                Quantos dias de inatividade até o sistema perguntar ao desmanche o que aconteceu com a negociação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Dias de inatividade para iniciar verificação</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={365} {...f("staleNegotiationDays")} className="max-w-[120px]" />
                  <span className="text-sm text-slate-500">dias</span>
                </div>
                <p className="text-xs text-slate-400">
                  Negociações em &quot;Negociando&quot; sem atualização por este período serão sinalizadas para verificação.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Review Gate + Billing ──────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="font-mono text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" /> Gate de Avaliação
                </CardTitle>
                <CardDescription>
                  Regras para que clientes e desmanches avaliem negociações concluídas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Dias para avaliar após recebimento</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={90} {...f("reviewDeadlineDays")} className="max-w-[120px]" />
                    <span className="text-sm text-slate-500">dias</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    O prazo começa quando o cliente confirma o recebimento da peça.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Avaliações atrasadas para bloquear</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={10} {...f("maxOverdueBeforeBlock")} className="max-w-[120px]" />
                    <span className="text-sm text-slate-500">avaliação(ões)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Quantas avaliações atrasadas bloqueiam novos pedidos / propostas.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Se o prazo vencer sem avaliação, a negociação é automaticamente concluída.
                    O bloqueio só ocorre quando o prazo vence sem avaliação.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="font-mono text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" /> Cobrança por Transação
                </CardTitle>
                <CardDescription>
                  Valores para o modelo de pagamento avulso dos desmanches.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Valor por transação</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">R$</span>
                    <Input type="number" min={1} step={0.01} {...f("perTransactionAmount")} className="max-w-[120px]" />
                  </div>
                  <p className="text-xs text-slate-400">
                    Cobrado a cada negociação concluída e avaliada.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Teto mensal</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">R$</span>
                    <Input type="number" min={1} step={0.01} {...f("monthlyCapAmount")} className="max-w-[120px]" />
                  </div>
                  <p className="text-xs text-slate-400">
                    A partir deste valor pago no mês, as transações ficam isentas.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-700">
                  Com os valores atuais: após{" "}
                  <strong>
                    {Math.ceil(
                      parseFloat(form.monthlyCapAmount || "200") /
                      parseFloat(form.perTransactionAmount || "25")
                    )} transações
                  </strong>{" "}
                  no mês, o desmanche não paga mais nada.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending || isLoading}
          className="gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
