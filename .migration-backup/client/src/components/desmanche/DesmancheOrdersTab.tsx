import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  MapPin, Search, Loader2, PackageSearch, SendHorizonal,
  Car, Wrench, Clock, AlertTriangle, Eye, ChevronRight, ImageIcon, User2,
  SlidersHorizontal, X, ChevronDown, ChevronUp, Zap, Palette, MessageSquare,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { BrandLogo } from "@/components/ui/BrandLogo";

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: "Carro", motorcycle: "Moto", truck: "Caminhão", bus: "Ônibus",
  van: "Van/Utilitário",
  agricultural: "Trator/Agrícola", other: "Outro",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "Nova", "used-excellent": "Usada - Ótimo Estado", "used-good": "Usada - Bom Estado", any: "Qualquer condição",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  return `Há ${diffDays} dias`;
}

const EMPTY_FILTERS = {
  brand: "",
  vehicleType: "",
  partCategory: "",
  color: "",
  yearFrom: "",
  yearTo: "",
  urgentOnly: false,
};

export default function DesmancheOrdersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [proposalForm, setProposalForm] = useState({ price: "", message: "" });
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showPreChat, setShowPreChat] = useState(false);
  const [preChatInput, setPreChatInput] = useState("");
  const [localRoomId, setLocalRoomId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { data: desmanche } = useQuery({
    queryKey: ["/api/desmanches/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanches/me");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 60 * 1000,
  });

  const desmancheVehicleTypes: string[] = (() => {
    try { return JSON.parse(desmanche?.vehicleTypes || "[]"); } catch { return []; }
  })();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders?status=open");
      return res.json();
    },
    enabled: !!getToken(),
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const { data: myProposals = [] } = useQuery({
    queryKey: ["/api/proposals/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/proposals?desmancheId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Only "sent" proposals count as "already sent" (revision_requested go back to the edit form)
  const proposedOrderIds = new Set(myProposals.filter((p: any) => !p.orderItemId && p.status === "sent").map((p: any) => p.orderId));
  const proposedItemIds = new Set(myProposals.filter((p: any) => p.orderItemId && p.status === "sent").map((p: any) => p.orderItemId));

  // Find a proposal needing revision for the selected order
  const revisionProposal = selectedOrder
    ? myProposals.find((p: any) => {
        const matchesItem = selectedOrder.isOrderItem && p.orderItemId === selectedOrder.id;
        const matchesOrder = !selectedOrder.isOrderItem && p.orderId === selectedOrder.orderId && !p.orderItemId;
        return (matchesItem || matchesOrder) && p.status === "revision_requested";
      })
    : null;

  const { data: preRooms = [] } = useQuery({
    queryKey: ["/api/pre-proposal-chat/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pre-proposal-chat/rooms");
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const preChatRoom = selectedOrder
    ? (preRooms as any[]).find((r: any) => {
        if (selectedOrder.isOrderItem) return r.order_item_id === selectedOrder.id;
        return r.order_id === selectedOrder.orderId && !r.order_item_id;
      })
    : null;

  const effectiveRoomId = localRoomId || preChatRoom?.id || null;

  const { data: preChatMessages = [], refetch: refetchPreChat } = useQuery({
    queryKey: ["/api/pre-proposal-chat/messages", effectiveRoomId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pre-proposal-chat/${effectiveRoomId}/messages`);
      return res.json();
    },
    enabled: !!effectiveRoomId && showPreChat,
    refetchInterval: 5 * 1000,
    staleTime: 0,
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [preChatMessages]);

  const sendPreChatMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!effectiveRoomId) {
        const clientId = selectedOrder?.client?.id;
        if (!clientId) throw new Error("Cliente não identificado");
        const res = await apiRequest("POST", "/api/pre-proposal-chat/start", {
          orderId: selectedOrder.orderId,
          orderItemId: selectedOrder.isOrderItem ? selectedOrder.id : undefined,
          clientId,
          content,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/pre-proposal-chat/${effectiveRoomId}/messages`, { content });
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      if (!effectiveRoomId && data?.room?.id) {
        setLocalRoomId(data.room.id);
      }
      setPreChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/pre-proposal-chat/rooms"] });
      refetchPreChat();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
    },
  });

  // Flatten orders to individual items (new multi-item architecture + legacy compat)
  const flatItems = useMemo(() => {
    return (orders as any[]).flatMap((order: any) => {
      if (order.items && order.items.length > 0) {
        return order.items
          .filter((item: any) => item.status === "open" || item.status === "has_proposals")
          .map((item: any) => ({
            ...item,
            orderId: order.id,
            isOrderItem: true,
            urgency: order.urgency,
            location: order.location,
            city: order.city,
            state: order.state,
            client: order.client,
            postedByType: order.postedByType,
            // Use item-level proposals if present, otherwise order-level
            proposals: item.proposals?.length ? item.proposals : order.proposals,
          }));
      }
      return [{ ...order, orderId: order.id, isOrderItem: false }];
    });
  }, [orders]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    flatItems.forEach((o: any) => { if (o.vehicleBrand) set.add(o.vehicleBrand); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flatItems]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    flatItems.forEach((o: any) => { if (o.partCategory) set.add(o.partCategory); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flatItems]);

  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    flatItems.forEach((o: any) => { if (o.vehicleColor) set.add(o.vehicleColor); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flatItems]);

  const activeFilterCount = [
    filters.brand, filters.vehicleType, filters.partCategory, filters.color,
    filters.yearFrom, filters.yearTo,
  ].filter(Boolean).length + (filters.urgentOnly ? 1 : 0);

  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string | boolean) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters({ ...EMPTY_FILTERS });

  const sendProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/proposals", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proposta enviada!", description: "O cliente será notificado da sua proposta." });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals/my"] });
      setShowProposalForm(false);
      setProposalForm({ price: "", message: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar proposta", description: error.message, variant: "destructive" });
    },
  });

  const reviseProposalMutation = useMutation({
    mutationFn: async ({ proposalId, price, message }: { proposalId: string; price: string; message: string }) => {
      const res = await apiRequest("PATCH", `/api/proposals/${proposalId}/revise`, { price: parseFloat(price), message });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proposta revisada!", description: "O cliente será notificado da nova proposta." });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals/my"] });
      setProposalForm({ price: "", message: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao revisar proposta", description: error.message, variant: "destructive" });
    },
  });

  const handleSendProposal = async () => {
    if (!selectedOrder || !user?.id) return;
    await sendProposalMutation.mutateAsync({
      orderId: selectedOrder.orderId,
      orderItemId: selectedOrder.isOrderItem ? selectedOrder.id : undefined,
      desmancheId: user.id,
      price: parseFloat(proposalForm.price),
      message: proposalForm.message,
    });
  };

  const filtered = flatItems.filter((o: any) => {
    if (o.desmancheId === user?.id) return false;
    if (desmancheVehicleTypes.length > 0 && o.vehicleType && !desmancheVehicleTypes.includes(o.vehicleType)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        o.title?.toLowerCase().includes(q) ||
        o.vehicleBrand?.toLowerCase().includes(q) ||
        o.vehicleModel?.toLowerCase().includes(q) ||
        o.partName?.toLowerCase().includes(q) ||
        o.partCategory?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filters.brand && o.vehicleBrand?.toLowerCase() !== filters.brand.toLowerCase()) return false;
    if (filters.vehicleType && o.vehicleType !== filters.vehicleType) return false;
    if (filters.partCategory && o.partCategory !== filters.partCategory) return false;
    if (filters.color && !o.vehicleColor?.toLowerCase().includes(filters.color.toLowerCase())) return false;
    if (filters.yearFrom && Number(o.vehicleYear) < Number(filters.yearFrom)) return false;
    if (filters.yearTo && Number(o.vehicleYear) > Number(filters.yearTo)) return false;
    if (filters.urgentOnly && o.urgency !== "urgent") return false;
    return true;
  });

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setShowProposalForm(false);
    setProposalForm({ price: "", message: "" });
    setShowPreChat(false);
    setPreChatInput("");
    setLocalRoomId(null);
  };

  const alreadySentForSelected = selectedOrder
    ? (selectedOrder.isOrderItem ? proposedItemIds.has(selectedOrder.id) : proposedOrderIds.has(selectedOrder.orderId))
    : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Mural de Pedidos</h1>
        <p className="text-slate-500 mt-1">Veja o que clientes estão procurando e envie sua proposta.</p>
      </div>

      {/* Search + Filters toolbar */}
      <div data-tour="desmanche-orders-search" className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por peça, marca, modelo..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="gap-2 h-9 px-4 shrink-0"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-white text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-9 text-slate-500 gap-1 px-3" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
            <span className="text-sm text-slate-500 shrink-0 ml-1">
              {filtered.length} peça{filtered.length !== 1 ? "s" : ""} solicitada{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Marca */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Car className="h-3.5 w-3.5" /> Marca
                </Label>
                <div className="relative">
                  <input
                    list="brands-list"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ex: Volkswagen, Honda..."
                    value={filters.brand}
                    onChange={(e) => setFilter("brand", e.target.value)}
                  />
                  {filters.brand && (
                    <button
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      onClick={() => setFilter("brand", "")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <datalist id="brands-list">
                  {uniqueBrands.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>

              {/* Tipo de Veículo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Car className="h-3.5 w-3.5" /> Tipo de Veículo
                </Label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filters.vehicleType}
                  onChange={(e) => setFilter("vehicleType", e.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Categoria de Peça */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Categoria da Peça
                </Label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filters.partCategory}
                  onChange={(e) => setFilter("partCategory", e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Cor */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Palette className="h-3.5 w-3.5" /> Cor do Veículo
                </Label>
                <div className="relative">
                  <input
                    list="colors-list"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ex: Preto, Branco, Prata..."
                    value={filters.color}
                    onChange={(e) => setFilter("color", e.target.value)}
                  />
                  {filters.color && (
                    <button
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      onClick={() => setFilter("color", "")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <datalist id="colors-list">
                  {uniqueColors.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Ano De */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Ano — De / Até
                </Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min="1950"
                    max="2030"
                    placeholder="De"
                    className="bg-white text-center"
                    value={filters.yearFrom}
                    onChange={(e) => setFilter("yearFrom", e.target.value)}
                  />
                  <span className="text-slate-400 shrink-0">–</span>
                  <Input
                    type="number"
                    min="1950"
                    max="2030"
                    placeholder="Até"
                    className="bg-white text-center"
                    value={filters.yearTo}
                    onChange={(e) => setFilter("yearTo", e.target.value)}
                  />
                </div>
              </div>

              {/* Somente Urgentes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> Urgência
                </Label>
                <button
                  type="button"
                  onClick={() => setFilter("urgentOnly", !filters.urgentOnly)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    filters.urgentOnly
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white border-input text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {filters.urgentOnly ? "✓ Somente Urgentes" : "Mostrar todos"}
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500 self-center">Filtros ativos:</span>
                {filters.brand && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    Marca: {filters.brand}
                    <button onClick={() => setFilter("brand", "")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filters.vehicleType && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    {VEHICLE_TYPE_LABELS[filters.vehicleType]}
                    <button onClick={() => setFilter("vehicleType", "")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filters.partCategory && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    {filters.partCategory}
                    <button onClick={() => setFilter("partCategory", "")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filters.color && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    Cor: {filters.color}
                    <button onClick={() => setFilter("color", "")}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {(filters.yearFrom || filters.yearTo) && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    Ano: {filters.yearFrom || "?"} – {filters.yearTo || "?"}
                    <button onClick={() => { setFilter("yearFrom", ""); setFilter("yearTo", ""); }}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filters.urgentOnly && (
                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    Somente Urgentes
                    <button onClick={() => setFilter("urgentOnly", false)}><X className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
          <PackageSearch className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">Nenhum pedido aberto no momento</h3>
          <p className="text-slate-500">Novos pedidos aparecerão aqui assim que forem criados.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order: any) => {
            const alreadySent = order.isOrderItem ? proposedItemIds.has(order.id) : proposedOrderIds.has(order.orderId);
            const vehicle = [
              VEHICLE_TYPE_LABELS[order.vehicleType] || order.vehicleType,
              order.vehicleBrand,
              order.vehicleModel,
              order.vehicleYear,
            ].filter(Boolean).join(" • ");
            const location = [order.city, order.state].filter(Boolean).join(", ");

            return (
              <Card
                key={order.id}
                className="overflow-hidden hover:shadow-md hover:border-primary/30 transition-all border-slate-200 bg-white cursor-pointer"
                onClick={() => openDetail(order)}
              >
                <CardContent className="p-0 sm:flex">
                  <div className="p-5 sm:w-2/3 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        PED-{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      {order.postedByType === "desmanche" && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] py-0 px-2">
                          Parceiro
                        </Badge>
                      )}
                      {order.urgency === "urgent" && (
                        <Badge className="bg-red-500 hover:bg-red-600 text-[10px] py-0 px-2 gap-1">
                          <AlertTriangle className="h-3 w-3" /> URGENTE
                        </Badge>
                      )}
                      {alreadySent && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                          ✓ Proposta Enviada
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 leading-tight mb-1">{order.title}</h3>

                    {vehicle && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-2">
                        <Car className="h-4 w-4 text-slate-400" />
                        {vehicle}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {order.partCategory && (
                        <Badge variant="secondary" className="text-xs">{order.partCategory}</Badge>
                      )}
                      {order.partConditionAccepted && order.partConditionAccepted !== "any" && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          {CONDITION_LABELS[order.partConditionAccepted] || order.partConditionAccepted}
                        </Badge>
                      )}
                      {order.images?.length > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ImageIcon className="h-3 w-3" /> {order.images.length} foto{order.images.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      {location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {timeAgo(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:w-1/3 flex flex-col justify-center items-start sm:items-end gap-3 border-t sm:border-t-0 sm:border-l border-slate-100 bg-slate-50">
                    {order.vehicleBrand && (
                      <BrandLogo brand={order.vehicleBrand} size={56} />
                    )}
                    <div className="text-center sm:text-right">
                      <div className="text-2xl font-bold text-primary">{order.proposals?.length || 0}</div>
                      <div className="text-xs text-slate-500">proposta{(order.proposals?.length || 0) !== 1 ? "s" : ""} enviada{(order.proposals?.length || 0) !== 1 ? "s" : ""}</div>
                    </div>
                    <Button
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2"
                      onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                    >
                      <Eye className="h-4 w-4" />
                      Ver Pedido Completo
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setShowProposalForm(false); setProposalForm({ price: "", message: "" }); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    #{selectedOrder.id.slice(0, 8).toUpperCase()}
                  </span>
                  {selectedOrder.postedByType === "desmanche" && (
                    <Badge className="bg-amber-500 text-xs">Parceiro</Badge>
                  )}
                  {selectedOrder.urgency === "urgent" && (
                    <Badge className="bg-red-500 text-xs gap-1">
                      <AlertTriangle className="h-3 w-3" /> URGENTE
                    </Badge>
                  )}
                  {alreadySentForSelected && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      ✓ Proposta já enviada
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl">{selectedOrder.title}</DialogTitle>
                {selectedOrder.description && selectedOrder.description !== selectedOrder.title && (
                  <DialogDescription className="text-slate-600 text-sm mt-1">
                    {selectedOrder.description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Vehicle Info */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Car className="h-4 w-4" /> Dados do Veículo
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {selectedOrder.vehicleType && (
                      <div><span className="text-slate-500">Tipo:</span> <span className="font-medium">{VEHICLE_TYPE_LABELS[selectedOrder.vehicleType] || selectedOrder.vehicleType}</span></div>
                    )}
                    {selectedOrder.vehicleBrand && (
                      <div><span className="text-slate-500">Marca:</span> <span className="font-medium">{selectedOrder.vehicleBrand}</span></div>
                    )}
                    {selectedOrder.vehicleModel && (
                      <div><span className="text-slate-500">Modelo:</span> <span className="font-medium">{selectedOrder.vehicleModel}</span></div>
                    )}
                    {selectedOrder.vehicleYear && (
                      <div><span className="text-slate-500">Ano:</span> <span className="font-medium">{selectedOrder.vehicleYear}</span></div>
                    )}
                    {selectedOrder.vehicleColor && (
                      <div><span className="text-slate-500">Cor:</span> <span className="font-medium">{selectedOrder.vehicleColor}</span></div>
                    )}
                    {selectedOrder.vehicleEngine && (
                      <div><span className="text-slate-500">Motor:</span> <span className="font-medium">{selectedOrder.vehicleEngine}</span></div>
                    )}
                    {selectedOrder.vehiclePlate && (
                      <div><span className="text-slate-500">Placa:</span> <span className="font-medium">{selectedOrder.vehiclePlate}</span></div>
                    )}
                  </div>
                </div>

                {/* Part Info */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-blue-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Wrench className="h-4 w-4" /> Peça Solicitada
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {selectedOrder.partCategory && (
                      <div><span className="text-slate-500">Categoria:</span> <span className="font-medium">{selectedOrder.partCategory}</span></div>
                    )}
                    {selectedOrder.partName && (
                      <div><span className="text-slate-500">Peça:</span> <span className="font-medium">{selectedOrder.partName}</span></div>
                    )}
                    {selectedOrder.partPosition && (
                      <div><span className="text-slate-500">Posição:</span> <span className="font-medium">{selectedOrder.partPosition}</span></div>
                    )}
                    {selectedOrder.partConditionAccepted && selectedOrder.partConditionAccepted !== "any" && (
                      <div><span className="text-slate-500">Condição aceita:</span> <span className="font-medium">{CONDITION_LABELS[selectedOrder.partConditionAccepted] || selectedOrder.partConditionAccepted}</span></div>
                    )}
                  </div>
                </div>

                {/* Photos */}
                {selectedOrder.images?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <ImageIcon className="h-4 w-4" /> Fotos do Cliente ({selectedOrder.images.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.images.map((img: any) => (
                        <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                          <img
                            src={img.url}
                            alt="foto do pedido"
                            className="h-24 w-24 rounded-lg object-cover border border-slate-200 hover:opacity-90 hover:scale-105 transition-all"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Info (masked) */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <User2 className="h-4 w-4" /> Informações do Cliente
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div>
                      <span className="text-slate-500">Nome:</span>{" "}
                      <span className="font-medium">
                        {selectedOrder.client?.name
                          ? selectedOrder.client.name.split(" ")[0]
                          : "Cliente verificado"}
                      </span>
                    </div>
                    {(selectedOrder.city || selectedOrder.state) && (
                      <div>
                        <span className="text-slate-500">Localização:</span>{" "}
                        <span className="font-medium">
                          {[selectedOrder.city, selectedOrder.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Pedido em:</span>{" "}
                      <span className="font-medium">{timeAgo(selectedOrder.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Propostas recebidas:</span>{" "}
                      <span className="font-medium">{selectedOrder.proposals?.length || 0}</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mt-2 bg-amber-100 rounded px-2 py-1">
                    🔒 Contato completo (telefone e WhatsApp) é liberado após o cliente aceitar sua proposta.
                  </p>
                </div>

                {/* Pre-proposal chat */}
                <div className="space-y-2">
                  {!showPreChat ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 h-11"
                      onClick={() => setShowPreChat(true)}
                      data-testid="button-pre-proposal-chat"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {preChatRoom
                        ? `Ver conversa com ${selectedOrder.client?.name?.split(" ")[0] || "o cliente"}`
                        : "Quero falar com o cliente primeiro"}
                      {preChatRoom && preChatRoom.unread_count > 0 && (
                        <Badge className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0">
                          {preChatRoom.unread_count}
                        </Badge>
                      )}
                    </Button>
                  ) : (
                    <div className="border border-blue-200 rounded-xl overflow-hidden">
                      <div className="bg-blue-50 px-3 py-2 flex items-center justify-between border-b border-blue-100">
                        <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Conversa com {selectedOrder.client?.name?.split(" ")[0] || "o cliente"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-500 hover:text-blue-700"
                          onClick={() => setShowPreChat(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div
                        ref={chatScrollRef}
                        className="max-h-52 overflow-y-auto p-3 space-y-2 bg-white"
                      >
                        {(preChatMessages as any[]).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-6 italic">
                            Nenhuma mensagem ainda. Inicie a conversa!
                          </p>
                        )}
                        {(preChatMessages as any[]).map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_type === "desmanche" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm leading-snug ${
                                msg.sender_type === "desmanche"
                                  ? "bg-primary text-white rounded-br-none"
                                  : "bg-slate-100 text-slate-800 rounded-bl-none"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-blue-100 p-2 bg-white flex gap-2 items-center">
                        <Input
                          placeholder="Digite uma mensagem..."
                          value={preChatInput}
                          onChange={(e) => setPreChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && preChatInput.trim()) {
                              e.preventDefault();
                              sendPreChatMutation.mutate(preChatInput.trim());
                            }
                          }}
                          className="flex-1 h-8 text-sm"
                          data-testid="input-pre-chat-message"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          disabled={!preChatInput.trim() || sendPreChatMutation.isPending}
                          onClick={() => sendPreChatMutation.mutate(preChatInput.trim())}
                          data-testid="button-pre-chat-send"
                        >
                          {sendPreChatMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <SendHorizonal className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Proposal Form or Already Sent */}
                {revisionProposal ? (
                  /* Revision requested by client — show edit form */
                  <div className="space-y-4 bg-orange-50 rounded-lg p-4 border border-orange-300">
                    <div>
                      <h4 className="font-semibold text-orange-800 flex items-center gap-2 mb-1">
                        ↩ O cliente solicitou revisão desta proposta
                      </h4>
                      <p className="text-xs text-orange-600">
                        Proposta anterior: R$ {revisionProposal.price?.toFixed(2)} — "{revisionProposal.message}"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-price">Novo valor da peça (R$) <span className="text-red-500">*</span></Label>
                      <Input
                        id="rev-price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={revisionProposal.price?.toFixed(2) || "Ex: 350,00"}
                        value={proposalForm.price}
                        onChange={(e) => setProposalForm({ ...proposalForm, price: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-msg">Nova mensagem para o cliente <span className="text-red-500">*</span></Label>
                      <textarea
                        id="rev-msg"
                        className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[110px] resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                        placeholder="Descreva a condição da peça, procedência, garantia, prazo de envio..."
                        value={proposalForm.message}
                        onChange={(e) => setProposalForm({ ...proposalForm, message: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
                      onClick={() => reviseProposalMutation.mutate({ proposalId: revisionProposal.id, price: proposalForm.price || String(revisionProposal.price), message: proposalForm.message || revisionProposal.message })}
                      disabled={reviseProposalMutation.isPending}
                      data-testid="button-revise-proposal"
                    >
                      {reviseProposalMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Enviando revisão...</>
                      ) : (
                        <><SendHorizonal className="h-4 w-4" /> Reenviar Proposta Revisada</>
                      )}
                    </Button>
                  </div>
                ) : alreadySentForSelected ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-green-700 font-semibold mb-1">✓ Proposta já enviada para este pedido</div>
                    <p className="text-sm text-green-600">Aguarde o cliente revisar as propostas recebidas.</p>
                  </div>
                ) : !showProposalForm ? (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white gap-2 h-12 text-base"
                    onClick={() => setShowProposalForm(true)}
                  >
                    <SendHorizonal className="h-5 w-5" />
                    Enviar Proposta para este Pedido
                  </Button>
                ) : (
                  <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <SendHorizonal className="h-4 w-4 text-primary" /> Sua Proposta
                    </h4>
                    <div className="space-y-2">
                      <Label htmlFor="prop-price">Valor da peça (R$) <span className="text-red-500">*</span></Label>
                      <Input
                        id="prop-price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ex: 350,00"
                        value={proposalForm.price}
                        onChange={(e) => setProposalForm({ ...proposalForm, price: e.target.value })}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prop-msg">Mensagem para o cliente <span className="text-red-500">*</span></Label>
                      <textarea
                        id="prop-msg"
                        className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[110px] resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                        placeholder="Descreva a condição da peça, procedência, garantia, prazo de envio, se tem foto disponível..."
                        value={proposalForm.message}
                        onChange={(e) => setProposalForm({ ...proposalForm, message: e.target.value })}
                      />
                      <p className="text-xs text-slate-500">Após o cliente aceitar sua proposta, você poderá continuar a negociação e trocar contatos pelo WhatsApp.</p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setShowProposalForm(false); setProposalForm({ price: "", message: "" }); }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                        onClick={handleSendProposal}
                        disabled={!proposalForm.price || !proposalForm.message || sendProposalMutation.isPending}
                      >
                        {sendProposalMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                        ) : (
                          <><SendHorizonal className="h-4 w-4" /> Confirmar e Enviar</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
