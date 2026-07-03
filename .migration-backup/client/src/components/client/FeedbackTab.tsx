import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Lightbulb, MessageSquare, CheckCircle2, Clock,
  Loader2, Plus, ChevronDown, ChevronUp, Store, FileText,
} from "lucide-react";

const TYPE_OPTIONS = [
  {
    value: "sugestao",
    label: "Sugestão",
    icon: Lightbulb,
    desc: "Mande sua ideia para melhorar a plataforma",
    color: "border-blue-300 bg-blue-50 text-blue-700",
  },
  {
    value: "reclamacao",
    label: "Reclamação",
    icon: AlertTriangle,
    desc: "Problema com desmanche, pedido ou plataforma",
    color: "border-orange-300 bg-orange-50 text-orange-700",
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pendente",   color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  reviewing: { label: "Em análise", color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Clock },
  resolved:  { label: "Resolvido",  color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle2 },
  dismissed: { label: "Descartado", color: "bg-gray-100 text-gray-500 border-gray-200",       icon: CheckCircle2 },
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const NONE = "__none__";

export function FeedbackTab() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [subject, setSubject]     = useState("");
  const [message, setMessage]     = useState("");
  const [selectedOrderId, setSelectedOrderId]       = useState<string>("");
  const [selectedDesmancheId, setSelectedDesmancheId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: myComplaints = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/complaints/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/complaints/my");
      return res.json();
    },
  });

  const { data: interactions } = useQuery<{ desmanches: any[]; orders: any[] }>({
    queryKey: ["/api/complaints/my-desmanches"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/complaints/my-desmanches");
      if (!res.ok) return { desmanches: [], orders: [] };
      return res.json();
    },
    enabled: selectedType === "reclamacao",
    staleTime: 30000,
  });

  const allDesmanches: any[] = interactions?.desmanches ?? [];
  const allOrders: any[]     = interactions?.orders ?? [];

  // When an order is selected, filter desmanches to those related to that order
  const filteredDesmanches: any[] = selectedOrderId && selectedOrderId !== NONE
    ? allDesmanches.filter((d) => d.orderIds?.includes(selectedOrderId))
    : allDesmanches;

  const selectedDesmanche = allDesmanches.find((d) => d.id === selectedDesmancheId);
  const selectedOrder = allOrders.find((o) => o.id === selectedOrderId);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        type: selectedType,
        subject: subject.trim(),
        message: message.trim(),
        targetType: selectedType === "reclamacao" && (selectedDesmancheId || selectedOrderId) ? "desmanche" : "general",
      };

      if (selectedType === "reclamacao") {
        if (selectedDesmancheId && selectedDesmancheId !== NONE) {
          body.desmancheId = selectedDesmancheId;
          const namePart = selectedDesmanche?.tradingName || selectedDesmanche?.companyName || "Desmanche";
          body.targetDescription = selectedOrder ? `${namePart} — ${selectedOrder.title}` : namePart;
        }
        if (selectedOrderId && selectedOrderId !== NONE) {
          body.targetId = selectedOrderId;
          if (!body.targetDescription) {
            body.targetDescription = selectedOrder?.title || "Pedido";
          }
        }
      }

      const res = await apiRequest("POST", "/api/complaints", body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints/my"] });
      setSelectedType(null);
      setSubject("");
      setMessage("");
      setSelectedOrderId("");
      setSelectedDesmancheId("");
      toast({ title: "Enviado com sucesso!", description: "Nossa equipe analisará em breve." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = selectedType && subject.trim() && message.trim();

  return (
    <div className="space-y-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Enviar Sugestão ou Reclamação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>O que você quer enviar? <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSelectedType(opt.value);
                      setSelectedOrderId("");
                      setSelectedDesmancheId("");
                    }}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      isSelected ? `${opt.color} border-current` : "border-muted hover:border-primary/30"
                    }`}
                    data-testid={`btn-type-${opt.value}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-sm">{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desmanche + Order association — only for reclamação */}
          {selectedType === "reclamacao" && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                <Store className="h-4 w-4" />
                Associar a um Pedido e/ou Desmanche <span className="font-normal text-orange-600">(opcional)</span>
              </div>

              {/* Order dropdown */}
              <div className="space-y-1.5">
                <Label className="text-orange-900 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Meu pedido
                </Label>
                {allOrders.length === 0 ? (
                  <p className="text-xs text-orange-700 italic">Nenhum pedido encontrado.</p>
                ) : (
                  <Select
                    value={selectedOrderId}
                    onValueChange={(v) => {
                      setSelectedOrderId(v);
                      // reset desmanche if it's no longer in filtered list
                      if (v !== NONE) {
                        const stillValid = allDesmanches.find(
                          (d) => d.id === selectedDesmancheId && d.orderIds?.includes(v)
                        );
                        if (!stillValid) setSelectedDesmancheId("");
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-order" className="bg-white">
                      <SelectValue placeholder="Selecione um pedido..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum pedido específico</SelectItem>
                      {allOrders.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Desmanche dropdown */}
              <div className="space-y-1.5">
                <Label className="text-orange-900 flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Desmanche envolvido
                  {selectedOrderId && selectedOrderId !== NONE && filteredDesmanches.length < allDesmanches.length && (
                    <span className="text-xs font-normal text-orange-600 ml-1">(filtrado pelo pedido)</span>
                  )}
                </Label>
                {allDesmanches.length === 0 ? (
                  <p className="text-xs text-orange-700 italic">
                    Nenhum desmanche encontrado. Assim que um desmanche enviar proposta no seu pedido, ele aparecerá aqui.
                  </p>
                ) : (
                  <Select
                    value={selectedDesmancheId}
                    onValueChange={setSelectedDesmancheId}
                  >
                    <SelectTrigger data-testid="select-desmanche" className="bg-white">
                      <SelectValue placeholder="Selecione um desmanche..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum desmanche específico</SelectItem>
                      {filteredDesmanches.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.tradingName || d.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-subject">
              Assunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fb-subject"
              placeholder={
                selectedType === "sugestao"
                  ? "Ex: Melhorar filtro de busca"
                  : "Ex: Desmanche não respondeu após negociação"
              }
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-fb-subject"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="fb-message">
              Mensagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="fb-message"
              placeholder="Descreva com detalhes o que aconteceu..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="textarea-fb-message"
            />
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full"
            data-testid="button-fb-submit"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" />Enviar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Meus Envios</h2>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : myComplaints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Você ainda não enviou nenhum item.
          </div>
        ) : (
          myComplaints.map((c: any) => {
            const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === c.id;
            const typeLabel =
              c.type === "sugestao"
                ? "Sugestão"
                : c.type === "reclamacao"
                ? "Reclamação"
                : "Denúncia";

            return (
              <Card key={c.id} className="overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusConf.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{c.subject}</p>
                    {c.target_description && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Store className="h-3 w-3" /> {c.target_description}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t bg-muted/20">
                    <p className="text-sm text-muted-foreground pt-3">{c.message}</p>
                    {c.admin_notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                        <span className="font-semibold">Resposta da equipe:</span> {c.admin_notes}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
