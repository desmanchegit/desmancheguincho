import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FileBarChart2, Download, Store, Package, Users, DollarSign, Loader2, RefreshCw
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  open: "Em Aberto",
  negotiating: "Em Negociação",
  completed: "Concluído",
  shipped: "Enviado",
  cancelled: "Cancelado",
  expired: "Expirado",
  closed: "Fechado",
  active: "Ativo",
  pending: "Pendente",
  inactive: "Inativo",
  rejected: "Rejeitado",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  open: "#22c55e",
  negotiating: "#eab308",
  completed: "#10b981",
  shipped: "#3b82f6",
  cancelled: "#ef4444",
  expired: "#94a3b8",
};

const DESMANCHE_STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  pending: "#eab308",
  inactive: "#94a3b8",
  rejected: "#ef4444",
};

function SummaryCard({ title, value, sub, icon, color }: { title: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="shadow-sm border border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function RelatóriosTab() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", refreshKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard/stats");
      return res.json();
    },
  });

  const { data: realStats, isLoading: realLoading } = useQuery({
    queryKey: ["/api/site-stats/real", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/site-stats/real");
      return res.json();
    },
  });

  const { data: desmanches = [], isLoading: desmanchesLoading } = useQuery({
    queryKey: ["/api/admin/desmanches", refreshKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/desmanches");
      return res.json();
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/admin/orders", refreshKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/orders");
      return res.json();
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users", refreshKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  const isLoading = statsLoading || realLoading || desmanchesLoading || ordersLoading || usersLoading;

  const ordersByStatus = Object.entries(
    (orders as any[]).reduce<Record<string, number>>((acc, o: any) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, label: STATUS_LABELS[status] || status, count }));

  const desmanchesByStatus = Object.entries(
    (desmanches as any[]).reduce<Record<string, number>>((acc, d: any) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, label: STATUS_LABELS[status] || status, count }));

  const usersByType = Object.entries(
    (users as any[]).reduce((acc: Record<string, number>, u: any) => {
      const key = u.type === "client" ? "Cliente" : u.type === "admin" ? "Admin" : u.type;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ type, count }));

  const handleExportCSV = () => {
    const rows = [
      ["Tipo", "Métrica", "Valor"],
      ["Geral", "Total de Usuários", stats?.totalUsers ?? 0],
      ["Geral", "Desmanches Ativos", stats?.activeDesmanches ?? 0],
      ["Geral", "Total de Pedidos", stats?.totalOrders ?? 0],
      ["Geral", "Aprovações Pendentes", stats?.pendingApprovals ?? 0],
      ["Geral", "Clientes Cadastrados", realStats?.clientsTotal ?? 0],
      ["Geral", "Negociações Ativas", realStats?.activeNegotiations ?? 0],
      ["Geral", "Pedidos Hoje", realStats?.ordersToday ?? 0],
      ...ordersByStatus.map(o => ["Pedidos por Status", o.label, o.count]),
      ...desmanchesByStatus.map(d => ["Desmanches por Status", d.label, d.count]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_central_desmanches_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-tour="admin-reports-content" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart2 className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold font-mono tracking-tight">Relatórios</h1>
          </div>
          <p className="text-muted-foreground">Métricas consolidadas da plataforma Central dos Desmanches.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total de Usuários"
              value={stats?.totalUsers ?? 0}
              sub="Clientes + Admins cadastrados"
              icon={<Users className="h-4 w-4 text-white" />}
              color="bg-blue-500"
            />
            <SummaryCard
              title="Desmanches Ativos"
              value={stats?.activeDesmanches ?? 0}
              sub={`${stats?.pendingApprovals ?? 0} aguardando aprovação`}
              icon={<Store className="h-4 w-4 text-white" />}
              color="bg-green-500"
            />
            <SummaryCard
              title="Total de Pedidos"
              value={stats?.totalOrders ?? 0}
              sub={`${realStats?.ordersToday ?? 0} criados hoje`}
              icon={<Package className="h-4 w-4 text-white" />}
              color="bg-purple-500"
            />
            <SummaryCard
              title="Negociações Ativas"
              value={realStats?.activeNegotiations ?? 0}
              sub="Em andamento no momento"
              icon={<DollarSign className="h-4 w-4 text-white" />}
              color="bg-amber-500"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="font-mono text-base">Pedidos por Status</CardTitle>
                <CardDescription>Distribuição de todos os pedidos cadastrados</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersByStatus.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado.</p>
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByStatus} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Pedidos">
                          {ordersByStatus.map((entry) => (
                            <Cell key={entry.status} fill={ORDER_STATUS_COLORS[entry.status] || "hsl(var(--primary))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="font-mono text-base">Desmanches por Status</CardTitle>
                <CardDescription>Composição do cadastro de desmanches</CardDescription>
              </CardHeader>
              <CardContent>
                {desmanchesByStatus.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum desmanche encontrado.</p>
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={desmanchesByStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={75} label={({ label, count }) => `${label}: ${count}`} labelLine={false} fontSize={11}>
                          {desmanchesByStatus.map((entry) => (
                            <Cell key={entry.status} fill={DESMANCHE_STATUS_COLORS[entry.status] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="font-mono text-base">Resumo por Status</CardTitle>
              <CardDescription>Tabela consolidada de todas as métricas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Usuários</TableCell>
                    <TableCell className="text-muted-foreground">Total de usuários (clientes + admins)</TableCell>
                    <TableCell className="text-right font-mono font-bold">{stats?.totalUsers ?? 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Desmanches</TableCell>
                    <TableCell className="text-muted-foreground">Total de desmanches cadastrados</TableCell>
                    <TableCell className="text-right font-mono font-bold">{stats?.totalDesmanches ?? 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Desmanches</TableCell>
                    <TableCell><Badge className="bg-green-500/10 text-green-700 border-green-200">Ativos</Badge></TableCell>
                    <TableCell className="text-right font-mono font-bold">{stats?.activeDesmanches ?? 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Desmanches</TableCell>
                    <TableCell><Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">Pendentes (aguardando aprovação)</Badge></TableCell>
                    <TableCell className="text-right font-mono font-bold">{stats?.pendingApprovals ?? 0}</TableCell>
                  </TableRow>
                  {desmanchesByStatus.filter(d => d.status === "rejected").map(d => (
                    <TableRow key="rejected">
                      <TableCell className="font-medium">Desmanches</TableCell>
                      <TableCell><Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-200">Rejeitados</Badge></TableCell>
                      <TableCell className="text-right font-mono font-bold">{d.count}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Pedidos</TableCell>
                    <TableCell className="text-muted-foreground">Total de pedidos criados</TableCell>
                    <TableCell className="text-right font-mono font-bold">{stats?.totalOrders ?? 0}</TableCell>
                  </TableRow>
                  {ordersByStatus.map(o => (
                    <TableRow key={o.status}>
                      <TableCell className="font-medium text-muted-foreground pl-8">↳ {o.label}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">Pedidos com status "{o.label}"</TableCell>
                      <TableCell className="text-right font-mono">{o.count}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Atividade</TableCell>
                    <TableCell className="text-muted-foreground">Pedidos criados hoje</TableCell>
                    <TableCell className="text-right font-mono font-bold">{realStats?.ordersToday ?? 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Atividade</TableCell>
                    <TableCell className="text-muted-foreground">Negociações ativas agora</TableCell>
                    <TableCell className="text-right font-mono font-bold">{realStats?.activeNegotiations ?? 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
