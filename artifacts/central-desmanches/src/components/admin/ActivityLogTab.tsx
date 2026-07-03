import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ClipboardList, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  client_registered:       { label: "Cadastro Cliente",        color: "bg-blue-100 text-blue-800 border-blue-200" },
  desmanche_registered:    { label: "Cadastro Desmanche",      color: "bg-purple-100 text-purple-800 border-purple-200" },
  client_login:            { label: "Login Cliente",           color: "bg-slate-100 text-slate-700 border-slate-200" },
  desmanche_login:         { label: "Login Desmanche",         color: "bg-slate-100 text-slate-700 border-slate-200" },
  admin_login:             { label: "Login Admin",             color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  order_created:           { label: "Pedido Criado",           color: "bg-green-100 text-green-800 border-green-200" },
  proposal_sent:           { label: "Proposta Enviada",        color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  proposal_accepted:       { label: "Proposta Aceita",         color: "bg-green-100 text-green-800 border-green-200" },
  proposal_rejected:       { label: "Proposta Rejeitada",      color: "bg-red-100 text-red-800 border-red-200" },
  negotiation_shipped:     { label: "Envio Marcado",           color: "bg-orange-100 text-orange-800 border-orange-200" },
  negotiation_received:    { label: "Recebimento Confirmado",  color: "bg-teal-100 text-teal-800 border-teal-200" },
  review_submitted:        { label: "Avaliação Enviada",       color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  desmanche_approved:      { label: "Desmanche Aprovado",      color: "bg-green-100 text-green-800 border-green-200" },
  desmanche_rejected:      { label: "Desmanche Rejeitado",     color: "bg-red-100 text-red-800 border-red-200" },
  desmanche_status_changed:{ label: "Status Desmanche",        color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  settings_changed:        { label: "Config. Alterada",        color: "bg-pink-100 text-pink-800 border-pink-200" },
};

const ACTOR_LABELS: Record<string, string> = {
  client:    "Cliente",
  desmanche: "Desmanche",
  admin:     "Admin",
  system:    "Sistema",
};

const PAGE_SIZE = 50;

export default function ActivityLogTab() {
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState("all");
  const [filterActor, setFilterActor] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/admin/activity-logs", page, filterAction, filterActor],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterAction !== "all") params.set("action", filterAction);
      if (filterActor !== "all") params.set("actorType", filterActor);
      const res = await apiRequest("GET", `/api/admin/activity-logs?${params}`);
      return res.json();
    },
    staleTime: 30000,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Log de Atividades
              <Badge variant="secondary" className="ml-1">{total} registros</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
              <SelectTrigger className="w-52" data-testid="select-filter-action">
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterActor} onValueChange={(v) => { setFilterActor(v); setPage(0); }}>
              <SelectTrigger className="w-44" data-testid="select-filter-actor">
                <SelectValue placeholder="Filtrar por ator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="desmanche">Desmanche</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma atividade registrada ainda.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data / Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const actionInfo = ACTION_LABELS[log.action];
                    return (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>
                          {actionInfo ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${actionInfo.color}`}>
                              {actionInfo.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{log.action}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium truncate max-w-[140px]">{log.actor_name || "—"}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {ACTOR_LABELS[log.actor_type] ?? log.actor_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          <span className="line-clamp-2">{log.description}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages} — {total} registros
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
