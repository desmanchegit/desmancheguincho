import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Receipt, Loader2, FileText, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Calendar, Clock, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startDesmancheFinanceTour } from "@/lib/financeTour";

const TX_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  exempt: "bg-blue-50 text-blue-700 border-blue-200",
  billed: "bg-purple-50 text-purple-700 border-purple-200",
};
const TX_STATUS_LABELS: Record<string, string> = {
  pending: "Acumulando",
  paid: "Pago",
  failed: "Falhou",
  exempt: "Isento",
  billed: "Faturado",
};

export default function DesmancheFinanceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: billingData, isLoading } = useQuery<{
    billing: any;
    transactions: any[];
    settings: { capAmount: number; perTxAmount: number };
    asaasConfigured: boolean;
    monthlyProposalCount: number;
    cycleInfo: {
      periodStart: string | null;
      cycleCloseDate: string | null;
      accumulatedAmount: number;
      transactionCount: number;
    } | null;
  }>({
    queryKey: ["/api/billing/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/billing/my");
      return res.json();
    },
  });

  const generateCharge = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/billing/transactions/${txId}/charge`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao gerar cobrança");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/my"] });
      if (data.paymentLink) {
        window.open(data.paymentLink, "_blank");
      } else {
        toast({ title: "Cobrança gerada", description: "Fatura criada no Asaas. O link de pagamento será exibido em breve." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const billing = billingData?.billing;
  const transactions = billingData?.transactions || [];
  const settings = billingData?.settings || { capAmount: 200, perTxAmount: 25 };
  const cycleInfo = billingData?.cycleInfo;
  const isMonthlyCycle = billing?.billingModel === "monthly_cycle";

  const fmt = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  const fmtDate = (ts: any) => {
    if (!ts) return "—";
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    return d.toLocaleDateString("pt-BR");
  };

  const fmtDateFromIso = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
  };

  const getDaysUntilClose = () => {
    if (!cycleInfo?.cycleCloseDate) return null;
    const close = new Date(cycleInfo.cycleCloseDate);
    const now = new Date();
    const diff = Math.ceil((close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const daysUntilClose = getDaysUntilClose();
  const cycleProgress = cycleInfo?.periodStart
    ? Math.min(((30 - (daysUntilClose ?? 30)) / 30) * 100, 100)
    : 0;

  const billedTx = transactions.filter((t) => t.status === "billed");
  const latestBilledWithLink = billedTx.find((t) => t.paymentLink);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Financeiro & Faturas</h1>
          <p className="text-slate-500 mt-1">Visualize seus extratos e o ciclo de cobrança mensal.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => startDesmancheFinanceTour()}
          data-testid="button-start-finance-tour"
        >
          <PlayCircle className="h-4 w-4" />
          Como funciona a cobrança
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Modelo de cobrança */}
          <Card data-tour="finance-model" className="border-2 border-primary/20 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <CreditCard className="w-32 h-32" />
            </div>
            <CardContent className="p-6 sm:p-8 relative z-10">
              <Badge className="mb-3 bg-primary text-primary-foreground">Modelo de Cobrança</Badge>
              <h2 className="text-2xl font-bold text-slate-900">Faturamento Mensal</h2>
              <p className="text-slate-600 mt-2">
                {fmt(settings.perTxAmount)} por negociação concluída, consolidadas em uma única fatura mensal por
                boleto bancário ou PIX. A fatura é gerada automaticamente a cada 30 dias a partir da primeira operação do ciclo.
              </p>
            </CardContent>
          </Card>

          {/* Ciclo atual */}
          {isMonthlyCycle && (
            <Card data-tour="finance-cycle" className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="font-mono text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" /> Ciclo Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!cycleInfo?.periodStart ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Nenhuma operação neste ciclo ainda. O ciclo inicia automaticamente na próxima negociação concluída.</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Início do ciclo</p>
                        <p className="font-semibold">{fmtDateFromIso(cycleInfo.periodStart)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Fechamento previsto</p>
                        <p className="font-semibold">{fmtDateFromIso(cycleInfo.cycleCloseDate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Dias restantes</p>
                        <p className="font-semibold">{daysUntilClose !== null ? `${daysUntilClose} dias` : "—"}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-600">
                          <strong>{cycleInfo.transactionCount}</strong> operação(ões) acumulada(s)
                        </span>
                        <span className="font-semibold text-primary">{fmt(cycleInfo.accumulatedAmount)}</span>
                      </div>
                      <Progress value={cycleProgress} className="h-2" />
                      <p className="text-xs text-slate-400 mt-1">{Math.round(cycleProgress)}% do ciclo de 30 dias concluído</p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-100">
                      No fechamento do ciclo, será gerada uma fatura de <strong>{fmt(cycleInfo.accumulatedAmount)}</strong> com opção de pagamento por <strong>boleto bancário ou PIX</strong>.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fatura consolidada mais recente */}
          {latestBilledWithLink && (
            <Card className="border-purple-200 bg-purple-50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Receipt className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-purple-800">Fatura mensal disponível para pagamento</p>
                    <p className="text-sm text-purple-700 mt-0.5">
                      Total: {fmt(billedTx.filter((t) => t.paymentLink === latestBilledWithLink.paymentLink).reduce((s: number, t: any) => s + t.amount, 0))}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => window.open(latestBilledWithLink.paymentLink, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Pagar fatura (Boleto / PIX)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerta de Asaas não configurado */}
          {!billingData?.asaasConfigured && (
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">Integração de pagamentos não configurada</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      As operações estão sendo registradas. O administrador precisa configurar a chave Asaas para gerar as faturas automaticamente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card data-tour="finance-history" className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-slate-500" /> Histórico de Operações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p>Nenhuma operação registrada ainda.</p>
                  <p className="text-xs mt-1">As operações aparecem quando negociações são concluídas e avaliadas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.description || "Operação"}</TableCell>
                        <TableCell>{fmtDate(tx.createdAt)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {tx.amount === 0 ? "Isento" : fmt(tx.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={TX_STATUS_COLORS[tx.status] || ""}>
                            {TX_STATUS_LABELS[tx.status] || tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.status === "billed" && tx.paymentLink && (
                            <Button size="sm" variant="outline" className="gap-1 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => window.open(tx.paymentLink, "_blank")}>
                              <ExternalLink className="h-3 w-3" /> Pagar
                            </Button>
                          )}
                          {tx.status === "pending" && tx.paymentLink && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(tx.paymentLink, "_blank")}>
                              <ExternalLink className="h-3 w-3" /> Pagar
                            </Button>
                          )}
                          {/* Only per_transaction pending rows without a charge can have individual charge generation */}
                          {tx.status === "pending" && !tx.paymentLink && tx.type !== "monthly_cycle" && billingData?.asaasConfigured && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                              disabled={generateCharge.isPending}
                              onClick={() => generateCharge.mutate(tx.id)}
                            >
                              {generateCharge.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Gerar fatura
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
