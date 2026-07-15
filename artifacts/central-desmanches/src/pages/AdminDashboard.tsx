import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TourHelpButton } from "@/components/TourHelpButton";
import { hasCompletedTour } from "@/lib/tour";
import { startAdminFullTour } from "@/lib/adminTour";
import {
  Users,
  Store,
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Menu,
  Bell,
  Search,
  Package,
  ChevronRight,
  ShieldCheck,
  Settings,
  Globe,
  MessageCircleWarning,
  LogOut,
  ShieldAlert,
  Loader2,
  FileBarChart2,
  Scale,
  BookOpen,
  ClipboardList,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

// Import Tabs
import OverviewTab from "@/components/admin/OverviewTab";
import DesmanchesTab from "@/components/admin/DesmanchesTab";
import DesmancheDetailPage from "@/components/admin/DesmancheDetailPage";
import UsersTab from "@/components/admin/UsersTab";
import ClientDetailPage from "@/components/admin/ClientDetailPage";
import OrdersTab from "@/components/admin/OrdersTab";
import OrderDetailPage from "@/components/admin/OrderDetailPage";
import FinanceTab from "@/components/admin/FinanceTab";
import ApprovalsTab from "@/components/admin/ApprovalsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import SiteContentTab from "@/components/admin/SiteContentTab";
import ComplaintsTab from "@/components/admin/ComplaintsTab";
import PermissionsTab, { ALL_ADMIN_TABS } from "@/components/admin/PermissionsTab";
import RelatoriosTab from "@/components/admin/RelatoriosTab";
import ModerationTab from "@/components/admin/ModerationTab";
import AdminManualPage from "@/components/admin/AdminManualPage";
import ActivityLogTab from "@/components/admin/ActivityLogTab";
import GuinchosTab from "@/components/admin/GuinchosTab";

const ADMIN_TAB_KEY = "admin_tab";

function AdminLoginPage() {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, "user");
    } catch {
      toast({ title: "Credenciais inválidas", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img src={logoImg} alt="Central dos Desmanches" className="h-32 w-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesso restrito a administradores</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-login-email">E-mail</Label>
              <Input
                id="admin-login-email"
                type="email"
                placeholder="admin@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                data-testid="input-admin-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-login-password">Senha</Label>
              <Input
                id="admin-login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                data-testid="input-admin-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-admin-login">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : "Entrar no Painel"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(ADMIN_TAB_KEY) || "overview");
  const [selectedDesmancheId, setSelectedDesmancheId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    setSelectedDesmancheId(null);
    setSelectedUserId(null);
    setSelectedOrderId(null);
    localStorage.setItem(ADMIN_TAB_KEY, tab);
  };
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user?.id && user?.type === "admin") {
      if (!hasCompletedTour(user.id, "admin")) {
        setTimeout(() => startAdminFullTour(user.id), 900);
      }
    }
  }, [user?.id]);

  // null = super-admin (all access), array = restricted, undefined = not yet loaded
  const userPermissions: string[] | null | undefined = user?.permissions;
  const isSuperAdmin = user?.type === "admin" && userPermissions === null;
  const canAccess = (tabKey: string) => {
    if (userPermissions === null || userPermissions === undefined) return true;
    return userPermissions.includes(tabKey);
  };

  const { data: stats } = useQuery<{
    totalUsers: number;
    totalDesmanches: number;
    totalOrders: number;
    activeDesmanches: number;
    pendingApprovals: number;
    openOrders: number;
    pendingComplaints: number;
    pendingNegotiations: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard/stats");
      return res.json();
    },
  });

  const { data: adminLicenseData } = useQuery<{ items: any[]; alertDays: number }>({
    queryKey: ["/api/admin/license-alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/license-alerts");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    enabled: user?.type === "admin",
  });
  const adminLicenseItems = adminLicenseData?.items || [];

  const { data: realStats } = useQuery<{ desmanchesOnline: number; clientsTotal: number; ordersToday: number; activeNegotiations: number }>({
    queryKey: ["/api/site-stats/real"],
    queryFn: async () => { const r = await fetch("/api/site-stats/real"); return r.json(); },
    staleTime: 60000,
  });

  const { data: moderationNegs = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/negotiations/moderation"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/negotiations/moderation");
      return res.json();
    },
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });
  const moderationCount = moderationNegs.length;

  const pendingCount = stats?.pendingApprovals ?? 0;
  const pendingComplaints = stats?.pendingComplaints ?? 0;
  const pendingNegotiations = stats?.pendingNegotiations ?? 0;
  const totalDesmanches = stats?.totalDesmanches ?? 0;
  const userName = user?.name || user?.companyName || "Admin";
  const userEmail = user?.email || "Sistema";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-center px-4 py-4 border-b border-border">
        <img src={logoImg} alt="Central dos Desmanches" className="h-20 w-auto drop-shadow-sm" />
      </div>
      
      <div className="py-4 px-3 space-y-1">
        {canAccess('overview') && <SidebarItem tourKey="admin-overview" icon={<TrendingUp />} label="Visão Geral" active={activeTab === 'overview'} onClick={() => {handleSetTab('overview'); setIsMobileMenuOpen(false);}} />}
        {canAccess('desmanches') && <SidebarItem tourKey="admin-desmanches" icon={<Store />} label="Desmanches" active={activeTab === 'desmanches'} badge={totalDesmanches > 0 ? String(totalDesmanches) : undefined} onClick={() => {handleSetTab('desmanches'); setIsMobileMenuOpen(false);}} />}
        {canAccess('users') && <SidebarItem tourKey="admin-users" icon={<Users />} label="Pessoas Cadastradas" active={activeTab === 'users'} onClick={() => {handleSetTab('users'); setIsMobileMenuOpen(false);}} />}
        {canAccess('orders') && <SidebarItem tourKey="admin-orders" icon={<FileText />} label="Anúncios / Pedidos" active={activeTab === 'orders'} badge={pendingNegotiations > 0 ? String(pendingNegotiations) : undefined} badgeAlert={pendingNegotiations > 0} onClick={() => {handleSetTab('orders'); setIsMobileMenuOpen(false);}} />}
        {canAccess('finance') && <SidebarItem tourKey="admin-finance" icon={<DollarSign />} label="Assinaturas & Receitas" active={activeTab === 'finance'} onClick={() => {handleSetTab('finance'); setIsMobileMenuOpen(false);}} />}
        {canAccess('approvals') && <SidebarItem tourKey="admin-approvals" icon={<ShieldCheck />} label="Aprovações" badge={pendingCount > 0 ? String(pendingCount) : undefined} badgeAlert={pendingCount > 0} active={activeTab === 'approvals'} onClick={() => {handleSetTab('approvals'); setIsMobileMenuOpen(false);}} />}
        {canAccess('reports') && <SidebarItem tourKey="admin-reports" icon={<FileBarChart2 />} label="Relatórios" active={activeTab === 'reports'} onClick={() => {handleSetTab('reports'); setIsMobileMenuOpen(false);}} />}
        {canAccess('site-content') && <SidebarItem tourKey="admin-site-content" icon={<Globe />} label="Conteúdo do Site" active={activeTab === 'site-content'} onClick={() => {handleSetTab('site-content'); setIsMobileMenuOpen(false);}} />}
        {canAccess('moderation') && <SidebarItem tourKey="admin-moderation" icon={<Scale />} label="Moderação" badge={moderationCount > 0 ? String(moderationCount) : undefined} badgeAlert={moderationCount > 0} active={activeTab === 'moderation'} onClick={() => {handleSetTab('moderation'); setIsMobileMenuOpen(false);}} />}
        {canAccess('guinchos') && <SidebarItem icon={<Truck />} label="Guinchos" active={activeTab === 'guinchos'} onClick={() => {handleSetTab('guinchos'); setIsMobileMenuOpen(false);}} />}
        {canAccess('complaints') && <SidebarItem tourKey="admin-complaints" icon={<MessageCircleWarning />} label="Reclamações" badge={pendingComplaints > 0 ? String(pendingComplaints) : undefined} badgeAlert={pendingComplaints > 0} active={activeTab === 'complaints'} onClick={() => {handleSetTab('complaints'); setIsMobileMenuOpen(false);}} />}
        {canAccess('settings') && <SidebarItem tourKey="admin-settings" icon={<Settings />} label="Configurações" active={activeTab === 'settings'} onClick={() => {handleSetTab('settings'); setIsMobileMenuOpen(false);}} />}
        {canAccess('activity-log') && <SidebarItem icon={<ClipboardList />} label="Log de Atividades" active={activeTab === 'activity-log'} onClick={() => {handleSetTab('activity-log'); setIsMobileMenuOpen(false);}} />}
        <div className="pt-2 pb-1 px-3"><div className="h-px bg-border" /></div>
        <SidebarItem icon={<BookOpen />} label="Manual do Sistema" active={activeTab === 'manual'} onClick={() => {handleSetTab('manual'); setIsMobileMenuOpen(false);}} />
        {isSuperAdmin && (
          <>
            <div className="pt-2 pb-1 px-3">
              <div className="h-px bg-border" />
            </div>
            <SidebarItem icon={<ShieldCheck />} label="Permissões" active={activeTab === 'permissions'} onClick={() => {handleSetTab('permissions'); setIsMobileMenuOpen(false);}} />
          </>
        )}
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar>
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">{userName}</span>
              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            data-testid="button-admin-logout"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </div>
    </>
  );

  if (!user || user.type !== "admin") {
    return <AdminLoginPage />;
  }

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col hidden md:flex sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 flex flex-col overflow-y-auto">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Buscar pedidos, usuários..." className="pl-9 bg-muted/50 border-none" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {user?.id && <TourHelpButton userId={user.id} role="admin" />}
            <Link href="/">
              <Button variant="outline" size="sm" className="hidden sm:flex">Ver Site</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-destructive hover:bg-destructive/10 px-2"
              onClick={logout}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="relative hidden sm:flex">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        {/* Live Ticker Area — always real data */}
        <div className="bg-foreground text-background py-2 px-4 flex items-center gap-4 border-b-4 border-primary relative z-20 shrink-0">
          <div className="flex items-center gap-2 font-mono text-sm shrink-0 font-bold z-10 bg-foreground relative">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE STATUS
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className="animate-ticker whitespace-nowrap font-mono text-sm flex gap-8 w-fit">
              <span className="text-green-400">{realStats?.clientsTotal ?? "..."} CLIENTES CADASTRADOS</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-yellow-400">{realStats?.activeNegotiations ?? "..."} NEGOCIAÇÕES ATIVAS</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-blue-400">{realStats?.ordersToday ?? "..."} PEDIDOS HOJE</span>
              <span className="text-muted-foreground">|</span>
              <span>{pendingCount} DESMANCHES AGUARDANDO APROVAÇÃO</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-green-400">{realStats?.desmanchesOnline ?? "..."} DESMANCHES ATIVOS</span>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {adminLicenseItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-800">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-orange-500" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">
                    Licenças do Detran próximas do vencimento ({adminLicenseItems.length} desmanche{adminLicenseItems.length > 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-1 text-xs">
                    {adminLicenseItems.map((item: any) => (
                      item.alerts.map((alert: any) => (
                        <li key={alert.id} className="flex items-center gap-2">
                          <span className={`font-medium ${alert.expired ? "text-red-700" : ""}`}>
                            {alert.expired ? "⛔ VENCIDA" : `⚠️ ${alert.daysLeft}d`}
                          </span>
                          <span>
                            <strong>{item.desmanche.tradingName || item.desmanche.companyName}</strong>
                            {" — "}{alert.name || "Credenciamento Detran"}
                            {" — Vence: "}{new Date(alert.validUntil).toLocaleDateString("pt-BR")}
                          </span>
                          <button
                            className="underline hover:no-underline"
                            onClick={() => { setSelectedDesmancheId(item.desmanche.id); handleSetTab("desmanches"); }}
                          >
                            Ver
                          </button>
                        </li>
                      ))
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'overview' && <OverviewTab onNavigate={handleSetTab} />}
          {activeTab === 'desmanches' && !selectedDesmancheId && (
            <DesmanchesTab onSelectDesmanche={(id) => setSelectedDesmancheId(id)} />
          )}
          {activeTab === 'desmanches' && selectedDesmancheId && (
            <DesmancheDetailPage id={selectedDesmancheId} onBack={() => setSelectedDesmancheId(null)} />
          )}
          {activeTab === 'users' && !selectedUserId && (
            <UsersTab onSelectUser={(id) => setSelectedUserId(id)} />
          )}
          {activeTab === 'users' && selectedUserId && (
            <ClientDetailPage id={selectedUserId} onBack={() => setSelectedUserId(null)} />
          )}
          {activeTab === 'orders' && !selectedOrderId && (
            <OrdersTab onSelectOrder={(id) => setSelectedOrderId(id)} />
          )}
          {activeTab === 'orders' && selectedOrderId && (
            <OrderDetailPage id={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
          )}
          {activeTab === 'finance' && <FinanceTab />}
          {activeTab === 'approvals' && <ApprovalsTab />}
          {activeTab === 'reports' && <RelatoriosTab />}
          {activeTab === 'site-content' && <SiteContentTab />}
          {activeTab === 'moderation' && <ModerationTab />}
          {activeTab === 'guinchos' && <GuinchosTab />}
          {activeTab === 'complaints' && <ComplaintsTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'permissions' && isSuperAdmin && <PermissionsTab />}
          {activeTab === 'activity-log' && <ActivityLogTab />}
          {activeTab === 'manual' && <AdminManualPage />}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, badge, badgeAlert, onClick, tourKey }: any) {
  return (
    <button 
      onClick={onClick}
      data-tour={tourKey}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-xs ${badgeAlert ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
