import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { Users, Store, Package, AlertCircle, ArrowUpRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const revenueData = [
  { name: 'Jan', total: 45000 },
  { name: 'Fev', total: 52000 },
  { name: 'Mar', total: 48000 },
  { name: 'Abr', total: 61000 },
  { name: 'Mai', total: 59000 },
  { name: 'Jun', total: 72000 },
  { name: 'Jul', total: 84000 },
];

const reqData = [
  { time: '08:00', requests: 120 },
  { time: '10:00', requests: 250 },
  { time: '12:00', requests: 410 },
  { time: '14:00', requests: 380 },
  { time: '16:00', requests: 520 },
  { time: '18:00', requests: 480 },
];

function MetricCard({ title, value, trend, icon, isLoading }: any) {
  return (
    <Card className="shadow-sm border border-border/50 hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-bold font-mono">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {trend}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function OverviewTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard/stats");
      return res.json();
    },
  });

  const { data: pendingDesmanches, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin", "desmanches", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/desmanches?status=pending");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight">Painel de Controle</h1>
          <p className="text-muted-foreground">Acompanhe aqui as negociações em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate?.('reports')}>Gerar Relatório</Button>
        </div>
      </div>

      <div data-tour="admin-overview-metrics" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total de Usuários" 
          value={stats?.totalUsers ?? 0}
          trend="Usuários cadastrados na plataforma"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard 
          title="Desmanches Ativos" 
          value={stats?.activeDesmanches ?? 0}
          trend="Desmanches aprovados e ativos"
          icon={<Store className="h-4 w-4 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard 
          title="Total de Pedidos" 
          value={stats?.totalOrders ?? 0}
          trend="Pedidos criados na plataforma"
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard 
          title="Aprovações Pendentes" 
          value={stats?.pendingApprovals ?? 0}
          trend="Desmanches aguardando aprovação"
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4 border-2 shadow-sm">
          <CardHeader>
            <CardTitle className="font-mono">Volume de Negociações x Receita</CardTitle>
            <CardDescription>Crescimento mensal da plataforma (2024)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-2 shadow-sm">
          <CardHeader>
            <CardTitle className="font-mono flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Pedidos de Peças (Hoje)
            </CardTitle>
            <CardDescription>Fluxo de solicitações nas últimas horas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reqData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="requests" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="font-mono text-xl">Aprovações Pendentes (Desmanches)</CardTitle>
            <CardDescription>Empresas aguardando validação para entrar na rede.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => onNavigate?.('approvals')}>
            Ver Todas <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !pendingDesmanches?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma aprovação pendente.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDesmanches.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.tradingName || d.companyName || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.cnpj || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.responsibleName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-medium">Pendente</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => onNavigate?.('approvals')}>Revisar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
