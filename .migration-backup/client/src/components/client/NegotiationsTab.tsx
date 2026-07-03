import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Handshake, Truck, CheckCircle2, Star, Loader2, Package,
  Clock, AlertTriangle, XCircle, ShieldAlert, MessageCircle,
  Phone, Eye, Car, MapPin, FileText, ChevronDown, ChevronUp,
  CalendarDays, Ban,
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; step: number }> = {
  negotiating:              { label: "Negociando",          color: "bg-blue-100 text-blue-800 border-blue-200",     step: 1 },
  shipped:                  { label: "Enviado",             color: "bg-orange-100 text-orange-800 border-orange-200", step: 2 },
  awaiting_review:          { label: "Aguardando Avaliação", color: "bg-purple-100 text-purple-800 border-purple-200", step: 3 },
  completed:                { label: "Concluído",           color: "bg-green-100 text-green-800 border-green-200",  step: 4 },
  cancelled:                { label: "Cancelado",           color: "bg-red-100 text-red-800 border-red-200",        step: 0 },
  stale_awaiting_desmanche: { label: "⚠ Verificação Desmanche", color: "bg-amber-100 text-amber-800 border-amber-200", step: 1 },
  stale_awaiting_client:    { label: "⚠ Confirme sua Compra",   color: "bg-amber-200 text-amber-900 border-amber-400", step: 1 },
  in_moderation:            { label: "Em Moderação",        color: "bg-orange-100 text-orange-800 border-orange-300", step: 1 },
};

function fmt(ts: any) {
  if (!ts) return "—";
  return new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString("pt-BR");
}

function fmtMoney(v: number) {
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function whatsapp(phone: string, context?: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = context ? encodeURIComponent(context) : "";
  return `https://wa.me/${num}${msg ? `?text=${msg}` : ""}`;
}

function deadlineCountdown(deadlineTs: any) {
  if (!deadlineTs) return null;
  const deadline = new Date(typeof deadlineTs === "number" ? deadlineTs * 1000 : deadlineTs).getTime();
  const now = Date.now();
  const diff = deadline - now;
  if (diff <= 0) return { days: 0, hours: 0, isOverdue: true, percent: 100 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const totalDays = 10;
  const percent = Math.max(0, 100 - (diff / (totalDays * 24 * 60 * 60 * 1000)) * 100);
  return { days, hours, isOverdue: false, percent };
}

interface Negotiation {
  id: string;
  orderId: string;
  proposalId: string;
  clientId: string;
  desmancheId: string;
  price: number;
  status: string;
  trackingCode?: string;
  receivedAt?: any;
  reviewDeadlineAt?: any;
  createdAt: any;
  updatedAt?: any;
  desmanchemResponse?: string | null;
  clientResponse?: string | null;
  order?: {
    title: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear: number;
    partName?: string;
    partCategory?: string;
    partPosition?: string;
    description?: string;
    urgency?: string;
    location?: string;
    city?: string;
    state?: string;
  };
  desmanche?: { tradingName: string; phone: string; rating: number; email?: string };
  proposal?: { price: number; message?: string; createdAt?: any };
}

export function NegotiationsTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = getToken();
  const [filter, setFilter] = useState("all");
  const [reviewDialog, setReviewDialog] = useState<Negotiation | null>(null);
  const [detailDialog, setDetailDialog] = useState<Negotiation | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceUpdate((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const { data: negotiations = [], isLoading } = useQuery<Negotiation[]>({
    queryKey: ["/api/negotiations/my"],
    queryFn: async () => {
      const res = await fetch("/api/negotiations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30 * 1000,
  });

  const { data: blockStatus } = useQuery<{
    isBlocked: boolean;
    overdueCount: number;
    pendingReviews: Negotiation[];
  }>({
    queryKey: ["/api/client/review-block-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/review-block-status");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60 * 1000,
  });

  const receivedMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const res = await apiRequest("PATCH", `/api/negotiations/${negotiationId}/received`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      qc.invalidateQueries({ queryKey: ["/api/client/review-block-status"] });
      toast({ title: "Recebimento confirmado!", description: "O prazo para avaliação começa agora." });
    },
    onError: () => toast({ title: "Erro ao confirmar recebimento", variant: "destructive" }),
  });

  const staleClientResponseMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const res = await apiRequest("PATCH", `/api/negotiations/${id}/stale-client-response`, { response });
      return res.json();
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      if (data?.divergence) {
        toast({ title: "Divergência identificada", description: "Suas respostas foram diferentes. Nossa equipe irá analisar e resolver." });
      } else if (vars.response === "received") {
        toast({ title: "Recebimento confirmado!", description: "Prazo para avaliação iniciado." });
      } else {
        toast({ title: "Negociação cancelada.", description: "Obrigado pela confirmação." });
      }
    },
    onError: (err: Error) => toast({ title: "Erro ao responder", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const res = await apiRequest("PATCH", `/api/negotiations/${negotiationId}/status`, { status: "cancelled" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      toast({ title: "Negociação cancelada." });
    },
    onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { negotiationId: string; clientId: string; desmancheId: string; rating: number; comment: string }) => {
      const res = await apiRequest("POST", "/api/reviews", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/negotiations/my"] });
      qc.invalidateQueries({ queryKey: ["/api/client/review-block-status"] });
      setReviewDialog(null);
      setReviewRating(5);
      setReviewComment("");
      toast({ title: "Avaliação enviada!", description: "Obrigado pelo feedback. Negociação concluída." });
    },
    onError: () => toast({ title: "Erro ao enviar avaliação", variant: "destructive" }),
  });

  const handleReview = () => {
    if (!reviewDialog || !user) return;
    reviewMutation.mutate({
      negotiationId: reviewDialog.id,
      clientId: user.id,
      desmancheId: reviewDialog.desmancheId,
      rating: reviewRating,
      comment: reviewComment,
    });
  };

  const filteredNegotiations = negotiations.filter((n) => {
    if (filter === "all") return true;
    if (filter === "awaiting_review") return n.status === "awaiting_review";
    return n.status === filter;
  });

  const awaitingReviewCount = negotiations.filter((n) => n.status === "awaiting_review").length;
  const staleClientNeg = negotiations.filter((n) => n.status === "stale_awaiting_client");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Minhas Negociações</h2>
        <p className="text-sm text-muted-foreground">Acompanhe suas negociações de peças</p>
      </div>

      {blockStatus?.isBlocked && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">Conta com restrição — pedidos bloqueados</p>
            <p className="text-sm text-red-700 mt-1">
              Você tem {blockStatus.overdueCount} avaliação(ões) atrasada(s). Avalie as negociações abaixo para reativar sua conta.
            </p>
          </div>
        </div>
      )}

      {staleClientNeg.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-2" data-testid="banner-stale-client-top">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
            <p className="font-bold text-amber-900">
              {staleClientNeg.length === 1
                ? "1 compra aguarda sua confirmação"
                : `${staleClientNeg.length} compras aguardam sua confirmação`}
            </p>
          </div>
          <ul className="space-y-1 pl-7">
            {staleClientNeg.map((n) => (
              <li key={n.id} className="text-xs text-amber-800">
                • <span className="font-medium">{n.order?.title || "Negociação"}</span>
                {n.desmanche?.tradingName ? ` — ${n.desmanche.tradingName}` : ""}
                {" — "}parada há <span className="font-semibold">{daysOld(n.updatedAt)} dias</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 pl-7">Role para baixo para responder.</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "Todas" },
          { key: "negotiating", label: "Negociando" },
          { key: "shipped", label: "Enviadas" },
          { key: "awaiting_review", label: "Aguard. Avaliação", badge: awaitingReviewCount },
          { key: "completed", label: "Concluídas" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className="gap-1.5"
          >
            {f.label}
            {f.badge != null && f.badge > 0 && (
              <span className="bg-primary-foreground text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {f.badge}
              </span>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredNegotiations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Handshake className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma negociação encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Aceite propostas nos seus pedidos para iniciar negociações</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNegotiations.map((neg) => (
            <NegotiationCard
              key={neg.id}
              neg={neg}
              onConfirmReceived={() => receivedMutation.mutate(neg.id)}
              onReview={() => { setReviewDialog(neg); setReviewRating(5); setReviewComment(""); }}
              onCancel={() => cancelMutation.mutate(neg.id)}
              onViewDetail={() => setDetailDialog(neg)}
              onNavigate={onNavigate}
              onStaleResponse={(response) => staleClientResponseMutation.mutate({ id: neg.id, response })}
              isConfirmingReceived={receivedMutation.isPending && receivedMutation.variables === neg.id}
              isCancelling={cancelMutation.isPending && cancelMutation.variables === neg.id}
              isStaleResponding={staleClientResponseMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Avaliação Dialog ─────────────────────────────────── */}
      <Dialog open={!!reviewDialog} onOpenChange={(o) => !o && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Desmanche</DialogTitle>
            <DialogDescription>
              Avalie o desmanche <strong>{reviewDialog?.desmanche?.tradingName}</strong>.
              A negociação será concluída após a avaliação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sua nota</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setReviewRating(n)} className="p-1 transition-transform hover:scale-110">
                    <Star className={`h-7 w-7 ${n <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"][reviewRating]}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Comentário (opcional)</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Como foi sua experiência com este desmanche?"
                rows={3}
              />
            </div>
            <Button onClick={handleReview} className="w-full" disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
              Enviar Avaliação & Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detalhe Completo Dialog ──────────────────────────── */}
      {detailDialog && (
        <NegotiationDetailDialog
          neg={detailDialog}
          onClose={() => setDetailDialog(null)}
          onReview={() => { setDetailDialog(null); setReviewDialog(detailDialog); setReviewRating(5); setReviewComment(""); }}
          onConfirmReceived={() => { receivedMutation.mutate(detailDialog.id); }}
          onCancel={() => { cancelMutation.mutate(detailDialog.id); setDetailDialog(null); }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysOld(ts: string | number | null | undefined): number {
  if (!ts) return 0;
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Negotiation Card ─────────────────────────────────────────────────────────

function NegotiationCard({
  neg,
  onConfirmReceived,
  onReview,
  onCancel,
  onViewDetail,
  onNavigate,
  onStaleResponse,
  isConfirmingReceived,
  isCancelling,
  isStaleResponding,
}: {
  neg: Negotiation;
  onConfirmReceived: () => void;
  onReview: () => void;
  onCancel: () => void;
  onViewDetail: () => void;
  onNavigate?: (tab: string) => void;
  onStaleResponse: (response: "received" | "not_received") => void;
  isConfirmingReceived: boolean;
  isCancelling: boolean;
  isStaleResponding: boolean;
}) {
  const config = statusConfig[neg.status] || { label: neg.status, color: "bg-slate-100 text-slate-700 border-slate-200", step: 0 };
  const countdown = neg.status === "awaiting_review" ? deadlineCountdown(neg.reviewDeadlineAt) : null;
  const phone = neg.desmanche?.phone || "";
  const waMsg = `Olá! Referente à negociação da peça: ${neg.order?.title || ""}`;

  return (
    <Card className="hover:shadow-md transition-shadow border-slate-200">
      <CardContent className="pt-4 pb-0 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={config.color}>{config.label}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {fmt(neg.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                PED-{(neg.orderId || neg.order?.id || "").slice(0, 8).toUpperCase()}
              </span>
              <h3 className="font-semibold text-base leading-tight">{neg.order?.title || "Pedido"}</h3>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Car className="h-3.5 w-3.5 shrink-0" />
              {[neg.order?.vehicleBrand, neg.order?.vehicleModel, neg.order?.vehicleYear].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm mt-1 flex items-center gap-2 flex-wrap">
              <span>Desmanche: <strong>{neg.desmanche?.tradingName}</strong></span>
              {neg.desmanche?.rating != null && (
                <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {Number(neg.desmanche.rating).toFixed(1)}
                </span>
              )}
            </p>
            {neg.trackingCode && (
              <p className="text-sm mt-1 flex items-center gap-1 text-orange-700">
                <Truck className="h-3.5 w-3.5" /> Rastreio: <span className="font-mono font-bold">{neg.trackingCode}</span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-green-600">{fmtMoney(neg.price)}</div>
            <div className="text-xs text-muted-foreground">valor acordado</div>
          </div>
        </div>

        {/* Status banners */}
        {neg.status === "stale_awaiting_desmanche" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" /> Verificação em andamento
            </div>
            <p className="text-xs text-amber-700">
              Essa negociação está parada há um tempo. O desmanche foi consultado e irá responder em breve.
            </p>
          </div>
        )}

        {neg.status === "stale_awaiting_client" && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Sua confirmação é necessária</p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  A negociação de <span className="font-semibold">{neg.order?.title || "peça"}</span>
                  {neg.desmanche?.tradingName ? <> com <span className="font-semibold">{neg.desmanche.tradingName}</span></> : null}
                  {" "}está parada há <span className="font-semibold">{daysOld(neg.updatedAt)} dias</span>.{" "}
                  {neg.desmanchemResponse === "sold"
                    ? "O desmanche informou que a venda foi concluída. Você recebeu a peça?"
                    : "O desmanche informou que não houve venda. Você chegou a receber alguma peça?"}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full justify-start"
                onClick={() => onStaleResponse("received")}
                disabled={isStaleResponding}
                data-testid="button-stale-received"
              >
                {isStaleResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Sim, recebi a peça
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-slate-600 hover:bg-slate-700 text-white w-full justify-start"
                onClick={() => onStaleResponse("not_received")}
                disabled={isStaleResponding}
                data-testid="button-stale-not-received"
              >
                {isStaleResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Não, não recebi nada
              </Button>
            </div>
          </div>
        )}

        {neg.status === "in_moderation" && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-1" data-testid="banner-in-moderation">
            <div className="flex items-center gap-1.5 text-orange-800 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" /> Em análise pela moderação
            </div>
            <p className="text-xs text-orange-700 leading-relaxed">
              Houve divergência entre as informações do desmanche e as suas. Nossa equipe está analisando o caso e irá resolver em breve. Você receberá um e-mail com a decisão final.
            </p>
          </div>
        )}

        {neg.status === "shipped" && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-orange-800 text-sm font-semibold">
              <Truck className="h-4 w-4" /> A peça está a caminho!
            </div>
            <p className="text-xs text-orange-700">
              Quando receber a peça, confirme o recebimento para iniciar o prazo de avaliação.
            </p>
            <Button
              size="sm"
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={onConfirmReceived}
              disabled={isConfirmingReceived}
            >
              {isConfirmingReceived ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              Confirmar Recebimento
            </Button>
          </div>
        )}

        {neg.status === "awaiting_review" && countdown && (
          <div className={`rounded-lg border p-3 space-y-2 ${countdown.isOverdue ? "bg-red-50 border-red-200" : "bg-purple-50 border-purple-200"}`}>
            <div className={`flex items-center gap-2 text-sm font-semibold ${countdown.isOverdue ? "text-red-800" : "text-purple-800"}`}>
              {countdown.isOverdue
                ? <><AlertTriangle className="h-4 w-4" /> Prazo de avaliação encerrado</>
                : <><Clock className="h-4 w-4" /> Avalie antes do prazo expirar!</>}
            </div>
            {!countdown.isOverdue && (
              <>
                <Progress value={countdown.percent} className="h-2" />
                <p className="text-xs text-purple-700">
                  {countdown.days > 0 ? `${countdown.days} dia(s) e ` : ""}{countdown.hours}h restantes
                </p>
              </>
            )}
            <Button size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={onReview}>
              <Star className="h-3.5 w-3.5" />
              {countdown.isOverdue ? "Avaliar mesmo assim" : "Avaliar Agora"}
            </Button>
          </div>
        )}

        {neg.status === "completed" && (
          <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Negociação concluída com sucesso!
          </div>
        )}
        {neg.status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Negociação cancelada.
          </div>
        )}

        {/* Action bar */}
        <div className="border-t pt-3 pb-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 flex-1 min-w-[110px]" onClick={onViewDetail}>
            <Eye className="h-3.5 w-3.5" /> Ver detalhes
          </Button>

          {phone && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 flex-1 min-w-[110px] border-green-300 text-green-700 hover:bg-green-50"
              asChild
            >
              <a href={whatsapp(phone, waMsg)} target="_blank" rel="noopener noreferrer">
                <Phone className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 flex-1 min-w-[110px] border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => onNavigate?.("chat")}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Conversar
          </Button>

          {neg.status === "negotiating" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function NegotiationDetailDialog({
  neg,
  onClose,
  onReview,
  onConfirmReceived,
  onCancel,
  onNavigate,
}: {
  neg: Negotiation;
  onClose: () => void;
  onReview: () => void;
  onConfirmReceived: () => void;
  onCancel: () => void;
  onNavigate?: (tab: string) => void;
}) {
  const config = statusConfig[neg.status] || { label: neg.status, color: "bg-slate-100 text-slate-700", step: 0 };
  const phone = neg.desmanche?.phone || "";
  const waMsg = `Olá ${neg.desmanche?.tradingName}! Quero falar sobre a negociação: ${neg.order?.title || ""}`;

  const timeline = [
    { step: 1, label: "Proposta aceita", date: neg.createdAt, done: true },
    { step: 2, label: "Peça enviada",     date: neg.status !== "negotiating" ? neg.updatedAt : null, done: neg.status !== "negotiating" && neg.status !== "cancelled" },
    { step: 3, label: "Recebida",         date: neg.receivedAt, done: !!neg.receivedAt || neg.status === "awaiting_review" || neg.status === "completed" },
    { step: 4, label: "Avaliada",         date: null, done: neg.status === "completed" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Detalhes da Negociação</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline" className={config.color}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground">desde {fmt(neg.createdAt)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Pedido */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Pedido
            </h4>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground bg-white border px-2 py-0.5 rounded">
                  PED-{(neg.orderId || neg.order?.id || "").slice(0, 8).toUpperCase()}
                </span>
                <p className="font-semibold">{neg.order?.title}</p>
              </div>
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
                  <p className="text-xs text-muted-foreground mb-0.5">Descrição do pedido:</p>
                  <p className="text-sm">{neg.order.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Proposta aceita */}
          {neg.proposal && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Handshake className="h-3.5 w-3.5" /> Proposta Aceita
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-green-800">{neg.desmanche?.tradingName}</p>
                    {neg.desmanche?.rating != null && (
                      <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {Number(neg.desmanche.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-bold text-green-700">{fmtMoney(neg.proposal.price)}</span>
                </div>
                {neg.proposal.message && (
                  <div className="bg-white rounded p-2 text-sm text-slate-700 border border-green-100">
                    <p className="text-xs text-slate-400 mb-0.5">Mensagem do desmanche:</p>
                    {neg.proposal.message}
                  </div>
                )}
                {neg.proposal.createdAt && (
                  <p className="text-xs text-muted-foreground">Enviada em {fmt(neg.proposal.createdAt)}</p>
                )}
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
                timeline.map((t) => (
                  <div key={t.step} className={`flex items-center gap-3 p-2.5 rounded-lg border ${t.done ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.done ? "bg-green-500 text-white" : "bg-slate-300 text-slate-600"}`}>
                      {t.done ? "✓" : t.step}
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

          {/* Contato e ações */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato & Ações</h4>
            <div className="grid grid-cols-2 gap-2">
              {phone && (
                <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50" asChild>
                  <a href={whatsapp(phone, waMsg)} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => { onClose(); onNavigate?.("chat"); }}
              >
                <MessageCircle className="h-4 w-4" /> Conversar
              </Button>
            </div>

            {neg.status === "shipped" && (
              <Button className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={onConfirmReceived}>
                <Package className="h-4 w-4" /> Confirmar Recebimento
              </Button>
            )}
            {neg.status === "awaiting_review" && (
              <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={onReview}>
                <Star className="h-4 w-4" /> Avaliar Desmanche
              </Button>
            )}
            {neg.status === "negotiating" && (
              <Button
                variant="outline"
                className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50"
                onClick={onCancel}
              >
                <Ban className="h-4 w-4" /> Cancelar Negociação
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
