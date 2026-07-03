import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Package, Truck, CheckCircle2, Clock, Loader2, Car, MapPin,
  SendHorizonal, XCircle, MessageSquare, ShieldAlert, Phone, Eye,
  Handshake, FileText, MessageCircle, Ban, CalendarDays, Star, AlertTriangle,
  PlayCircle, X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { startDesmancheNegotiationsTour } from "@/lib/negotiationsTour";

const SAMPLE_PROPOSAL = {
  id: "sample-prop-1",
  status: "sent",
  price: 850,
  message:
    "Tenho a peça em ótimo estado, garantia de 30 dias. Posso enviar hoje mesmo via transportadora.",
  createdAt: Math.floor(Date.now() / 1000) - 60 * 60 * 3,
  order: {
    id: "sample00-0000-0000-0000-000000000001",
    title: "Farol dianteiro direito",
    vehicleBrand: "Volkswagen",
    vehicleModel: "Gol G6",
    vehicleYear: 2015,
    client: { phone: "" },
  },
};

const SAMPLE_NEGOTIATION = {
  id: "sample-neg-1",
  status: "negotiating",
  price: 850,
  createdAt: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
  updatedAt: Math.floor(Date.now() / 1000) - 60 * 60 * 2,
  order: {
    id: "sample00-0000-0000-0000-000000000002",
    title: "Farol dianteiro direito",
    vehicleBrand: "Volkswagen",
    vehicleModel: "Gol G6",
    vehicleYear: 2015,
    city: "São Paulo",
    state: "SP",
  },
  client: {
    name: "João da Silva",
    phone: "",
  },
  proposal: {
    price: 850,
    message: "Tenho a peça em ótimo estado, garantia de 30 dias.",
  },
};

const SAMPLE_HISTORY = {
  id: "sample-hist-1",
  status: "completed",
  price: 720,
  createdAt: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 12,
  updatedAt: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 5,
  order: {
    id: "sample00-0000-0000-0000-000000000003",
    title: "Retrovisor lado motorista",
    vehicleBrand: "Fiat",
    vehicleModel: "Uno",
    vehicleYear: 2018,
    city: "Campinas",
    state: "SP",
  },
  client: {
    name: "Maria Oliveira",
    phone: "",
  },
  proposal: {
    price: 720,
    message: "Retrovisor original, sem riscos.",
  },
};

const NEGOTIATION_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  negotiating:              { label: "Negociando",            color: "bg-blue-100 text-blue-800 border-blue-200",    icon: MessageSquare },
  shipped:                  { label: "Peça Enviada",          color: "bg-orange-100 text-orange-800 border-orange-200", icon: Truck },
  awaiting_review:          { label: "Aguard. Avaliação",     color: "bg-purple-100 text-purple-800 border-purple-200", icon: Package },
  delivered:                { label: "Entregue",              color: "bg-purple-100 text-purple-800 border-purple-200", icon: Package },
  completed:                { label: "Concluído",             color: "bg-green-100 text-green-800 border-green-200",  icon: CheckCircle2 },
  cancelled:                { label: "Cancelado",             color: "bg-red-100 text-red-800 border-red-200",       icon: XCircle },
  stale_awaiting_desmanche: { label: "⚠ Verificação Pendente", color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle },
  stale_awaiting_client:    { label: "Aguard. Cliente",       color: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  in_moderation:            { label: "Em Moderação",          color: "bg-orange-100 text-orange-800 border-orange-200", icon: ShieldAlert },
};

const PROPOSAL_STATUS: Record<string, { label: string; color: string }> = {
  sent:     { label: "Aguardando Resposta", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  accepted: { label: "Aceita ✓",           color: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Recusada",           color: "bg-red-100 text-red-800 border-red-200" },
};

function timeAgo(dateStr: string | number): string {
  const now = new Date();
  const date = typeof dateStr === "number" ? new Date(dateStr * 1000) : new Date(dateStr);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ontem" : `Há ${d} dias`;
}

function fmt(ts: any) {
  if (!ts) return "—";
  return new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString("pt-BR");
}

function fmtMoney(v: number | string) {
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function whatsapp(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export default function DesmancheNegotiationsTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [shipDialog, setShipDialog] = useState<any>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [detailDialog, setDetailDialog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("propostas");
  const [demoMode, setDemoMode] = useState(false);

  const handleStartDemoTour = () => {
    setDemoMode(true);
    setActiveTab("propostas");
    setTimeout(() => {
      startDesmancheNegotiationsTour({
        setActiveTab,
        onFinish: () => {
          /* keep demo on so user can explore */
        },
      });
    }, 250);
  };

  const handleCloseDemo = () => {
    setDemoMode(false);
  };

  const { data: blockStatus } = useQuery<{ isBlocked: boolean; overdueCount: number }>({
    queryKey: ["/api/desmanche/review-block-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanche/review-block-status");
      return res.json();
    },
    enabled: !!getToken(),
    refetchInterval: 60 * 1000,
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ["/api/proposals/my-sent"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/proposals?desmancheId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id && !!getToken(),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  });

  const { data: negotiations = [], isLoading: loadingNeg } = useQuery({
    queryKey: ["/api/negotiations/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/negotiations/my");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  });

  const updateNegMutation = useMutation({
    mutationFn: async ({ id, status, trackingCode }: { id: string; status: string; trackingCode?: string }) => {
      if (status === "shipped") {
        const res = await apiRequest("PATCH", `/api/negotiations/${id}/ship`, { trackingCode });
        return res.json();
      }
      const res = await apiRequest("PATCH", `/api/negotiations/${id}/status`, { status, trackingCode });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!", description: "Negociação atualizada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      setShipDialog(null);
      setTrackingCode("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const staleResponseMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const res = await apiRequest("PATCH", `/api/negotiations/${id}/stale-desmanche-response`, { response });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      if (vars.response === "sold") {
        toast({ title: "Resposta enviada!", description: "O cliente será consultado para confirmar o recebimento." });
      } else if (vars.response === "not_sold") {
        toast({ title: "Resposta enviada!", description: "O cliente será consultado para confirmar." });
      } else {
        toast({ title: "Negociação reativada!", description: "O prazo foi resetado e a negociação voltou ao status ativo." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao responder", description: err.message, variant: "destructive" });
    },
  });

  const effectiveProposals = demoMode ? [SAMPLE_PROPOSAL, ...proposals] : proposals;
  const effectiveNegotiations = demoMode
    ? [SAMPLE_NEGOTIATION, SAMPLE_HISTORY, ...negotiations]
    : negotiations;

  const pendingProposals = effectiveProposals.filter((p: any) => p.status === "sent");
  const answeredProposals = effectiveProposals.filter((p: any) => p.status !== "sent");
  const activeNeg = effectiveNegotiations.filter((n: any) => !["completed", "cancelled"].includes(n.status));
  const finishedNeg = effectiveNegotiations.filter((n: any) => ["completed", "cancelled"].includes(n.status));
  const staleDesmanches = effectiveNegotiations.filter((n: any) => n.status === "stale_awaiting_desmanche");

  const isLoading = loadingProposals || loadingNeg;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Minhas Negociações</h1>
          <p className="text-slate-500 mt-1">Acompanhe propostas enviadas e negociações em andamento.</p>
        </div>
        {!demoMode && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
            onClick={handleStartDemoTour}
            data-testid="button-start-negotiations-demo"
          >
            <PlayCircle className="h-4 w-4" />
            Ver tour com exemplos
          </Button>
        )}
      </div>

      {demoMode && (
        <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5">
            <PlayCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">Modo exemplo ativo</p>
              <p className="text-xs text-slate-600">
                Adicionamos 1 pedido de exemplo em cada aba só pra você visualizar. Os botões de exemplo não fazem nada.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-300"
            onClick={handleCloseDemo}
            data-tour="neg-close-demo"
            data-testid="button-close-negotiations-demo"
          >
            <X className="h-4 w-4" />
            Fechar exemplo
          </Button>
        </div>
      )}

      {blockStatus?.isBlocked && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">Envio de propostas bloqueado</p>
            <p className="text-sm text-red-700 mt-1">
              Você tem {blockStatus.overdueCount} avaliação(ões) do cliente atrasada(s). Aguarde o cliente avaliar as negociações pendentes.
            </p>
          </div>
        </div>
      )}

      {staleDesmanches.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-2" data-testid="banner-stale-desmanche-top">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="font-bold text-amber-900">
              {staleDesmanches.length === 1
                ? "1 negociação aguarda sua verificação"
                : `${staleDesmanches.length} negociações aguardam sua verificação`}
            </p>
          </div>
          <ul className="space-y-1 pl-7">
            {staleDesmanches.map((n: any) => (
              <li key={n.id} className="text-xs text-amber-800">
                • <span className="font-medium">{n.order?.title || "Negociação"}</span>
                {n.client?.name ? ` com ${n.client.name}` : ""}
                {" — "}parada há <span className="font-semibold">{daysOld(n.staleCheckAt || n.updatedAt)} dias</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 pl-7">Vá até "Em Andamento" para responder.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0 mb-6">
          <TabsTrigger
            value="propostas"
            data-tour="neg-tab-propostas"
            className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white bg-slate-100 py-2"
          >
            Propostas Enviadas
            {pendingProposals.length > 0 && (
              <span className="ml-1.5 bg-yellow-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {pendingProposals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="andamento"
            data-tour="neg-tab-andamento"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white bg-slate-100 py-2"
          >
            Em Andamento
            {activeNeg.length > 0 && (
              <span className="ml-1.5 bg-blue-700 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {activeNeg.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            data-tour="neg-tab-historico"
            className="data-[state=active]:bg-slate-600 data-[state=active]:text-white bg-slate-100 py-2"
          >
            Histórico
            {finishedNeg.length > 0 && (
              <span className="ml-1.5 bg-slate-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {finishedNeg.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── PROPOSTAS ENVIADAS ─────────────────────────────── */}
        <TabsContent value="propostas" className="space-y-4 mt-0">
          {effectiveProposals.length === 0 ? (
            <EmptyState
              icon={<SendHorizonal className="h-12 w-12 text-slate-300" />}
              title="Nenhuma proposta enviada ainda"
              desc="Acesse o Mural de Pedidos para encontrar oportunidades e enviar propostas."
            />
          ) : (
            <>
              {pendingProposals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Aguardando Resposta ({pendingProposals.length})
                  </h3>
                  {pendingProposals.map((p: any) => (
                    <div
                      key={p.id}
                      data-tour={p.id === SAMPLE_PROPOSAL.id ? "neg-sample-proposal" : undefined}
                    >
                      {p.id === SAMPLE_PROPOSAL.id && (
                        <div className="mb-1.5 text-[11px] uppercase tracking-wide font-bold text-primary/70">
                          Exemplo
                        </div>
                      )}
                      <ProposalCard proposal={p} />
                    </div>
                  ))}
                </div>
              )}
              {answeredProposals.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Respondidas ({answeredProposals.length})
                  </h3>
                  {answeredProposals.map((p: any) => (
                    <ProposalCard key={p.id} proposal={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── EM ANDAMENTO ───────────────────────────────────── */}
        <TabsContent value="andamento" className="space-y-4 mt-0">
          {activeNeg.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12 text-slate-300" />}
              title="Nenhuma negociação ativa"
              desc="Quando um cliente aceitar sua proposta, a negociação aparece aqui."
            />
          ) : (
            activeNeg.map((neg: any) => (
              <div
                key={neg.id}
                data-tour={neg.id === SAMPLE_NEGOTIATION.id ? "neg-sample-negotiation" : undefined}
              >
                {neg.id === SAMPLE_NEGOTIATION.id && (
                  <div className="mb-1.5 text-[11px] uppercase tracking-wide font-bold text-primary/70">
                    Exemplo
                  </div>
                )}
                <NegotiationCard
                  neg={neg}
                  onShip={() => {
                    if (neg.id === SAMPLE_NEGOTIATION.id) {
                      toast({ title: "Modo exemplo", description: "Esta é uma negociação de exemplo, sem ação real." });
                      return;
                    }
                    setShipDialog(neg);
                    setTrackingCode("");
                  }}
                  onUpdateStatus={(status) => {
                    if (neg.id === SAMPLE_NEGOTIATION.id) return;
                    updateNegMutation.mutate({ id: neg.id, status });
                  }}
                  onStaleResponse={(response) => {
                    if (neg.id === SAMPLE_NEGOTIATION.id) return;
                    staleResponseMutation.mutate({ id: neg.id, response });
                  }}
                  onViewDetail={() => setDetailDialog(neg)}
                  isPending={updateNegMutation.isPending || staleResponseMutation.isPending}
                />
              </div>
            ))
          )}
        </TabsContent>

        {/* ── HISTÓRICO ──────────────────────────────────────── */}
        <TabsContent value="historico" className="space-y-4 mt-0">
          {finishedNeg.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-slate-300" />}
              title="Sem histórico ainda"
              desc="Negociações concluídas ou canceladas aparecem aqui."
            />
          ) : (
            finishedNeg.map((neg: any) => (
              <div
                key={neg.id}
                data-tour={neg.id === SAMPLE_HISTORY.id ? "neg-sample-history" : undefined}
              >
                {neg.id === SAMPLE_HISTORY.id && (
                  <div className="mb-1.5 text-[11px] uppercase tracking-wide font-bold text-primary/70">
                    Exemplo
                  </div>
                )}
                <NegotiationCard
                  neg={neg}
                  readonly
                  onViewDetail={() => setDetailDialog(neg)}
                  isPending={false}
                />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Ship Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!shipDialog}
        onOpenChange={(o) => { if (!o) { setShipDialog(null); setTrackingCode(""); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Envio da Peça</DialogTitle>
            <DialogDescription>
              Informe o código de rastreamento para que o cliente possa acompanhar a entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <span className="text-slate-500">Pedido:</span>{" "}
              {shipDialog?.order?.id && (
                <span className="font-mono text-xs text-muted-foreground bg-white border px-1.5 py-0.5 rounded mr-1">
                  PED-{shipDialog.order.id.slice(0, 8).toUpperCase()}
                </span>
              )}
              <span className="font-semibold">{shipDialog?.order?.title}</span>
            </div>
            {shipDialog?.client && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  {shipDialog.client.name?.[0]?.toUpperCase() || "C"}
                </div>
                <div>
                  <p className="font-medium">{shipDialog.client.name}</p>
                  <p className="text-slate-500 text-xs">{shipDialog.client.email}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tracking">Código de Rastreamento (opcional)</Label>
              <Input
                id="tracking"
                placeholder="Ex: BR123456789AA"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShipDialog(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() =>
                  updateNegMutation.mutate({
                    id: shipDialog.id,
                    status: "shipped",
                    trackingCode: trackingCode || undefined,
                  })
                }
                disabled={updateNegMutation.isPending}
              >
                {updateNegMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                Confirmar Envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ─────────────────────────────────────── */}
      {detailDialog && (
        <DesmancheNegotiationDetailDialog
          neg={detailDialog}
          onClose={() => setDetailDialog(null)}
          onShip={() => { setDetailDialog(null); setShipDialog(detailDialog); setTrackingCode(""); }}
          onCancel={() => { updateNegMutation.mutate({ id: detailDialog.id, status: "cancelled" }); setDetailDialog(null); }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onNavigate }: { proposal: any; onNavigate?: (tab: string) => void }) {
  const status = PROPOSAL_STATUS[proposal.status] || { label: proposal.status, color: "bg-slate-100 text-slate-700" };
  const order = proposal.order;
  const clientPhone = proposal.order?.client?.phone || proposal.client?.phone || "";
  const waMsg = `Olá! Quero falar sobre a proposta da peça: ${order?.title || ""}`;

  return (
    <Card className="border-slate-200 hover:border-primary/30 transition-all">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
              <span className="font-mono text-xs text-slate-400">{timeAgo(proposal.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {order?.id && (
                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  PED-{order.id.slice(0, 8).toUpperCase()}
                </span>
              )}
              <h3 className="font-semibold text-slate-800 truncate">{order?.title || "Pedido"}</h3>
            </div>
            {order && (
              <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Car className="h-3.5 w-3.5 shrink-0" />
                {[order.vehicleBrand, order.vehicleModel, order.vehicleYear].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="mt-2 bg-slate-50 rounded p-2 text-sm text-slate-600 border border-slate-100">
              <p className="text-xs text-slate-400 mb-0.5">Sua mensagem:</p>
              {proposal.message}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">{fmtMoney(proposal.price)}</div>
            <div className="text-xs text-slate-400">valor proposto</div>
          </div>
        </div>

        {proposal.status === "sent" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-700 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            O cliente ainda não respondeu. Você será notificado quando houver uma resposta.
          </div>
        )}
        {proposal.status === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            O cliente recusou esta proposta.
          </div>
        )}
        {proposal.status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Proposta aceita! A negociação está na aba "Em Andamento".
          </div>
        )}

        {/* Action bar */}
        {(proposal.status === "sent" || proposal.status === "accepted") && clientPhone && (
          <div className="border-t pt-2 flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 flex-1 border-green-300 text-green-700 hover:bg-green-50" asChild>
              <a href={whatsapp(clientPhone, waMsg)} target="_blank" rel="noopener noreferrer">
                <Phone className="h-3.5 w-3.5" /> WhatsApp cliente
              </a>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 flex-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onNavigate?.("chat")}>
              <MessageCircle className="h-3.5 w-3.5" /> Conversar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Negotiation Card ─────────────────────────────────────────────────────────

function daysOld(ts: string | number | null | undefined): number {
  if (!ts) return 0;
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function NegotiationCard({
  neg,
  onShip,
  onUpdateStatus,
  onStaleResponse,
  onViewDetail,
  onNavigate,
  isPending,
  readonly = false,
}: {
  neg: any;
  onShip?: () => void;
  onUpdateStatus?: (status: string) => void;
  onStaleResponse?: (response: "sold" | "not_sold" | "still_negotiating") => void;
  onViewDetail: () => void;
  onNavigate?: (tab: string) => void;
  isPending: boolean;
  readonly?: boolean;
}) {
  const st = NEGOTIATION_STATUS[neg.status] || {
    label: neg.status,
    color: "bg-slate-100 text-slate-700",
    icon: Package,
  };
  const StIcon = st.icon;
  const clientPhone = neg.client?.phone || "";
  const waMsg = `Olá ${neg.client?.name || "cliente"}! Quero falar sobre a negociação: ${neg.order?.title || ""}`;

  return (
    <Card className={`border-slate-200 transition-all ${readonly ? "opacity-80" : "hover:border-primary/30"}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={`text-xs gap-1 ${st.color}`}>
                <StIcon className="h-3 w-3" /> {st.label}
              </Badge>
              <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {timeAgo(neg.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {neg.order?.id && (
                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  PED-{neg.order.id.slice(0, 8).toUpperCase()}
                </span>
              )}
              <h3 className="font-semibold text-slate-800">{neg.order?.title || "Negociação"}</h3>
            </div>
            {neg.order && (
              <div className="text-sm text-slate-500 flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                {[neg.order.vehicleBrand, neg.order.vehicleModel, neg.order.vehicleYear].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">{fmtMoney(neg.price)}</div>
            <div className="text-xs text-slate-400">valor acordado</div>
          </div>
        </div>

        {/* Cliente */}
        {neg.client && (
          <div className="bg-slate-50 rounded p-2.5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {neg.client.name?.[0]?.toUpperCase() || "C"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{neg.client.name}</p>
              {(neg.order?.city || neg.order?.state) && (
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[neg.order.city, neg.order.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Proposta original */}
        {neg.proposal && (
          <div className="bg-blue-50 border border-blue-100 rounded p-2 text-sm">
            <p className="text-xs text-blue-500 mb-0.5">Sua proposta original:</p>
            <p className="text-blue-800 font-medium">{fmtMoney(neg.proposal.price)}</p>
            {neg.proposal.message && (
              <p className="text-blue-700 text-xs mt-0.5 italic">"{neg.proposal.message}"</p>
            )}
          </div>
        )}

        {/* Status banners */}
        {neg.status === "negotiating" && !readonly && (
          <div className="space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
              Proposta aceita — quando a peça estiver pronta para envio, clique em "Informar Envio".
            </div>
            <Button
              size="sm"
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={onShip}
              disabled={isPending}
            >
              <Truck className="h-4 w-4" /> Informar Envio da Peça
            </Button>
          </div>
        )}

        {neg.status === "shipped" && (
          <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-700 space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Peça enviada — aguardando confirmação de entrega pelo cliente
            </div>
            {neg.trackingCode && (
              <p>Rastreamento: <span className="font-mono font-bold">{neg.trackingCode}</span></p>
            )}
          </div>
        )}

        {(neg.status === "awaiting_review" || neg.status === "delivered") && !readonly && (
          <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-700">
            <div className="font-semibold flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Entregue — aguardando avaliação do cliente
            </div>
          </div>
        )}

        {neg.status === "stale_awaiting_desmanche" && !readonly && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Verificação necessária</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  A negociação de <span className="font-semibold">{neg.order?.title || "peça"}</span>
                  {neg.client?.name ? <> com <span className="font-semibold">{neg.client.name}</span></> : null}
                  {" "}está parada há <span className="font-semibold">{daysOld(neg.staleCheckAt || neg.updatedAt)} dias</span>. O que aconteceu?
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full justify-start"
                onClick={() => onStaleResponse?.("sold")}
                disabled={isPending}
                data-testid="button-stale-sold"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Sim, a venda foi concluída — a peça foi enviada/entregue</span>
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-slate-600 hover:bg-slate-700 text-white w-full justify-start"
                onClick={() => onStaleResponse?.("not_sold")}
                disabled={isPending}
                data-testid="button-stale-not-sold"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span>Não houve venda — negociação não foi adiante</span>
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full justify-start"
                onClick={() => onStaleResponse?.("still_negotiating")}
                disabled={isPending}
                data-testid="button-stale-still-negotiating"
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>Ainda estamos negociando — reativar a negociação</span>
              </Button>
            </div>
            {isPending && (
              <div className="flex items-center gap-2 text-amber-700 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando…
              </div>
            )}
          </div>
        )}

        {neg.status === "stale_awaiting_client" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-800 text-sm">
              <Clock className="h-4 w-4" /> Aguardando confirmação do cliente
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {neg.desmanchemResponse === "sold"
                ? "Você informou que a venda foi concluída. O cliente será consultado para confirmar o recebimento."
                : "Você informou que não houve venda. O cliente está sendo consultado para confirmar."}
            </p>
          </div>
        )}

        {neg.status === "in_moderation" && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-1" data-testid="banner-in-moderation">
            <div className="font-semibold flex items-center gap-1.5 text-orange-800 text-sm">
              <ShieldAlert className="h-4 w-4" /> Em moderação — aguarde a decisão do admin
            </div>
            <p className="text-xs text-orange-700 leading-relaxed">
              Houve divergência nas respostas. Nossa equipe está analisando o caso. Você receberá um e-mail com a decisão final.
            </p>
          </div>
        )}

        {neg.status === "completed" && (
          <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700">
            <div className="font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Venda concluída com sucesso
            </div>
          </div>
        )}

        {neg.status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
            <div className="font-semibold flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> Negociação cancelada
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="border-t pt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 flex-1 min-w-[100px]" onClick={onViewDetail}>
            <Eye className="h-3.5 w-3.5" /> Ver detalhes
          </Button>

          {clientPhone && (
            <Button size="sm" variant="outline" className="gap-1.5 flex-1 min-w-[100px] border-green-300 text-green-700 hover:bg-green-50" asChild>
              <a href={whatsapp(clientPhone, waMsg)} target="_blank" rel="noopener noreferrer">
                <Phone className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </Button>
          )}

          <Button size="sm" variant="outline" className="gap-1.5 flex-1 min-w-[100px] border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onNavigate?.("chat")}>
            <MessageCircle className="h-3.5 w-3.5" /> Conversar
          </Button>

          {neg.status === "negotiating" && !readonly && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => onUpdateStatus?.("cancelled")}
              disabled={isPending}
            >
              <Ban className="h-3.5 w-3.5" /> Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog (Desmanche) ────────────────────────────────────────────────

function DesmancheNegotiationDetailDialog({
  neg,
  onClose,
  onShip,
  onCancel,
  onNavigate,
}: {
  neg: any;
  onClose: () => void;
  onShip: () => void;
  onCancel: () => void;
  onNavigate?: (tab: string) => void;
}) {
  const st = NEGOTIATION_STATUS[neg.status] || { label: neg.status, color: "bg-slate-100 text-slate-700", icon: Package };
  const clientPhone = neg.client?.phone || "";
  const waMsg = `Olá ${neg.client?.name || "cliente"}! Quero falar sobre a negociação da peça: ${neg.order?.title || ""}`;

  const timeline = [
    { label: "Proposta aceita pelo cliente", date: neg.createdAt,  done: true },
    { label: "Peça enviada",                 date: neg.status !== "negotiating" ? neg.updatedAt : null, done: neg.status !== "negotiating" && neg.status !== "cancelled" },
    { label: "Entrega confirmada",           date: neg.receivedAt, done: !!neg.receivedAt || ["awaiting_review", "completed"].includes(neg.status) },
    { label: "Cliente avaliou",              date: null,           done: neg.status === "completed" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Negociação</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline" className={st.color}>{st.label}</Badge>
            <span className="text-xs text-muted-foreground">desde {fmt(neg.createdAt)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Pedido do cliente */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Pedido do Cliente
            </h4>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
              <p className="font-semibold">{neg.order?.title}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                {[neg.order?.vehicleBrand, neg.order?.vehicleModel, neg.order?.vehicleYear].filter(Boolean).join(" · ")}
              </p>
              {neg.order?.partName && (
                <p className="text-sm"><span className="text-muted-foreground">Peça:</span> {neg.order.partName}</p>
              )}
              {neg.order?.partPosition && (
                <p className="text-sm"><span className="text-muted-foreground">Posição:</span> {neg.order.partPosition}</p>
              )}
              {(neg.order?.city || neg.order?.state) && (
                <p className="text-sm flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[neg.order?.city, neg.order?.state].filter(Boolean).join(", ")}
                </p>
              )}
              {neg.order?.description && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-xs text-muted-foreground mb-0.5">Descrição:</p>
                  <p className="text-sm">{neg.order.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Cliente */}
          {neg.client && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Handshake className="h-3.5 w-3.5" /> Cliente
              </h4>
              <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {neg.client.name?.[0]?.toUpperCase() || "C"}
                </div>
                <div>
                  <p className="font-semibold">{neg.client.name}</p>
                  <p className="text-sm text-muted-foreground">{neg.client.email}</p>
                  {neg.client.phone && (
                    <p className="text-sm text-muted-foreground">{neg.client.phone}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Proposta */}
          {neg.proposal && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" /> Sua Proposta
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Valor proposto</span>
                  <span className="text-xl font-bold text-green-700">{fmtMoney(neg.proposal.price)}</span>
                </div>
                {neg.proposal.message && (
                  <div className="bg-white rounded p-2 text-sm italic text-slate-600 border border-green-100">
                    "{neg.proposal.message}"
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Enviada em {fmt(neg.proposal.createdAt)}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Linha do Tempo
            </h4>
            <div className="space-y-2">
              {neg.status === "cancelled" ? (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Negociação cancelada</p>
                    <p className="text-xs text-red-600">{fmt(neg.updatedAt || neg.createdAt)}</p>
                  </div>
                </div>
              ) : (
                timeline.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${t.done ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.done ? "bg-green-500 text-white" : "bg-slate-300 text-slate-600"}`}>
                      {t.done ? "✓" : i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${t.done ? "text-green-800" : "text-slate-500"}`}>{t.label}</p>
                      {t.date && <p className="text-xs text-muted-foreground">{fmt(t.date)}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {neg.trackingCode && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-orange-600 shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">Código de rastreamento:</p>
                <p className="font-mono font-bold text-orange-700">{neg.trackingCode}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Ações */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ações</h4>
            <div className="grid grid-cols-2 gap-2">
              {clientPhone && (
                <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50" asChild>
                  <a href={whatsapp(clientPhone, waMsg)} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              <Button variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { onClose(); onNavigate?.("chat"); }}>
                <MessageCircle className="h-4 w-4" /> Conversar
              </Button>
            </div>
            {neg.status === "negotiating" && (
              <>
                <Button className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={onShip}>
                  <Truck className="h-4 w-4" /> Informar Envio da Peça
                </Button>
                <Button variant="outline" className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={onCancel}>
                  <Ban className="h-4 w-4" /> Cancelar Negociação
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-slate-500 text-sm">{desc}</p>
    </div>
  );
}
