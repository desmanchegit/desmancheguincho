import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreateOrderWizard } from "./CreateOrderWizard";
import {
  Plus, Package, Car, MessageSquare, Loader2, Eye, X, AlertTriangle, Clock, Flag, SendHorizonal, ArrowLeft,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open:        { label: "Aberto",     variant: "default" },
  negotiating: { label: "Negociando", variant: "secondary" },
  closed:      { label: "Fechado",    variant: "outline" },
  shipped:     { label: "Enviado",    variant: "secondary" },
  completed:   { label: "Concluído",  variant: "default" },
  cancelled:   { label: "Cancelado",  variant: "destructive" },
  expired:     { label: "Expirado",   variant: "destructive" },
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: "🚗 Carro", motorcycle: "🏍️ Moto", truck: "🚛 Caminhão", bus: "🚌 Ônibus",
  van: "🚐 Van/Utilitário",
  agricultural: "🚜 Trator/Agrícola", other: "🔧 Outro",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "Nova", "used-excellent": "Usada - Ótimo", "used-good": "Usada - Bom", any: "Qualquer",
};

interface OrderImage { id: string; url: string; }
interface OrderItem {
  id: string;
  orderId: string;
  vehicleType?: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlate?: string;
  partCategory?: string;
  partName?: string;
  partPosition?: string;
  partConditionAccepted?: string;
  description?: string;
  status: string;
  images?: OrderImage[];
  proposals?: any[];
}
interface Order {
  id: string;
  title: string;
  description: string;
  vehicleType?: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleEngine?: string;
  partCategory?: string;
  partName?: string;
  partPosition?: string;
  partConditionAccepted?: string;
  clientId: string | null;
  location: string;
  status: string;
  urgency: string;
  isPartnerRequest: boolean;
  expiresAt?: string | number | null;
  createdAt: string;
  images?: OrderImage[];
  proposals?: any[];
  items?: OrderItem[];
}

function expiryLabel(expiresAt: string | number | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = typeof expiresAt === "number" ? expiresAt * 1000 : new Date(expiresAt).getTime();
  const diff = ms - Date.now();
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "< 1h restante";
  if (hours < 24) return `${hours}h restante`;
  const days = Math.floor(hours / 24);
  return `${days}d restante`;
}

export function OrdersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState("all");
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  const [reportSubject, setReportSubject] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [chatDialogOrder, setChatDialogOrder] = useState<Order | null>(null);
  const [chatRoom, setChatRoom] = useState<any | null>(null);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const token = getToken();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/my"],
    queryFn: async () => {
      const res = await fetch("/api/orders/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: preRooms = [] } = useQuery({
    queryKey: ["/api/pre-proposal-chat/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pre-proposal-chat/rooms");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const preRoomsByOrder = (preRooms as any[]).reduce((acc: Record<string, any[]>, r: any) => {
    const key = r.order_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const { data: chatMessages = [], refetch: refetchChatMessages } = useQuery({
    queryKey: ["/api/pre-proposal-chat/messages", chatRoom?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pre-proposal-chat/${chatRoom!.id}/messages`);
      return res.json();
    },
    enabled: !!chatRoom?.id,
    refetchInterval: 5 * 1000,
    staleTime: 0,
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendChatMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/pre-proposal-chat/${chatRoom!.id}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/pre-proposal-chat/messages", chatRoom?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pre-proposal-chat/rooms"] });
      refetchChatMessages();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status: "cancelled" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my"] });
      toast({ title: "Pedido cancelado" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/complaints", {
        type: "denuncia",
        subject: reportSubject.trim(),
        message: reportMessage.trim(),
        targetType: "listing",
        targetId: reportOrder?.id,
        targetDescription: reportOrder?.title,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar");
      }
      return res.json();
    },
    onSuccess: () => {
      setReportOrder(null);
      setReportSubject("");
      setReportMessage("");
      toast({ title: "Denúncia enviada!", description: "Nossa equipe irá analisar." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const formatDate = (d: string) => {
    const date = new Date(typeof d === "number" ? (d as any) * 1000 : d);
    return date.toLocaleDateString("pt-BR");
  };

  const filteredOrders = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Meus Pedidos</h2>
          <p className="text-sm text-muted-foreground">Gerencie seus pedidos de peças</p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all",        label: "Todos" },
          { key: "open",       label: "Abertos" },
          { key: "negotiating",label: "Negociando" },
          { key: "completed",  label: "Concluídos" },
          { key: "cancelled",  label: "Cancelados" },
        ].map((f) => (
          <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Pedido" para solicitar uma peça</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        PED-{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-base">{order.title}</h3>
                      <Badge variant={statusLabels[order.status]?.variant || "outline"}>
                        {statusLabels[order.status]?.label || order.status}
                      </Badge>
                      {order.urgency === "urgent" && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />Urgente
                        </Badge>
                      )}
                      {(order.status === "open" || order.status === "negotiating") && order.expiresAt && (() => {
                        const label = expiryLabel(order.expiresAt);
                        if (!label) return null;
                        const isUrgent = typeof order.expiresAt === "number"
                          ? (order.expiresAt * 1000 - Date.now()) < 6 * 3_600_000
                          : (new Date(order.expiresAt).getTime() - Date.now()) < 6 * 3_600_000;
                        return (
                          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-xs gap-1">
                            <Clock className="h-3 w-3" />{label}
                          </Badge>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                      {order.vehicleType && (
                        <span>{VEHICLE_TYPE_LABELS[order.vehicleType] || order.vehicleType}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" />
                        {order.vehicleBrand} {order.vehicleModel} {order.vehicleYear}
                      </span>
                      {order.partPosition && <span>{order.partPosition}</span>}
                      <span>{formatDate(order.createdAt)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {order.partCategory && <Badge variant="outline" className="text-xs">{order.partCategory}</Badge>}
                      {order.partConditionAccepted && order.partConditionAccepted !== "any" && (
                        <Badge variant="outline" className="text-xs">{CONDITION_LABELS[order.partConditionAccepted] || order.partConditionAccepted}</Badge>
                      )}
                      {order.images && order.images.length > 0 && (
                        <Badge variant="outline" className="text-xs">📷 {order.images.length} foto(s)</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <span className="text-sm flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {order.proposals?.length || 0} proposta(s)
                      </span>
                      {order.items && order.items.length > 1 && (
                        <span className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {order.items.length} peças
                        </span>
                      )}
                      {(() => {
                        const rooms = preRoomsByOrder[order.id] || [];
                        if (rooms.length === 0) return null;
                        const totalUnread = rooms.reduce((s: number, r: any) => s + (r.unread_count || 0), 0);
                        return (
                          <button
                            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatDialogOrder(order);
                              setChatRoom(rooms.length === 1 ? rooms[0] : null);
                              setChatInput("");
                            }}
                            data-testid={`button-pre-chat-order-${order.id}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {rooms.length} desmanche{rooms.length > 1 ? "s" : ""} quer{rooms.length > 1 ? "em" : ""} conversar
                            {totalUnread > 0 && (
                              <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0 h-4">
                                {totalUnread}
                              </Badge>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {order.vehicleBrand && (
                      <BrandLogo brand={order.vehicleBrand} size={44} />
                    )}
                    <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-4 w-4 mr-1" /> Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      title="Denunciar este pedido"
                      onClick={() => { setReportOrder(order); setReportSubject(""); setReportMessage(""); }}
                      data-testid={`button-report-${order.id}`}
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                    {order.status === "open" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate(order.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order detail dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOrder?.title}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={statusLabels[selectedOrder.status]?.variant || "outline"}>
                  {statusLabels[selectedOrder.status]?.label}
                </Badge>
                {selectedOrder.urgency === "urgent" && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgente</Badge>}
              </div>

              {/* Multi-item display if order has multiple items */}
              {selectedOrder.items && selectedOrder.items.length > 1 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Peças neste pedido ({selectedOrder.items.length})
                  </p>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={item.id} className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {idx + 1}. {item.vehicleType && `${VEHICLE_TYPE_LABELS[item.vehicleType] || item.vehicleType} — `}{item.vehicleBrand} {item.vehicleModel} {item.vehicleYear}
                        </p>
                        <Badge variant={statusLabels[item.status]?.variant || "outline"} className="text-xs">
                          {statusLabels[item.status]?.label || item.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {item.partCategory && <DetailRow label="Categoria" value={item.partCategory} />}
                        {item.partName && <DetailRow label="Peça" value={item.partName} />}
                        {item.partPosition && <DetailRow label="Posição" value={item.partPosition} />}
                      </div>
                      {item.images && item.images.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {item.images.map((img) => (
                            <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                              <img src={img.url} alt="" className="rounded w-12 h-12 object-cover border hover:opacity-90 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      )}
                      {item.proposals && item.proposals.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{item.proposals.length} proposta(s) recebida(s)</p>
                          {item.proposals.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                              <span className="font-medium">{p.desmanche?.tradingName || "Desmanche"} — R$ {p.price?.toFixed(2)}</span>
                              <Badge variant={p.status === "sent" ? "outline" : p.status === "accepted" ? "default" : "destructive"} className="text-xs">
                                {p.status === "sent" ? "Enviada" : p.status === "accepted" ? "Aceita" : "Rejeitada"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Vehicle */}
                  <div className="rounded-xl border p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Veículo</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedOrder.vehicleType && <DetailRow label="Tipo" value={VEHICLE_TYPE_LABELS[selectedOrder.vehicleType]} />}
                      <DetailRow label="Marca" value={selectedOrder.vehicleBrand} />
                      <DetailRow label="Modelo" value={selectedOrder.vehicleModel} />
                      <DetailRow label="Ano" value={String(selectedOrder.vehicleYear)} />
                      {selectedOrder.vehicleColor && <DetailRow label="Cor" value={selectedOrder.vehicleColor} />}
                      {selectedOrder.vehicleEngine && <DetailRow label="Motor" value={selectedOrder.vehicleEngine} />}
                      {selectedOrder.vehiclePlate && <DetailRow label="Placa" value={selectedOrder.vehiclePlate} />}
                    </div>
                  </div>

                  {/* Part */}
                  <div className="rounded-xl border p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Peça</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedOrder.partCategory && <DetailRow label="Categoria" value={selectedOrder.partCategory} />}
                      {selectedOrder.partName && <DetailRow label="Peça" value={selectedOrder.partName} />}
                      {selectedOrder.partPosition && <DetailRow label="Posição" value={selectedOrder.partPosition} />}
                      {selectedOrder.partConditionAccepted && selectedOrder.partConditionAccepted !== "any" && (
                        <DetailRow label="Condição aceita" value={CONDITION_LABELS[selectedOrder.partConditionAccepted] || selectedOrder.partConditionAccepted} />
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedOrder.description && selectedOrder.description !== selectedOrder.title && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                      <p className="text-sm">{selectedOrder.description}</p>
                    </div>
                  )}

                  {/* Photos */}
                  {selectedOrder.images && selectedOrder.images.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fotos ({selectedOrder.images.length})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedOrder.images.map((img) => (
                          <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                            <img src={img.url} alt="" className="rounded-lg w-full aspect-square object-cover border hover:opacity-90 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Proposals */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Propostas Recebidas ({selectedOrder.proposals?.length || 0})
                    </p>
                    {selectedOrder.proposals && selectedOrder.proposals.length > 0 ? (
                      <div className="space-y-3">
                        {selectedOrder.proposals.map((p: any) => (
                          <Card key={p.id}>
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">{p.desmanche?.tradingName || "Desmanche"}</p>
                                  <p className="text-sm text-muted-foreground">{p.message}</p>
                                  <p className="font-bold text-green-600 mt-1">R$ {p.price?.toFixed(2)}</p>
                                </div>
                                <Badge variant={p.status === "sent" ? "outline" : p.status === "accepted" ? "default" : "destructive"}>
                                  {p.status === "sent" ? "Enviada" : p.status === "accepted" ? "Aceita" : p.status === "rejected" ? "Rejeitada" : p.status}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma proposta recebida ainda.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-proposal chat dialog */}
      <Dialog
        open={!!chatDialogOrder}
        onOpenChange={(v) => {
          if (!v) { setChatDialogOrder(null); setChatRoom(null); setChatInput(""); }
        }}
      >
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              {chatRoom
                ? `Conversa com ${chatRoom.desmanche_name || "Desmanche"}`
                : `Conversas — ${chatDialogOrder?.title}`}
            </DialogTitle>
          </DialogHeader>
          {chatDialogOrder && !chatRoom && (
            <div className="space-y-2 overflow-y-auto flex-1">
              <p className="text-xs text-muted-foreground">
                Selecione qual desmanche deseja responder:
              </p>
              {(preRoomsByOrder[chatDialogOrder.id] || []).map((room: any) => (
                <button
                  key={room.id}
                  className="w-full text-left rounded-xl border p-3 hover:bg-blue-50 transition-colors"
                  onClick={() => { setChatRoom(room); setChatInput(""); }}
                  data-testid={`button-select-chat-room-${room.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{room.desmanche_name || "Desmanche"}</span>
                    {room.unread_count > 0 && (
                      <Badge className="bg-blue-500 text-white text-xs">{room.unread_count} nova(s)</Badge>
                    )}
                  </div>
                  {room.last_message && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{room.last_message}</p>
                  )}
                </button>
              ))}
            </div>
          )}
          {chatDialogOrder && chatRoom && (
            <div className="flex flex-col flex-1 min-h-0 gap-2">
              {(preRoomsByOrder[chatDialogOrder.id] || []).length > 1 && (
                <button
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit"
                  onClick={() => { setChatRoom(null); setChatInput(""); }}
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar à lista
                </button>
              )}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-xl min-h-[200px] max-h-[320px]"
              >
                {(chatMessages as any[]).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6 italic">Nenhuma mensagem ainda.</p>
                )}
                {(chatMessages as any[]).map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === "client" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm leading-snug ${
                        msg.sender_type === "client"
                          ? "bg-primary text-white rounded-br-none"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-center pt-1">
                <Input
                  placeholder="Responder..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                      e.preventDefault();
                      sendChatMutation.mutate(chatInput.trim());
                    }
                  }}
                  className="flex-1 h-9"
                  data-testid="input-client-chat-message"
                />
                <Button
                  size="sm"
                  className="h-9 px-3"
                  disabled={!chatInput.trim() || sendChatMutation.isPending}
                  onClick={() => sendChatMutation.mutate(chatInput.trim())}
                  data-testid="button-client-chat-send"
                >
                  {sendChatMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <SendHorizonal className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wizard */}
      <CreateOrderWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => setShowWizard(false)}
      />

      {/* Denunciar Dialog */}
      <Dialog open={!!reportOrder} onOpenChange={(v) => !v && setReportOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Flag className="h-5 w-5" /> Fazer Denúncia
            </DialogTitle>
          </DialogHeader>
          {reportOrder && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Pedido: <span className="font-medium text-foreground">{reportOrder.title}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Assunto <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ex: Proposta com preço abusivo"
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  data-testid="input-report-subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Detalhes <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Descreva o ocorrido com detalhes..."
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  rows={4}
                  data-testid="textarea-report-message"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReportOrder(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => reportMutation.mutate()}
                  disabled={!reportSubject.trim() || !reportMessage.trim() || reportMutation.isPending}
                  data-testid="button-report-submit"
                >
                  {reportMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
                    : <><Flag className="h-4 w-4 mr-2" />Enviar Denúncia</>
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
