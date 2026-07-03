import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Loader2, Package, Clock, RefreshCw, Car, Wrench, AlertTriangle, CheckCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { CreateOrderWizard } from "@/components/client/CreateOrderWizard";
import { BrandLogo } from "@/components/ui/BrandLogo";

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: "Carro", motorcycle: "Moto", truck: "Caminhão", bus: "Ônibus",
  van: "Van/Utilitário", agricultural: "Trator/Agrícola", other: "Outro",
};

function formatExpiry(expiresAt: string | null | undefined): { label: string; urgent: boolean } {
  if (!expiresAt) return { label: "—", urgent: false };
  const now = Date.now();
  const exp = typeof expiresAt === "number" ? expiresAt * 1000 : new Date(expiresAt).getTime();
  const diffMs = exp - now;
  if (diffMs <= 0) return { label: "Expirado", urgent: true };
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / (1000 * 60));
    return { label: `Expira em ${diffM}min`, urgent: true };
  }
  if (diffH < 24) return { label: `Expira em ${diffH}h`, urgent: diffH < 4 };
  const diffD = Math.floor(diffH / 24);
  return { label: `Expira em ${diffD} dia${diffD !== 1 ? "s" : ""}`, urgent: false };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = typeof dateStr === "number" ? new Date((dateStr as any) * 1000) : new Date(dateStr);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays} dias`;
}

export default function DesmancheAdsTab() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<"active" | "disabled">("active");
  const [showWizard, setShowWizard] = useState(false);

  const { data: allAds = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/orders/my-ads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders/my-ads");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 0,
  });

  const reactivateMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/reactivate`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao reativar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anúncio reativado!", description: "Seu anúncio voltou ao mural por mais 3 dias." });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-ads"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const activeAds = allAds.filter((a) => a.status !== "expired" && a.status !== "cancelled");
  const disabledAds = allAds.filter((a) => a.status === "expired" || a.status === "cancelled");

  const displayed = subTab === "active" ? activeAds : disabledAds;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Meus Anúncios</h1>
          <p className="text-slate-500 mt-1">Gerencie as peças que você oferece no mural.</p>
        </div>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={() => setShowWizard(true)}
        >
          <Plus className="h-4 w-4" />
          Publicar Anúncio
        </Button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("active")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === "active"
              ? "bg-primary text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Ativos
          {activeAds.length > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${subTab === "active" ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
              {activeAds.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("disabled")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === "disabled"
              ? "bg-slate-700 text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Desativados
          {disabledAds.length > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${subTab === "disabled" ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
              {disabledAds.length}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
          <Package className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          {subTab === "active" ? (
            <>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Nenhum anúncio ativo</h3>
              <p className="text-slate-500 mb-4">Publique suas peças para aparecer no mural dos clientes.</p>
              <Button onClick={() => setShowWizard(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Publicar Primeiro Anúncio
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Nenhum anúncio desativado</h3>
              <p className="text-slate-500">Anúncios que expirarem aparecerão aqui para reativação.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {displayed.map((ad: any) => {
            const expiry = formatExpiry(ad.expiresAt);
            const vehicle = [
              VEHICLE_TYPE_LABELS[ad.vehicleType] || ad.vehicleType,
              ad.vehicleBrand,
              ad.vehicleModel,
              ad.vehicleYear,
            ].filter(Boolean).join(" • ");

            return (
              <Card key={ad.id} className={`border transition-all ${subTab === "disabled" ? "opacity-70 bg-slate-50" : "bg-white hover:shadow-md"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          #{ad.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px] py-0 px-2">Parceiro</Badge>
                        {ad.urgency === "urgent" && (
                          <Badge className="bg-red-500 text-[10px] py-0 px-2 gap-1">
                            <AlertTriangle className="h-3 w-3" /> URGENTE
                          </Badge>
                        )}
                        {subTab === "active" ? (
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            expiry.urgent ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                          }`}>
                            <Clock className="h-3 w-3" />
                            {expiry.label}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Expirado • {timeAgo(ad.updatedAt || ad.createdAt)}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{ad.title}</h3>

                      {vehicle && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                          <Car className="h-3.5 w-3.5 text-slate-400" />
                          {vehicle}
                        </div>
                      )}

                      {ad.partName && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                          <Wrench className="h-3.5 w-3.5 text-slate-400" />
                          {ad.partCategory ? `${ad.partCategory} — ` : ""}{ad.partName}
                          {ad.partPosition ? ` (${ad.partPosition})` : ""}
                        </div>
                      )}

                      <div className="text-xs text-slate-400 mt-1">
                        Publicado {timeAgo(ad.createdAt)} • {ad.proposals?.length || 0} proposta{(ad.proposals?.length || 0) !== 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {ad.vehicleBrand && (
                        <BrandLogo brand={ad.vehicleBrand} size={52} />
                      )}
                      {subTab === "disabled" && (
                        <Button
                          size="sm"
                          className="gap-2 bg-primary hover:bg-primary/90"
                          onClick={() => reactivateMutation.mutate(ad.id)}
                          disabled={reactivateMutation.isPending}
                        >
                          {reactivateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Reativar Anúncio
                        </Button>
                      )}
                      {subTab === "active" && (
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          No ar
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateOrderWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          queryClient.invalidateQueries({ queryKey: ["/api/orders/my-ads"] });
        }}
        isDesmancheAd
      />
    </div>
  );
}
