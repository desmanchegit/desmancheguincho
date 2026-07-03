import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TourHelpButton } from "@/components/TourHelpButton";
import { maybeAutoStartTour } from "@/lib/tour";
import { OverviewTab } from "@/components/client/OverviewTab";
import { ProfileTab } from "@/components/client/ProfileTab";
import { OrdersTab } from "@/components/client/OrdersTab";
import { ProposalsTab } from "@/components/client/ProposalsTab";
import { NegotiationsTab } from "@/components/client/NegotiationsTab";
import { ChatTab } from "@/components/chat/ChatTab";
import { FeedbackTab } from "@/components/client/FeedbackTab";
import ClienteManualPage from "@/components/client/ClienteManualPage";
import { getToken } from "@/lib/auth";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";
import {
  LayoutDashboard,
  User,
  Package,
  MessageSquare,
  Handshake,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  MessageCircle,
  MailWarning,
  RefreshCw,
  MessageCircleWarning,
  BookOpen,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const TAB_KEYS = [
  { key: "overview", label: "Meu Painel", icon: LayoutDashboard },
  { key: "profile", label: "Meu Perfil", icon: User },
  { key: "orders", label: "Meus Pedidos", icon: Package },
  { key: "proposals", label: "Propostas", icon: MessageSquare },
  { key: "negotiations", label: "Negociações", icon: Handshake },
  { key: "chat", label: "Mensagens", icon: MessageCircle },
  { key: "feedback", label: "Sugestões & Reclamações", icon: MessageCircleWarning },
  { key: "manual", label: "Manual do Usuário", icon: BookOpen },
];

const CLIENT_TAB_KEY = "client_tab";

export default function ClientDashboard() {
  const { user, isLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(CLIENT_TAB_KEY) || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const token = getToken();

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => toast({ title: data.message }),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/my"],
    queryFn: async () => {
      const res = await fetch("/api/orders/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token && !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const pendingProposalsCount = orders.reduce(
    (sum: number, o: any) =>
      sum + ((o.proposals || []).filter((p: any) => p.status === "sent").length),
    0
  );

  const { data: chatRooms = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/rooms"],
    queryFn: async () => {
      const res = await fetch("/api/chat/rooms", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token && !!user,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });

  const totalUnreadChat = chatRooms.reduce(
    (s: number, r: any) => s + (r.unreadCount || 0),
    0
  );

  useEffect(() => {
    if (!isLoading && (!user || user.type !== "client")) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && user.type === "client") {
      maybeAutoStartTour(user.id, "client", 900);
    }
  }, [user?.id]);

  // Redireciona para perfil se cadastro incompleto (sem WhatsApp ou endereço)
  useEffect(() => {
    if (user && user.type === "client" && user.profileComplete === false) {
      setActiveTab("profile");
      localStorage.setItem(CLIENT_TAB_KEY, "profile");
    }
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || user.type !== "client") {
    return null;
  }

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem(CLIENT_TAB_KEY, tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 overflow-y-auto md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          <div className="py-6 px-4 border-b flex flex-col items-center relative">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden absolute right-2 top-2"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="Central dos Desmanches" className="h-32 w-auto" />
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <nav className="p-2">
            {TAB_KEYS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const badge =
                tab.key === "proposals" && pendingProposalsCount > 0
                  ? pendingProposalsCount
                  : tab.key === "chat" && totalUnreadChat > 0
                  ? totalUnreadChat
                  : null;

              return (
                <button
                  key={tab.key}
                  onClick={() => handleNavigate(tab.key)}
                  data-tour={`client-${tab.key}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {badge !== null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                        isActive
                          ? "bg-white/30 text-white"
                          : "bg-orange-500 text-white"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-2 pt-1">
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted mb-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar ao Site
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0">
        <header className="bg-background border-b px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">
              {TAB_KEYS.find((t) => t.key === activeTab)?.label}
            </h1>
            {activeTab === "proposals" && pendingProposalsCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                {pendingProposalsCount} nova{pendingProposalsCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <TourHelpButton userId={user.id} role="client" />
        </header>

        {/* Email verification banner — TEMP: disabled for testing (re-enable after launch) */}
        {/* {user.emailVerified === false && !verifyBannerDismissed && (
          <div className="mx-4 md:mx-6 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm" data-testid="banner-email-verify">
            <MailWarning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-medium text-amber-800">Confirme seu e-mail</span>
              <span className="text-amber-700"> — Você precisa verificar seu e-mail para poder criar pedidos de peças. Verifique sua caixa de entrada.</span>
              <button
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                className="ml-2 text-amber-900 underline hover:no-underline inline-flex items-center gap-1 font-medium disabled:opacity-60"
                data-testid="button-resend-verification"
              >
                {resendMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                Reenviar e-mail
              </button>
            </div>
            <button onClick={() => setVerifyBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )} */}
        <div className="p-4 md:p-6 max-w-5xl">
          {activeTab === "overview" && <OverviewTab onNavigate={handleNavigate} />}
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "orders" && <OrdersTab />}
          {activeTab === "proposals" && <ProposalsTab />}
          {activeTab === "negotiations" && <NegotiationsTab onNavigate={handleNavigate} />}
          {activeTab === "chat" && <ChatTab />}
          {activeTab === "feedback" && <FeedbackTab />}
          {activeTab === "manual" && <ClienteManualPage />}
        </div>
      </main>
    </div>
  );
}
