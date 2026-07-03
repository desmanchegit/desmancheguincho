import { useState, useEffect } from "react";
import { Link } from "wouter";
import { TourHelpButton } from "@/components/TourHelpButton";
import { hasCompletedTour } from "@/lib/tour";
import { startDesmancheFullTour } from "@/lib/desmancheTour";
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Menu,
  Bell,
  Package,
  FileCheck,
  UserCircle,
  Users,
  MessageCircle,
  MessageSquare,
  MessageCircleWarning,
  LogOut,
  ShieldAlert,
  BookOpen,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

import DesmancheOverviewTab from "@/components/desmanche/DesmancheOverviewTab";
import DesmancheOrdersTab from "@/components/desmanche/DesmancheOrdersTab";
import DesmancheDocsTab from "@/components/desmanche/DesmancheDocsTab";
import DesmancheFinanceTab from "@/components/desmanche/DesmancheFinanceTab";
import DesmancheProfileTab from "@/components/desmanche/DesmancheProfileTab";
import DesmancheNegotiationsTab from "@/components/desmanche/DesmancheNegotiationsTab";
import DesmancheFeedbackTab from "@/components/desmanche/DesmancheFeedbackTab";
import DesmancheManualPage from "@/components/desmanche/DesmancheManualPage";
import DesmancheAdsTab from "@/components/desmanche/DesmancheAdsTab";
import { ChatTab } from "@/components/chat/ChatTab";

const DESMANCHE_TAB_KEY = "desmanche_tab";

export default function DesmancheDashboard() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(DESMANCHE_TAB_KEY) || "overview";
  });

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem(DESMANCHE_TAB_KEY, tab);
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user?.id) {
      if (!hasCompletedTour(user.id, "desmanche")) {
        setTimeout(() => startDesmancheFullTour(user.id), 900);
      }
    }
  }, [user?.id]);

  const { data: desmanche } = useQuery({
    queryKey: ["/api/desmanches/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanches/me");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 60 * 1000,
  });

  const { data: openOrders = [] } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders?status=open");
      return res.json();
    },
    enabled: !!getToken(),
    refetchInterval: 30 * 1000,
    staleTime: 0,
  });

  const { data: chatRooms = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/rooms");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });

  const desmancheName = desmanche?.tradingName || user?.companyName || user?.name || "Desmanche";
  const desmancheInitials = desmancheName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const planLabel = desmanche?.plan === "monthly" ? "Assinatura Mensal" : "Assinatura Mensal";

  // Parse vehicle types this desmanche handles
  const desmancheVehicleTypes: string[] = (() => {
    try { return JSON.parse(desmanche?.vehicleTypes || "[]"); } catch { return []; }
  })();

  // Badge count mirrors exactly what DesmancheOrdersTab shows:
  // 1. flatten orders → open items (item.status === "open")
  // 2. exclude own ads
  // 3. filter by vehicle type when the desmanche has types set
  const openOrdersCount = Array.isArray(openOrders)
    ? (openOrders as any[]).flatMap((order: any) => {
        if (order.desmancheId === user?.id) return [];
        if (order.items && order.items.length > 0) {
          return order.items.filter((item: any) => {
            if (item.status !== "open") return false;
            if (
              desmancheVehicleTypes.length > 0 &&
              item.vehicleType &&
              !desmancheVehicleTypes.includes(item.vehicleType)
            ) return false;
            return true;
          });
        }
        // legacy single-item order
        if (
          desmancheVehicleTypes.length > 0 &&
          order.vehicleType &&
          !desmancheVehicleTypes.includes(order.vehicleType)
        ) return [];
        return [order];
      }).length
    : 0;
  const totalUnread = Array.isArray(chatRooms)
    ? chatRooms.reduce((s: number, r: any) => s + (r.unreadCount || 0), 0)
    : 0;

  const { data: licenseAlert } = useQuery<{ alerts: any[]; alertDays: number }>({
    queryKey: ["/api/desmanche/license-alert"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/desmanche/license-alert");
      return res.json();
    },
    enabled: !!getToken(),
    staleTime: 60 * 60 * 1000,
  });
  const licenseAlerts = licenseAlert?.alerts || [];

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-center px-4 py-6 border-b border-slate-800 bg-slate-950">
        <img src={logoImg} alt="Central dos Desmanches" className="h-40 w-auto drop-shadow-sm brightness-110" />
      </div>
      
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <Avatar className="border-2 border-primary/50">
            <AvatarImage src={desmanche?.logo ? desmanche.logo : undefined} />
            <AvatarFallback>{desmancheInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">{desmancheName}</span>
            <span className={`text-xs flex items-center gap-1 ${desmanche?.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${desmanche?.status === "active" ? "bg-green-400" : "bg-yellow-400"}`}></span>
              {desmanche?.status === "active" ? "Credenciado" : desmanche?.status === "pending" ? "Aguardando Aprovação" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      <div className="py-4 px-3 space-y-1">
        <SidebarItem tourKey="desmanche-overview" icon={<TrendingUp />} label="Meu Painel" active={activeTab === 'overview'} onClick={() => {handleSetTab('overview'); setIsMobileMenuOpen(false);}} />
        <SidebarItem
          tourKey="desmanche-orders"
          icon={<Package />}
          label="Mural de Pedidos"
          badge={openOrdersCount > 0 ? String(openOrdersCount) : undefined}
          badgeAlert={openOrdersCount > 0}
          active={activeTab === 'orders'}
          onClick={() => {handleSetTab('orders'); setIsMobileMenuOpen(false);}}
        />
        <SidebarItem tourKey="desmanche-negotiations" icon={<MessageCircle />} label="Minhas Negociações" active={activeTab === 'negotiations'} onClick={() => {handleSetTab('negotiations'); setIsMobileMenuOpen(false);}} />
        <SidebarItem tourKey="desmanche-ads" icon={<Megaphone />} label="Meus Anúncios" active={activeTab === 'ads'} onClick={() => {handleSetTab('ads'); setIsMobileMenuOpen(false);}} />
        <SidebarItem
          tourKey="desmanche-chat"
          icon={<MessageSquare />}
          label="Mensagens"
          badge={totalUnread > 0 ? String(totalUnread) : undefined}
          badgeAlert={totalUnread > 0}
          active={activeTab === 'chat'}
          onClick={() => {handleSetTab('chat'); setIsMobileMenuOpen(false);}}
        />
        <SidebarItem tourKey="desmanche-docs" icon={<FileCheck />} label="Minha Documentação" active={activeTab === 'docs'} onClick={() => {handleSetTab('docs'); setIsMobileMenuOpen(false);}} />
        <SidebarItem tourKey="desmanche-finance" icon={<DollarSign />} label="Assinatura & Faturas" active={activeTab === 'finance'} onClick={() => {handleSetTab('finance'); setIsMobileMenuOpen(false);}} />
        <SidebarItem tourKey="desmanche-profile" icon={<UserCircle />} label="Perfil da Empresa" active={activeTab === 'profile'} onClick={() => {handleSetTab('profile'); setIsMobileMenuOpen(false);}} />
        <SidebarItem tourKey="desmanche-feedback" icon={<MessageCircleWarning />} label="Sugestões & Reclamações" active={activeTab === 'feedback'} onClick={() => {handleSetTab('feedback'); setIsMobileMenuOpen(false);}} />
        <div className="pt-2 pb-1 px-3"><div className="h-px bg-slate-700" /></div>
        <SidebarItem icon={<BookOpen />} label="Manual do Parceiro" active={activeTab === 'manual'} onClick={() => {handleSetTab('manual'); setIsMobileMenuOpen(false);}} />
        <div className="pt-2">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            data-testid="button-desmanche-logout"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex sticky top-0 h-screen overflow-y-auto text-slate-300">
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md">
              <span className="text-primary font-bold">Plano Atual:</span> {planLabel}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {totalUnread > 0 && (
              <button
                onClick={() => handleSetTab('chat')}
                className="relative text-slate-600 hover:text-primary transition-colors"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              </button>
            )}
            {user?.id && <TourHelpButton userId={user.id} role="desmanche" />}
            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={logout}>Sair do Painel</Button>
            <Button variant="ghost" size="icon" className="relative text-slate-600">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {licenseAlerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {licenseAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
                    alert.expired
                      ? "bg-red-50 border-red-300 text-red-800"
                      : "bg-amber-50 border-amber-300 text-amber-800"
                  }`}
                >
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {alert.expired
                        ? "⚠️ Licença do Detran VENCIDA"
                        : `⚠️ Licença do Detran vence em ${alert.daysLeft} dia${alert.daysLeft === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-xs mt-0.5">
                      Documento: <strong>{alert.name || "Credenciamento Detran"}</strong> —{" "}
                      Vencimento: <strong>{new Date(alert.validUntil).toLocaleDateString("pt-BR")}</strong>.{" "}
                      {alert.expired
                        ? "Renove o documento imediatamente para evitar bloqueio do cadastro."
                        : "Renove o documento antes do vencimento para manter seu cadastro ativo."}
                    </p>
                  </div>
                  <button
                    className="text-xs underline shrink-0 hover:no-underline"
                    onClick={() => handleSetTab("docs")}
                  >
                    Ver documentos
                  </button>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'overview' && <DesmancheOverviewTab onNavigate={handleSetTab} />}
          {activeTab === 'orders' && <DesmancheOrdersTab />}
          {activeTab === 'negotiations' && <DesmancheNegotiationsTab onNavigate={handleSetTab} />}
          {activeTab === 'ads' && <DesmancheAdsTab />}
          {activeTab === 'chat' && <ChatTab />}
          {activeTab === 'docs' && <DesmancheDocsTab />}
          {activeTab === 'finance' && <DesmancheFinanceTab />}
          {activeTab === 'profile' && <DesmancheProfileTab />}
          {activeTab === 'feedback' && <DesmancheFeedbackTab />}
          {activeTab === 'manual' && <DesmancheManualPage />}
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
      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-primary text-white shadow-md shadow-primary/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          active ? 'bg-white/20 text-white' :
          badgeAlert ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
