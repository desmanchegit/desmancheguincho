import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { PackageSearch, Handshake, CheckCircle2, ArrowRight, Loader2, AlertTriangle, Send, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  negotiating: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  negotiating: "Negociando",
  shipped: "Enviado",
  delivered: "Entregue",
  completed: "Concluído",
};

export default function DesmancheOverviewTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [correctionNote, setCorrectionNote] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);

  const { data: desmanche, refetch: refetchDesmanche } = useQuery({
    queryKey: ["/api/desmanches/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanches/me");
      return res.json();
    },
  });

  const { data: negotiations = [], isLoading: loadingNeg } = useQuery({
    queryKey: ["/api/negotiations/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/negotiations/my");
      return res.json();
    },
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders?status=open");
      return res.json();
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/desmanches/me/resubmit", {
        correctionNote: correctionNote.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/desmanches/me"] });
      refetchDesmanche();
      setCorrectionNote("");
      setShowNoteField(false);
      toast({
        title: "Cadastro reenviado para análise!",
        description: "Nossa equipe irá analisar as correções em breve.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao reenviar", description: error.message, variant: "destructive" });
    },
  });

  const desmancheVehicleTypes: string[] = (() => {
    try { return JSON.parse(desmanche?.vehicleTypes || "[]"); } catch { return []; }
  })();

  const availableItemsCount = (orders as any[]).reduce((count: number, order: any) => {
    if (order.items && order.items.length > 0) {
      const open = order.items.filter((item: any) =>
        (item.status === "open" || item.status === "has_proposals") &&
        (desmancheVehicleTypes.length === 0 || !item.vehicleType || desmancheVehicleTypes.includes(item.vehicleType))
      ).length;
      return count + open;
    }
    if (desmancheVehicleTypes.length > 0 && order.vehicleType && !desmancheVehicleTypes.includes(order.vehicleType)) {
      return count;
    }
    return count + 1;
  }, 0);

  const recentOrders = (orders as any[]).filter((order: any) => {
    if (order.items && order.items.length > 0) {
      return order.items.some((item: any) => item.status === "open" || item.status === "has_proposals");
    }
    return true;
  });

  const activeNegotiations = negotiations.filter((n: any) =>
    ["negotiating", "shipped"].includes(n.status)
  );

  const completedNegotiations = negotiations.filter((n: any) => n.status === "completed");
  const recentNegotiations = negotiations.slice(0, 3);
  const isLoading = loadingNeg || loadingOrders;
  const name = desmanche?.tradingName || user?.name || "Desmanche";

  // ── Rejection / pending banner ─────────────────────────────────────────────
  const isRejected = desmanche?.status === "rejected";
  const isPending = desmanche?.status === "pending";
  const isResubmitted = desmanche?.status === "resubmitted";

  if (isRejected) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-red-100 dark:bg-red-900/40 rounded-full p-3 shrink-0">
              <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-800 dark:text-red-300">Credenciamento Rejeitado</h2>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Sua solicitação de credenciamento foi analisada e não aprovada. Veja abaixo o motivo e o que deve ser corrigido.
              </p>
            </div>
          </div>

          {desmanche?.rejectionReason && (
            <div className="bg-white dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Motivo da Rejeição</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{desmanche.rejectionReason}</p>
            </div>
          )}

          <div className="bg-white dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">O que fazer agora</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              <li>Leia o motivo da rejeição acima com atenção</li>
              <li>Acesse a aba <button onClick={() => onNavigate("docs")} className="text-primary font-semibold hover:underline">Documentos</button> e reenvie os arquivos corrigidos</li>
              <li>Se necessário, atualize seus dados na aba <button onClick={() => onNavigate("profile")} className="text-primary font-semibold hover:underline">Perfil</button></li>
              <li>Clique em <strong>"Solicitar Nova Análise"</strong> abaixo quando tudo estiver correto</li>
            </ol>
          </div>

          <div className="space-y-3">
            {!showNoteField ? (
              <button
                type="button"
                onClick={() => setShowNoteField(true)}
                className="text-sm text-slate-500 hover:text-primary underline"
              >
                + Adicionar observação sobre as correções realizadas (opcional)
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Observação sobre as correções (opcional)
                </label>
                <textarea
                  className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-white dark:bg-slate-900"
                  placeholder="Descreva o que foi corrigido ou adicione informações para o avaliador..."
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => onNavigate("docs")}
              >
                <FileUp className="h-4 w-4" /> Ir para Documentos
              </Button>
              <Button
                className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => resubmitMutation.mutate()}
                disabled={resubmitMutation.isPending}
                data-testid="button-resubmit"
              >
                {resubmitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-4 w-4" /> Solicitar Nova Análise</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isPending || isResubmitted) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className={`rounded-xl border-2 p-6 space-y-3 ${isResubmitted ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800"}`}>
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-3 shrink-0 ${isResubmitted ? "bg-blue-100 dark:bg-blue-900/40" : "bg-yellow-100 dark:bg-yellow-900/40"}`}>
              <Loader2 className={`h-7 w-7 ${isResubmitted ? "text-blue-600 dark:text-blue-400" : "text-yellow-600 dark:text-yellow-400"} animate-spin`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isResubmitted ? "text-blue-800 dark:text-blue-300" : "text-yellow-800 dark:text-yellow-300"}`}>
                {isResubmitted ? "Correções Enviadas — Aguardando Nova Análise" : "Cadastro em Análise"}
              </h2>
              <p className={`text-sm mt-1 ${isResubmitted ? "text-blue-600 dark:text-blue-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                {isResubmitted
                  ? "Sua solicitação de correção foi recebida. Nossa equipe irá analisar em breve e você será notificado."
                  : "Seu cadastro está sendo analisado pela nossa equipe. Em breve você receberá uma resposta."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
            Olá, {name}!
          </h1>
          <p className="text-slate-500 mt-1">Aqui está o resumo das suas negociações na plataforma hoje.</p>
        </div>
      </div>

      <div data-tour="desmanche-overview-metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Em Negociação</CardTitle>
            <Handshake className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono text-slate-900">{activeNegotiations.length}</div>
                <p className="text-xs text-slate-500 mt-1 font-medium">negociações ativas no momento</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Vendas Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono text-slate-900">{completedNegotiations.length}</div>
                <p className="text-xs text-slate-500 mt-1 font-medium">vendas finalizadas na plataforma</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Oportunidades</CardTitle>
            <PackageSearch className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono text-primary">{availableItemsCount}</div>
                <p className="text-xs text-slate-600 mt-1 font-medium">itens disponíveis para proposta agora</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="font-mono text-lg">Pedidos Abertos Recentes</CardTitle>
            <CardDescription>Clientes aguardando proposta da sua empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <PackageSearch className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>Nenhum pedido aberto no momento.</p>
              </div>
            ) : (
              recentOrders.slice(0, 3).map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{order.title}</p>
                    <p className="text-xs text-slate-500">
                      {[order.vehicleBrand, order.vehicleModel, order.vehicleYear].filter(Boolean).join(" • ")}
                      {order.city ? ` • ${order.city}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onNavigate("orders")}>
                    Ver
                  </Button>
                </div>
              ))
            )}
            {recentOrders.length > 0 && (
              <Button variant="link" className="w-full text-primary mt-2" onClick={() => onNavigate("orders")}>
                Ver todos os {availableItemsCount} itens disponíveis <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <PackageSearch className="w-32 h-32" />
          </div>
          <CardHeader className="relative z-10">
            <CardTitle className="font-mono text-xl text-white">Minhas Negociações</CardTitle>
            <CardDescription className="text-slate-400">Últimas negociações em andamento.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : recentNegotiations.length === 0 ? (
              <p className="text-slate-400 text-sm">Nenhuma negociação ainda.</p>
            ) : (
              recentNegotiations.map((neg: any) => (
                <div key={neg.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <div className="text-sm font-bold text-blue-400 mb-1">{neg.order?.title || "Pedido"}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">{neg.client?.name || "Cliente"}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[neg.status] || ""}`}>
                      {STATUS_LABELS[neg.status] || neg.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
            <Button
              variant="link"
              className="w-full text-slate-400 hover:text-white mt-2"
              onClick={() => onNavigate("negotiations")}
            >
              Ver todas as negociações <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
