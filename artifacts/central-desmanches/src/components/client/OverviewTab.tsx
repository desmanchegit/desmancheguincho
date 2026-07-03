import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  MessageSquare,
  Handshake,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Clock,
} from "lucide-react";

interface OverviewTabProps {
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { user } = useAuth();
  const token = getToken();

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/my"],
    queryFn: async () => {
      const res = await fetch("/api/orders/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: negotiations = [] } = useQuery<any[]>({
    queryKey: ["/api/negotiations/my"],
    queryFn: async () => {
      const res = await fetch("/api/negotiations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token,
  });

  const openOrders = orders.filter((o) => o.status === "open").length;
  const totalProposals = orders.reduce((sum, o) => sum + (o.proposals?.length || 0), 0);
  const pendingProposals = orders.reduce(
    (sum, o) => sum + (o.proposals?.filter((p: any) => p.status === "sent").length || 0),
    0
  );
  const activeNegotiations = negotiations.filter(
    (n) => !["completed", "cancelled"].includes(n.status)
  ).length;
  const completedNegotiations = negotiations.filter((n) => n.status === "completed").length;

  return (
    <div className="space-y-6">
      {!user?.profileComplete && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Complete seu perfil para começar
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Informe seu WhatsApp e endereço para criar pedidos e negociar.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => onNavigate("profile")}>
                Completar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("orders")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("orders")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openOrders}</p>
                <p className="text-xs text-muted-foreground">Em aberto</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("proposals")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <MessageSquare className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingProposals}</p>
                <p className="text-xs text-muted-foreground">Propostas pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("negotiations")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Handshake className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeNegotiations}</p>
                <p className="text-xs text-muted-foreground">Negociações ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Pedidos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhum pedido ainda</p>
                <Button size="sm" className="mt-2" onClick={() => onNavigate("orders")}>
                  Criar Pedido
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{order.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.vehicleBrand} {order.vehicleModel} - {order.proposals?.length || 0} proposta(s)
                      </p>
                    </div>
                    <Badge variant={order.status === "open" ? "default" : "secondary"} className="text-xs">
                      {order.status === "open" ? "Aberto" : order.status === "negotiating" ? "Negociando" : order.status}
                    </Badge>
                  </div>
                ))}
                {orders.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("orders")}>
                    Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Handshake className="h-4 w-4" /> Negociações Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {negotiations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Nenhuma negociação ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Aceite propostas para iniciar negociações</p>
              </div>
            ) : (
              <div className="space-y-3">
                {negotiations
                  .filter((n: any) => !["completed", "cancelled"].includes(n.status))
                  .slice(0, 5)
                  .map((neg: any) => (
                    <div key={neg.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{neg.order?.title || "Pedido"}</p>
                        <p className="text-xs text-muted-foreground">
                          {neg.desmanche?.tradingName} - R$ {neg.price.toFixed(2)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {neg.status === "negotiating" ? "Negociando" : neg.status === "shipped" ? "Enviado" : neg.status}
                      </Badge>
                    </div>
                  ))}
                {negotiations.filter((n: any) => !["completed", "cancelled"].includes(n.status)).length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("negotiations")}>
                    Ver todas <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {completedNegotiations > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold">{completedNegotiations} negociação(ões) concluída(s)</p>
                <p className="text-sm text-muted-foreground">Obrigado por usar a Central dos Desmanches!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
