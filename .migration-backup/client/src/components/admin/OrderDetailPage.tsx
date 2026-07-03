import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Car, MapPin, User, Clock, Package,
  MessageSquare, Handshake, Star, Phone, Truck,
  CheckCircle2, XCircle, AlertTriangle, Loader2, DollarSign, FileText,
  MessageCircle, Mail, Store,
} from "lucide-react";

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  open:           { label: "Propostas Abertas",  color: "bg-green-100 text-green-700 border-green-200" },
  in_negotiation: { label: "Em Negociação",      color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  negotiating:    { label: "Em Negociação",      color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  completed:      { label: "Concluído",          color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:      { label: "Cancelado",          color: "bg-red-100 text-red-700 border-red-200" },
  expired:        { label: "Expirado",           color: "bg-gray-100 text-gray-500 border-gray-200" },
  shipped:        { label: "Enviado",            color: "bg-blue-100 text-blue-700 border-blue-200" },
};

const PROPOSAL_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "Aguardando", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  accepted: { label: "Aceita",     color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  rejected: { label: "Recusada",   color: "bg-red-100 text-red-700",      icon: XCircle },
};

const NEG_STATUS: Record<string, { label: string; color: string }> = {
  negotiating:              { label: "Negociando",           color: "bg-blue-100 text-blue-700" },
  shipped:                  { label: "Enviado",              color: "bg-orange-100 text-orange-700" },
  awaiting_review:          { label: "Aguard. Avaliação",   color: "bg-yellow-100 text-yellow-700" },
  completed:                { label: "Concluído",            color: "bg-green-100 text-green-700" },
  cancelled:                { label: "Cancelado",            color: "bg-red-100 text-red-700" },
  stale_awaiting_desmanche: { label: "⚠ Verificação",        color: "bg-amber-100 text-amber-700" },
  stale_awaiting_client:    { label: "Aguard. Cliente",      color: "bg-amber-50 text-amber-600" },
  in_moderation:            { label: "⚠ Em Moderação",       color: "bg-orange-100 text-orange-700" },
};

function fmt(val: any) {
  if (!val) return "—";
  const d = typeof val === "number" ? new Date(val * 1000) : new Date(val);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(val: number | null) {
  if (!val) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function timeAgo(val: any) {
  if (!val) return "—";
  const d = typeof val === "number" ? new Date(val * 1000) : new Date(val);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "Agora";
  if (diff < 60) return `Há ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `Há ${h}h`;
  return `Há ${Math.floor(h / 24)} dias`;
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{Number(value).toFixed(1)}</span>
    </div>
  );
}

export default function OrderDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: order, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/admin/orders", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/orders/${id}`);
      return res.json();
    },
    retry: 2,
    retryDelay: 800,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <p className="text-slate-500 text-sm">Erro ao carregar dados do pedido.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={() => refetch()} size="sm">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const proposals: any[]    = order.proposals    || [];
  const negotiations: any[] = order.negotiations || [];
  const images: any[]       = order.images       || [];
  const chatRooms: any[]    = order.chatRooms    || [];
  const reviews: any[]      = order.reviews      || [];

  const statusInfo    = ORDER_STATUS[order.status] || { label: order.status, color: "bg-slate-100 text-slate-600" };
  const vehicle       = [order.vehicleBrand, order.vehicleModel, order.vehicleYear].filter(Boolean).join(" · ");
  const location      = [order.city, order.state].filter(Boolean).join(", ");
  const acceptedProposal  = proposals.find((p) => p.status === "accepted");
  const pendingProposals  = proposals.filter((p) => p.status === "pending");
  const rejectedProposals = proposals.filter((p) => p.status === "rejected");
  const agreedNeg         = negotiations.find((n) => n.agreedPrice);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0" data-testid="button-order-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight truncate">{order.title}</h1>
            <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
          <p className="text-slate-500 text-sm mt-0.5 font-mono">
            PED-{String(order.id).slice(0, 8).toUpperCase()} · {fmt(order.createdAt)}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Propostas",    value: proposals.length,    icon: MessageSquare, color: "text-blue-600",    bg: "bg-blue-50" },
          { label: "Aceita",       value: acceptedProposal ? "1" : "—", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Negociações",  value: negotiations.length, icon: Handshake,     color: "text-orange-600",  bg: "bg-orange-50" },
          { label: "Conversas",    value: chatRooms.length,    icon: MessageCircle, color: "text-purple-600",  bg: "bg-purple-50" },
          { label: "Valor",        value: agreedNeg ? fmtMoney(agreedNeg.agreedPrice) : "—", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-xl font-bold font-mono">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className="space-y-4">
          {/* Order info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />Dados do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {vehicle && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Car className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{vehicle}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{location}</span>
                </div>
              )}
              {order.client && (
                <div className="flex items-start gap-2 text-slate-600">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{order.client.name}</p>
                    <p className="text-xs text-slate-400">{order.client.email}</p>
                    {order.client.whatsapp && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{order.client.whatsapp}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {order.urgency && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    {order.urgency === "high" ? "Alta urgência" : order.urgency === "medium" ? "Média urgência" : "Baixa urgência"}
                  </span>
                </div>
              )}
              {order.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Descrição</p>
                    <p className="text-slate-600 text-xs leading-relaxed">{order.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          {images.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />Fotos ({images.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((img: any, i: number) => (
                    <div key={i} className="aspect-square bg-slate-100 rounded overflow-hidden">
                      <img src={img.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Negotiations */}
          {negotiations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-orange-500" />
                  Negociações ({negotiations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {negotiations.map((n: any) => {
                  const st = NEG_STATUS[n.status] || { label: n.status, color: "bg-slate-100 text-slate-600" };
                  return (
                    <div key={n.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-muted-foreground" />
                            {n.desmancheName || "—"}
                          </p>
                          {n.desmanchePhone && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />{n.desmanchePhone}
                            </p>
                          )}
                          {n.clientName && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" />{n.clientName}
                              {n.clientEmail && <span className="text-slate-300 ml-0.5">· {n.clientEmail}</span>}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-xs ${st.color}`}>{st.label}</Badge>
                      </div>
                      {n.agreedPrice && (
                        <p className="text-sm font-bold text-emerald-600">{fmtMoney(n.agreedPrice)}</p>
                      )}
                      {n.trackingCode && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {n.trackingCode}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">{fmt(n.createdAt)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Avaliações ({reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviews.map((r: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-600">{r.desmancheName || "Desmanche"}</p>
                      <StarRow value={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-xs text-slate-500 italic">"{r.comment}"</p>
                    )}
                    <p className="text-xs text-slate-400">{fmt(r.createdAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT column: proposals + chat rooms */}
        <div className="lg:col-span-2 space-y-4">
          {/* Accepted proposal highlight */}
          {acceptedProposal && (
            <Card className="border-2 border-green-200 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Proposta Aceita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProposalCard proposal={acceptedProposal} highlight />
              </CardContent>
            </Card>
          )}

          {/* All proposals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Todas as Propostas
                <span className="ml-auto text-xs font-normal text-slate-500">
                  {pendingProposals.length} aguardando · {rejectedProposals.length} recusadas
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Nenhuma proposta recebida ainda.</p>
              ) : (
                <div className="space-y-4">
                  {proposals.map((p: any) => (
                    <ProposalCard key={p.id} proposal={p} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat rooms */}
          {chatRooms.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-purple-500" />
                  Conversas neste Pedido ({chatRooms.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {chatRooms.map((room: any) => (
                  <div key={room.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold flex items-center gap-1">
                            <Store className="h-3.5 w-3.5 text-muted-foreground" />
                            {room.desmancheName || "Desmanche"}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />{room.clientName || "Cliente"}
                          </span>
                        </div>
                      </div>
                      {room.lastMessageAt && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(room.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    {room.lastMessage && (
                      <div className="bg-muted/40 rounded px-3 py-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-400 uppercase text-[10px] mr-1">
                          {room.lastMessage.senderType === "desmanche" ? "Desmanche:" : "Cliente:"}
                        </span>
                        {room.lastMessage.content}
                      </div>
                    )}
                    {!room.lastMessage && (
                      <p className="text-xs text-muted-foreground italic">Sem mensagens registradas.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProposalCard({ proposal: p, highlight }: { proposal: any; highlight?: boolean }) {
  const st = PROPOSAL_STATUS[p.status] || { label: p.status, color: "bg-slate-100 text-slate-600", icon: Clock };
  const StatusIcon = st.icon;

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${highlight ? "border-green-300 bg-green-50/50" : "hover:bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{p.desmanche?.tradingName || p.desmanche?.companyName || "Desmanche"}</span>
            {p.desmanche?.rating != null && (
              <span className="flex items-center gap-0.5 text-xs text-yellow-600 font-medium">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {Number(p.desmanche.rating).toFixed(1)}
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.color}`}>
              <StatusIcon className="h-3 w-3" />
              {st.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {p.desmanche?.phone && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Phone className="h-3 w-3" />{p.desmanche.phone}
              </p>
            )}
            {p.desmanche?.city && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />{[p.desmanche.city, p.desmanche.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-emerald-600">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price)}
          </p>
          <p className="text-xs text-slate-400">{timeAgo(p.createdAt)}</p>
        </div>
      </div>
      {p.message && (
        <div className="bg-white border rounded p-3 text-sm text-slate-700 italic">
          "{p.message}"
        </div>
      )}
      {p.whatsappUnlocked && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded px-2 py-1">
          <Phone className="h-3 w-3" /> WhatsApp desbloqueado pelo cliente
        </div>
      )}
    </div>
  );
}
