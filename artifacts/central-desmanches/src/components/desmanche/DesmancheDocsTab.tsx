import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck, FileX, ExternalLink, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const DOC_LABELS: Record<string, string> = {
  alvara: "Alvará de Funcionamento",
  credenciamento_detran: "Credenciamento Detran",
  contrato_social: "Contrato Social",
  documento_responsavel: "Documento do Responsável",
  documento_empresa: "Documento da Empresa / Contrato Social",
};

const REQUIRED_DOCS = ["alvara", "documento_responsavel", "documento_empresa"];
const EXPIRY_DOCS = ["alvara", "credenciamento_detran"];
const ALERT_DAYS = 30;

function getDaysUntilExpiry(validUntil: number | null | undefined): number | null {
  if (!validUntil) return null;
  const now = Date.now();
  const expiry = validUntil * 1000;
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
}

function formatDate(validUntil: number | null | undefined): string {
  if (!validUntil) return "";
  return new Date(validUntil * 1000).toLocaleDateString("pt-BR");
}

export default function DesmancheDocsTab() {
  const { user } = useAuth();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["/api/documents/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents?desmancheId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: desmanche } = useQuery({
    queryKey: ["/api/desmanches/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanches/me");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const uploadedTypes = new Set(documents.map((d: any) => d.type));
  const missingRequired = REQUIRED_DOCS.filter((type) => !uploadedTypes.has(type));
  const isFullyComplete = missingRequired.length === 0;

  // Compute expiry alerts
  const expiryAlerts = documents
    .filter((d: any) => EXPIRY_DOCS.includes(d.type) && d.validUntil)
    .map((d: any) => ({ ...d, daysLeft: getDaysUntilExpiry(d.validUntil) }))
    .filter((d: any) => d.daysLeft !== null && d.daysLeft <= ALERT_DAYS);

  const statusInfo = {
    active: { label: "Credenciado", color: "border-2 border-green-200 bg-green-50", badge: "bg-green-600 hover:bg-green-700", icon: CheckCircle2, text: "text-green-900", sub: "text-green-700" },
    pending: { label: "Aguardando Aprovação", color: "border-2 border-amber-200 bg-amber-50", badge: "bg-amber-500 hover:bg-amber-600", icon: AlertCircle, text: "text-amber-900", sub: "text-amber-700" },
    rejected: { label: "Cadastro Rejeitado", color: "border-2 border-red-200 bg-red-50", badge: "bg-red-600 hover:bg-red-700", icon: FileX, text: "text-red-900", sub: "text-red-700" },
    inactive: { label: "Inativo", color: "border-2 border-slate-200 bg-slate-50", badge: "bg-slate-500 hover:bg-slate-600", icon: AlertCircle, text: "text-slate-900", sub: "text-slate-700" },
  };

  const status = desmanche?.status || "pending";
  const info = statusInfo[status as keyof typeof statusInfo] || statusInfo.pending;
  const StatusIcon = info.icon;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Minha Documentação</h1>
        <p className="text-slate-500 mt-1">Mantenha seus documentos em dia para continuar visível na plataforma.</p>
      </div>

      {/* Expiry Alerts */}
      {expiryAlerts.length > 0 && (
        <div className="space-y-3">
          {expiryAlerts.map((doc: any) => (
            <div
              key={doc.id}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                doc.daysLeft < 0
                  ? "bg-red-50 border-red-300 text-red-900"
                  : "bg-orange-50 border-orange-300 text-orange-900"
              }`}
            >
              <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${doc.daysLeft < 0 ? "text-red-600" : "text-orange-500"}`} />
              <div>
                <p className="font-semibold text-sm">
                  {doc.daysLeft < 0
                    ? `⚠️ ${DOC_LABELS[doc.type] || doc.name} — VENCIDO`
                    : `⚠️ ${DOC_LABELS[doc.type] || doc.name} — Vence em ${doc.daysLeft} dia${doc.daysLeft !== 1 ? "s" : ""}`}
                </p>
                <p className={`text-xs mt-0.5 ${doc.daysLeft < 0 ? "text-red-700" : "text-orange-700"}`}>
                  {doc.daysLeft < 0
                    ? `Venceu em ${formatDate(doc.validUntil)}. Renove imediatamente para manter seu credenciamento ativo.`
                    : `Vencimento: ${formatDate(doc.validUntil)}. Renove antes do vencimento para evitar suspensão.`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-tour="desmanche-docs-grid" className="grid md:grid-cols-3 gap-6">
        <Card className={`md:col-span-1 shadow-sm h-fit ${info.color}`}>
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-current shadow-sm">
              <StatusIcon className={`w-8 h-8 ${info.sub}`} />
            </div>
            <h2 className={`text-xl font-bold mb-2 ${info.text}`}>{info.label}</h2>
            {status === "rejected" && desmanche?.rejectionReason && (
              <p className={`text-sm mb-3 ${info.sub}`}>
                Motivo: {desmanche.rejectionReason}
              </p>
            )}
            {status === "pending" && (
              <p className={`text-sm mb-3 ${info.sub}`}>
                Seu cadastro está sendo analisado pela equipe.
              </p>
            )}
            <Badge className={`${info.badge} font-mono text-white`}>
              {isFullyComplete ? `${documents.length} doc${documents.length !== 1 ? "s" : ""} enviado${documents.length !== 1 ? "s" : ""}` : `${missingRequired.length} doc${missingRequired.length !== 1 ? "s" : ""} pendente${missingRequired.length !== 1 ? "s" : ""}`}
            </Badge>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Controle de Documentos</CardTitle>
            <CardDescription>Documentos enviados no seu cadastro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <FileX className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>Nenhum documento encontrado.</p>
              </div>
            )}

            {documents.map((doc: any) => {
              const daysLeft = getDaysUntilExpiry(doc.validUntil);
              const isExpiring = daysLeft !== null && daysLeft <= ALERT_DAYS;
              const isExpired = daysLeft !== null && daysLeft < 0;

              return (
                <div
                  key={doc.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg ${
                    isExpired
                      ? "border-red-200 bg-red-50"
                      : isExpiring
                      ? "border-orange-200 bg-orange-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isExpired ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    ) : isExpiring ? (
                      <Clock className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                    ) : (
                      <FileCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {DOC_LABELS[doc.type] || doc.name || doc.type}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          Enviado
                        </p>
                        {doc.validUntil && (
                          <p className={`text-xs font-medium ${isExpired ? "text-red-600" : isExpiring ? "text-orange-600" : "text-slate-500"}`}>
                            {isExpired
                              ? `Vencido em ${formatDate(doc.validUntil)}`
                              : `Vence em ${formatDate(doc.validUntil)}${daysLeft !== null ? ` (${daysLeft}d)` : ""}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    {isExpired && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">Vencido</Badge>
                    )}
                    {isExpiring && !isExpired && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">A vencer</Badge>
                    )}
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="w-full sm:w-auto gap-1">
                          <ExternalLink className="w-3 h-3" /> Ver Arquivo
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {missingRequired.map((type) => (
              <div
                key={type}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50"
              >
                <div className="flex items-start gap-3">
                  <FileX className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-900">{DOC_LABELS[type]}</h4>
                    <p className="text-xs text-red-600 font-mono mt-1">Documento não enviado</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 mt-2 sm:mt-0">
                  Pendente
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
