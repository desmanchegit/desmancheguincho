import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, CreditCard, TrendingUp, Loader2, Receipt } from "lucide-react";

const TX_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  exempt: "bg-blue-50 text-blue-700 border-blue-200",
  billed: "bg-purple-50 text-purple-700 border-purple-200",
};
const TX_STATUS_LABELS: Record<string, string> = {
  paid: "Pago",
  pending: "Acumulando",
  failed: "Falhou",
  exempt: "Isento",
  billed: "Faturado",
};
const TX_TYPE_LABELS: Record<string, string> = {
  per_transaction: "Por Transação",
  subscription: "Assinatura",
  monthly_cycle: "Ciclo Mensal",
};

export default function FinanceTab() {
  const { data, isLoading } = useQuery<{
    transactions: any[];
    totalPaid: number;
    totalPending: number;
    totalBilled: number;
    plans: any[];
  }>({
    queryKey: ["/api/admin/billing"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/billing");
      return res.json();
    },
  });

  const fmt = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  const fmtDate = (ts: any) => {
    if (!ts) return "—";
    return new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString("pt-BR");
  };

  const transactions = data?.transactions || [];
  const totalPaid = data?.totalPaid || 0;
  const totalPending = data?.totalPending || 0;
  const totalBilled = data?.totalBilled || 0;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Gestão de cobranças e receitas da plataforma.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div data-tour="admin-finance-metrics" className="grid gap-4 md:grid-cols-4">
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-primary">Receita Paga</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{fmt(totalPaid)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total de cobranças pagas</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Faturas Emitidas</CardTitle>
                <CreditCard className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-purple-800">{fmt(totalBilled)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.filter((t) => t.status === "billed").length} op. faturadas aguardando pagamento
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Acumulando (ciclo)</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{fmt(totalPending)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.filter((t) => t.status === "pending").length} operações no ciclo atual
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Operações</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{transactions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.filter((t) => t.status === "exempt").length} isenções registradas
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Receipt className="h-5 w-5 text-slate-500" /> Histórico de Cobranças
              </CardTitle>
              <CardDescription>Todas as transações geradas pela plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Receipt className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p>Nenhuma cobrança ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Desmanche</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((trx: any) => (
                      <TableRow key={trx.id}>
                        <TableCell className="font-medium">
                          {trx.desmanche?.tradingName || trx.desmancheId?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {TX_TYPE_LABELS[trx.type] || trx.type}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm max-w-[200px] truncate">
                          {trx.description || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(trx.createdAt)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {trx.amount === 0 ? "Isento" : fmt(trx.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={TX_STATUS_COLORS[trx.status] || ""}>
                            {TX_STATUS_LABELS[trx.status] || trx.status}
                          </Badge>
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
