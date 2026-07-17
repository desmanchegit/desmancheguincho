import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Truck, Search, CheckCircle, XCircle, Clock, AlertCircle, MapPin, Phone, ChevronRight, RefreshCw, Trash2, Loader2
} from "lucide-react";

type Guincho = {
  id: string;
  name: string;
  trading_name: string;
  document_type?: "cnpj" | "cpf";
  cnpj: string | null;
  cpf?: string | null;
  antt?: string | null;
  email: string;
  phone: string;
  whatsapp: string;
  description: string | null;
  city: string;
  state: string;
  service_radius: number;
  neighborhood: string | null;
  zip_code: string;
  street: string;
  number: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  active: "Ativo",
  rejected: "Reprovado",
  inactive: "Inativo",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  active: "default",
  rejected: "destructive",
  inactive: "outline",
};

function formatCnpj(v: string) {
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatCpf(v: string) {
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function GuinchosTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Guincho | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Guincho | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ guinchos: Guincho[]; total: number }>({
    queryKey: ["/api/admin/guinchos", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await apiRequest("GET", `/api/admin/guinchos?${params}`);
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/guinchos/${id}/status`, { status, rejectionReason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guinchos"] });
      toast({ title: "Status atualizado!" });
      setSelected(null);
      setShowRejectInput(false);
      setRejectReason("");
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteGuincho = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/guinchos/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao excluir guincho");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guinchos"] });
      setDeleteTarget(null);
      setSelected(null);
      toast({ title: "Cadastro do guincho excluído" });
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível excluir", description: err.message, variant: "destructive" });
    },
  });

  const guinchos = (data?.guinchos ?? []).filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.trading_name.toLowerCase().includes(q) ||
      g.city.toLowerCase().includes(q) ||
      (g.cnpj ?? "").includes(q) ||
      (g.cpf ?? "").includes(q)
    );
  });

  const counts = {
    all: data?.total ?? 0,
    pending: (data?.guinchos ?? []).filter((g) => g.status === "pending").length,
    active: (data?.guinchos ?? []).filter((g) => g.status === "active").length,
    rejected: (data?.guinchos ?? []).filter((g) => g.status === "rejected").length,
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelected(null); setShowRejectInput(false); setRejectReason(""); }}
          className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
          ← Voltar à lista
        </button>

        <div className="bg-card border rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{selected.trading_name}</h2>
                <p className="text-sm text-muted-foreground">{selected.name}</p>
              </div>
            </div>
            <Badge variant={STATUS_VARIANTS[selected.status] ?? "outline"}>
              {STATUS_LABELS[selected.status] ?? selected.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {selected.document_type === "cpf" ? "CPF" : "CNPJ"}
              </p>
              <p>
                {selected.document_type === "cpf"
                  ? (selected.cpf ? formatCpf(selected.cpf) : "—")
                  : (selected.cnpj ? formatCnpj(selected.cnpj) : "—")}
              </p>
            </div>
            {selected.antt && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground uppercase">ANTT / RNTRC</p>
                <p>{selected.antt}</p>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">E-mail</p>
              <p>{selected.email}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Telefone</p>
              <p>{selected.phone}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">WhatsApp</p>
              <p>{selected.whatsapp}</p>
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Endereço</p>
              <p>{selected.street}{selected.number ? `, ${selected.number}` : ""}{selected.neighborhood ? ` – ${selected.neighborhood}` : ""}, {selected.city} – {selected.state} ({selected.zip_code})</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Raio de Atendimento</p>
              <p>{selected.service_radius} km</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Cadastro</p>
              <p>{new Date(selected.created_at * 1000).toLocaleDateString("pt-BR")}</p>
            </div>
            {selected.description && (
              <div className="space-y-0.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Descrição</p>
                <p className="text-muted-foreground">{selected.description}</p>
              </div>
            )}
            {selected.rejection_reason && (
              <div className="space-y-0.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Motivo da Reprovação</p>
                <p className="text-destructive text-sm">{selected.rejection_reason}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t flex flex-wrap gap-3">
            {selected.status !== "active" && (
              <Button onClick={() => updateStatus.mutate({ id: selected.id, status: "active" })} disabled={updateStatus.isPending}
                className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprovar
              </Button>
            )}
            {selected.status !== "inactive" && selected.status !== "rejected" && (
              <Button variant="secondary" onClick={() => updateStatus.mutate({ id: selected.id, status: "inactive" })} disabled={updateStatus.isPending}>
                Desativar
              </Button>
            )}
            {selected.status !== "rejected" && (
              !showRejectInput ? (
                <Button variant="destructive" onClick={() => setShowRejectInput(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reprovar
                </Button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Input
                    placeholder="Motivo da reprovação (opcional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="destructive" onClick={() => updateStatus.mutate({ id: selected.id, status: "rejected", rejectionReason: rejectReason || undefined })}
                    disabled={updateStatus.isPending}>
                    Confirmar
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowRejectInput(false); setRejectReason(""); }}>Cancelar</Button>
                </div>
              )
            )}
            {(selected.status === "inactive" || selected.status === "rejected") && (
              <Button variant="outline" onClick={() => updateStatus.mutate({ id: selected.id, status: "pending" })} disabled={updateStatus.isPending}>
                Reenviar para análise
              </Button>
            )}
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(selected)}
              disabled={updateStatus.isPending || deleteGuincho.isPending}
              data-testid={`button-delete-guincho-${selected.id}`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir cadastro
            </Button>
          </div>
        </div>
        <DeleteGuinchoDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => {
          if (deleteTarget) deleteGuincho.mutate(deleteTarget.id);
        }} isDeleting={deleteGuincho.isPending} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Guinchos
          </h2>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} guincho(s) cadastrado(s)</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "active", "rejected", "inactive"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s === "all" ? "Todos" : STATUS_LABELS[s]}
            {s !== "inactive" && <span className="ml-1.5 opacity-70">{s === "all" ? (data?.total ?? 0) : counts[s] ?? 0}</span>}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : guinchos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum guincho encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {guinchos.map((g) => (
            <div
              key={g.id}
              className="w-full bg-card border rounded-xl p-2 flex items-center gap-2 hover:bg-muted/50 transition-colors group"
            >
              <button onClick={() => setSelected(g)} className="flex-1 min-w-0 text-left p-2 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><p className="font-medium truncate">{g.trading_name}</p><Badge variant={STATUS_VARIANTS[g.status] ?? "outline"} className="text-xs shrink-0">{STATUS_LABELS[g.status] ?? g.status}</Badge></div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{g.city} – {g.state}</span><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{g.phone}</span><span>{g.document_type === "cpf" ? (g.cpf ? formatCpf(g.cpf) : "—") : (g.cnpj ? formatCnpj(g.cnpj) : "—")}</span></div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(g)} disabled={deleteGuincho.isPending} data-testid={`button-delete-guincho-row-${g.id}`}><Trash2 className="h-4 w-4" /><span className="sr-only">Excluir guincho</span></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteGuinchoDialog({
  target,
  onClose,
  onConfirm,
  isDeleting,
}: {
  target: Guincho | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cadastro de guincho?</AlertDialogTitle>
          <AlertDialogDescription>
            O cadastro de <strong>{target?.trading_name}</strong> será removido permanentemente. Se houver uma cobrança pendente ou assinatura ativa, ela será cancelada no Asaas antes da exclusão.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
