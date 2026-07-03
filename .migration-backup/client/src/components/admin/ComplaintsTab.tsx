import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, MessageSquare, Lightbulb, Flag, Clock, CheckCircle2,
  Eye, EyeOff, Loader2, Filter,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  denuncia:   { label: "Denúncia",  icon: Flag,          color: "bg-red-100 text-red-700 border-red-200" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, color: "bg-orange-100 text-orange-700 border-orange-200" },
  sugestao:   { label: "Sugestão",  icon: Lightbulb,     color: "bg-blue-100 text-blue-700 border-blue-200" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendente",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  reviewing:  { label: "Em análise", color: "bg-blue-100 text-blue-700 border-blue-200" },
  resolved:   { label: "Resolvido",  color: "bg-green-100 text-green-700 border-green-200" },
  dismissed:  { label: "Descartado", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ComplaintsTab() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  const { data: complaints = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/complaints", typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/admin/complaints?${params}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/complaints/${id}`, { status, adminNotes });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      setSelected(null);
      toast({ title: "Atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const pendingCount = complaints.filter((c) => c.status === "pending").length;

  const openDetail = (c: any) => {
    setSelected(c);
    setNewStatus(c.status);
    setNotes(c.admin_notes || "");
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Central de Reclamações</h1>
          <p className="text-muted-foreground">Denúncias, reclamações e sugestões recebidas na plataforma.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
            <Clock className="h-4 w-4 shrink-0" />
            {pendingCount} {pendingCount === 1 ? "item pendente" : "itens pendentes"}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div data-tour="admin-complaints-filters" className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtrar:
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "denuncia", "reclamacao", "sugestao"].map((t) => (
            <Badge
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "Todos os tipos" : TYPE_CONFIG[t]?.label}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "reviewing", "resolved", "dismissed"].map((s) => (
            <Badge
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Todos os status" : STATUS_CONFIG[s]?.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : complaints.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Nenhum registro encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c: any) => {
            const typeConf = TYPE_CONFIG[c.type] || TYPE_CONFIG.reclamacao;
            const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const Icon = typeConf.icon;
            return (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => openDetail(c)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg border shrink-0 ${typeConf.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${typeConf.color}`}>
                            {typeConf.label}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${statusConf.color}`}>
                            {statusConf.label}
                          </Badge>
                          {c.target_type === "listing" && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Anúncio #{c.target_id?.slice(0, 8)}
                            </Badge>
                          )}
                          {c.target_type === "desmanche" && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              Desmanche
                            </Badge>
                          )}
                        </div>
                        <p className="font-semibold text-sm truncate">{c.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Por: <span className="font-medium">{c.author_name || "—"}</span>
                          {" "}&bull;{" "}
                          {c.author_type === "desmanche" ? "Desmanche" : "Cliente"}
                          {" "}&bull;{" "}
                          {formatDate(c.created_at)}
                        </p>
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        {selected && (() => {
          const typeConf = TYPE_CONFIG[selected.type] || TYPE_CONFIG.reclamacao;
          const Icon = typeConf.icon;
          return (
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {typeConf.label}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="font-semibold">{selected.subject}</p>
                  <p className="text-sm text-muted-foreground">{selected.message}</p>
                  {selected.target_description && (
                    <p className={`text-xs border rounded px-2 py-1 ${selected.target_type === "desmanche" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {selected.target_type === "desmanche" ? "Desmanche / Pedido:" : "Alvo:"} {selected.target_description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    De: <b>{selected.author_name}</b> ({selected.author_type === "desmanche" ? "Desmanche" : "Cliente"}) &bull; {formatDate(selected.created_at)}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="reviewing">Em análise</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="dismissed">Descartado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Notas internas (opcional)</label>
                  <Textarea
                    placeholder="Observações sobre este caso..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
                  <Button
                    onClick={() => updateMutation.mutate({ id: selected.id, status: newStatus, adminNotes: notes })}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
