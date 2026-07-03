import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, FileCheck, XCircle, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const REQUIRED_DOCS = [
  { type: "alvara", label: "Alvará de Funcionamento" },
  { type: "documento_responsavel", label: "Documento do Responsável" },
  { type: "documento_empresa", label: "Documento da Empresa / Contrato Social" },
];

export default function ApprovalsTab() {
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch both "pending" (first submission) and "resubmitted" (after corrections)
  const { data: pendingDesmanches = [], isLoading: loadingPending } = useQuery({
    queryKey: ["/api/admin/desmanches", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/desmanches?status=pending");
      return res.json();
    },
  });

  const { data: resubmittedDesmanches = [], isLoading: loadingResubmitted } = useQuery({
    queryKey: ["/api/admin/desmanches", "resubmitted"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/desmanches?status=resubmitted");
      return res.json();
    },
  });

  const isLoading = loadingPending || loadingResubmitted;

  // Resubmitted ones go first so admin can prioritize corrections
  const desmanches = [
    ...(resubmittedDesmanches as any[]).map((d: any) => ({ ...d, _isResubmitted: true })),
    ...(pendingDesmanches as any[]).map((d: any) => ({ ...d, _isResubmitted: false })),
  ];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/desmanches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/site-stats/real"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/desmanches/${id}/status`, { status: "active" });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Desmanche aprovado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      await apiRequest("PATCH", `/api/admin/desmanches/${id}/status`, { status: "rejected", rejectionReason });
    },
    onSuccess: () => {
      invalidateAll();
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectionReason("");
      toast({ title: "Desmanche rejeitado." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    },
  });

  const handleRejectClick = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (rejectingId !== null && rejectionReason.trim()) {
      rejectMutation.mutate({ id: rejectingId, rejectionReason: rejectionReason.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-tour="admin-approvals-content" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-xl">
        <div>
          <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-600 mb-2 border-none">Atenção Requerida</Badge>
          <h1 className="text-3xl font-bold font-mono tracking-tight text-yellow-950 dark:text-yellow-500">Aprovações de Credenciamento</h1>
          <p className="text-yellow-800 dark:text-yellow-200 mt-1">
            {desmanches.length > 0
              ? `${desmanches.length} desmanche(s) aguardando validação${resubmittedDesmanches.length > 0 ? ` — ${resubmittedDesmanches.length} com correções reenviadas` : ""}.`
              : "Nenhum desmanche aguardando aprovação no momento."}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {desmanches.map((desmanche: any) => {
          const docs = desmanche.documents || [];
          const uploadedTypes = docs.map((d: any) => d.type);
          const uploadedDocs = REQUIRED_DOCS.filter((rd) => uploadedTypes.includes(rd.type));
          const missingDocs = REQUIRED_DOCS.filter((rd) => !uploadedTypes.includes(rd.type));
          const isResubmitted = desmanche._isResubmitted;

          return (
            <Card
              key={desmanche.id}
              className={`border-2 shadow-sm ${isResubmitted ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30" : "border-border"}`}
            >
              <CardHeader className="bg-muted/30 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isResubmitted ? (
                      <Badge className="bg-blue-600 text-white border-none flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Correções Reenviadas
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={missingDocs.length > 0 ? "text-red-500 border-red-200" : "text-blue-500 border-blue-200"}>
                        {missingDocs.length > 0 ? "Falta Documento" : "Aguardando Análise"}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{desmanche.tradingName || desmanche.companyName}</CardTitle>
                  <CardDescription className="font-mono mt-1">CNPJ: {desmanche.cnpj}</CardDescription>
                  {desmanche.responsibleName && (
                    <CardDescription className="mt-1">Responsável: {desmanche.responsibleName}</CardDescription>
                  )}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRejectClick(desmanche.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approveMutation.mutate(desmanche.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    Aprovar Credencial
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Correction note from desmanche if this is a resubmission */}
                {isResubmitted && desmanche.rejectionReason && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Observação do desmanche sobre as correções
                    </p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{desmanche.rejectionReason}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <FileCheck className="h-4 w-4" /> Documentos Enviados ({uploadedDocs.length}/{REQUIRED_DOCS.length})
                    </h4>
                    <ul className="space-y-2">
                      {docs.map((doc: any) => (
                        <li key={doc.id} className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded border">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          {doc.name || REQUIRED_DOCS.find((rd) => rd.type === doc.type)?.label || doc.type}
                          {doc.url && doc.url.startsWith("/uploads/") ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-blue-500 hover:underline">
                              Ver PDF
                            </a>
                          ) : doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-blue-500 hover:underline">
                              Ver Documento
                            </a>
                          ) : null}
                        </li>
                      ))}
                      {uploadedDocs.length === 0 && (
                        <li className="text-sm text-muted-foreground">Nenhum documento enviado.</li>
                      )}
                    </ul>
                  </div>

                  {missingDocs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-2">
                        <FileWarning className="h-4 w-4" /> Documentos Pendentes
                      </h4>
                      <ul className="space-y-2">
                        {missingDocs.map((doc) => (
                          <li key={doc.type} className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-100 dark:border-red-900 text-red-800 dark:text-red-400">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {doc.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Credenciamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da rejeição e o que o desmanche deve corrigir. Esta mensagem será exibida diretamente no painel do desmanche.
            </p>
            <Textarea
              placeholder="Ex: O alvará de funcionamento está ilegível. Por favor, reenvie uma versão clara e atualizada. Também é necessário que o CPF no documento do responsável corresponda ao informado no cadastro."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
