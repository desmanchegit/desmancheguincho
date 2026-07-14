import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginModal } from "@/components/auth/LoginModal";
import { RegisterModal } from "@/components/auth/RegisterModal";
import { useAuth } from "@/hooks/use-auth";
import { 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp,
  Search,
  CheckCircle2,
  Wrench,
  Menu,
  Play,
  Pause,
  Truck,
  Store
} from "lucide-react";
import engineImg from "@/assets/images/engine-3d.png";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Se já está logado, redireciona para o painel correto
  const panelPath = user?.type === "client" ? "/cliente"
    : user?.type === "desmanche" ? "/desmanche"
    : user?.type === "admin" ? "/admin"
    : null;

  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
    queryFn: async () => { const r = await fetch("/api/site-settings"); return r.json(); },
    staleTime: 60000,
  });

  const useRealData = siteSettings?.ticker_use_real_data === "true";

  const { data: realStats } = useQuery<{ desmanchesOnline: number; clientsTotal: number; ordersToday: number; activeNegotiations: number }>({
    queryKey: ["/api/site-stats/real"],
    queryFn: async () => { const r = await fetch("/api/site-stats/real"); return r.json(); },
    staleTime: 120000,
    enabled: useRealData,
  });

  const ts = useRealData && realStats
    ? {
        negotiating: String(realStats.activeNegotiations),
        online: String(realStats.desmanchesOnline),
        traded: String(realStats.ordersToday),
        newOrders: String(realStats.ordersToday),
        custom: siteSettings?.ticker_custom ?? "",
      }
    : {
        negotiating: siteSettings?.ticker_negotiating ?? "1.245",
        online: siteSettings?.ticker_desmanches_online ?? "42",
        traded: siteSettings?.ticker_traded_today ?? "145.000",
        newOrders: siteSettings?.ticker_new_orders ?? "23",
        custom: siteSettings?.ticker_custom ?? "",
      };

  const tickerSegments = useRealData && realStats
    ? [
        `${realStats.activeNegotiations} negociações ativas`,
        `${realStats.desmanchesOnline} desmanches cadastrados`,
        `${realStats.ordersToday} pedidos hoje`,
        `${realStats.clientsTotal} clientes cadastrados`,
        ...(ts.custom ? [ts.custom] : []),
      ]
    : [
        `${ts.negotiating} pessoas negociando agora`,
        `${ts.online} desmanches online`,
        `R$ ${ts.traded} em peças negociadas hoje`,
        `${ts.newOrders} novos pedidos de peças`,
        ...(ts.custom ? [ts.custom] : []),
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Stock Ticker Banner */}
      <div className="bg-foreground text-background py-2 px-4 flex items-center gap-4 border-b-4 border-primary relative z-50">
        <div className="flex items-center gap-2 font-mono text-sm shrink-0 font-bold z-10 bg-foreground relative">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          LIVE STATUS
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker whitespace-nowrap font-mono text-sm flex gap-8 w-fit">
            {[...tickerSegments, ...tickerSegments].map((seg, i) => (
              <span key={i} className={`flex items-center gap-2 ${i % 2 === 0 ? "text-green-300" : "text-yellow-200"}`}>
                {i % (tickerSegments.length) === 0 && <TrendingUp className="h-4 w-4 text-green-400" />}
                {seg}
                {i < tickerSegments.length * 2 - 1 && <span className="text-slate-500 ml-4">|</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Central dos Desmanches" className="h-20 md:h-24 w-auto drop-shadow-md" />
          </div>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/como-funciona" className="hover:text-foreground transition-colors">Como Funciona</Link>
            <Link href="/guinchos" className="hover:text-foreground transition-colors">Guinchos</Link>
            <Link href="/cadastro-desmanche" className="hover:text-foreground transition-colors">Para Desmanches</Link>
            <Link href="/cadastro-guincho" className="hover:text-foreground transition-colors">Sou Guincho</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            {panelPath ? (
              <Button className="font-semibold" onClick={() => navigate(panelPath)}>
                Ir para o Painel
              </Button>
            ) : (
              <>
                <LoginModal>
                  <Button variant="outline" data-testid="button-login">Entrar</Button>
                </LoginModal>
                <RegisterModal>
                  <Button variant="outline" className="font-semibold border-primary text-primary hover:bg-primary/10" data-testid="button-register">
                    Cadastro Cliente
                  </Button>
                </RegisterModal>
                <Link href="/cadastro-desmanche">
                  <Button className="font-semibold">Cadastro Desmanche</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] flex flex-col pt-12">
                <div className="flex flex-col gap-6 text-lg font-medium text-muted-foreground">
                  <Link href="/como-funciona" className="hover:text-foreground transition-colors">Como Funciona</Link>
                  <Link href="/guinchos" className="hover:text-foreground transition-colors">Guinchos Credenciados</Link>
                  <Link href="/cadastro-desmanche" className="hover:text-foreground transition-colors">Para Desmanches</Link>
                  <Link href="/cadastro-guincho" className="hover:text-foreground transition-colors">Sou Guincho</Link>
                </div>
                <div className="flex flex-col gap-3 mt-8 border-t pt-8">
                  {panelPath ? (
                    <Button className="w-full font-semibold" onClick={() => navigate(panelPath)}>
                      Ir para o Painel
                    </Button>
                  ) : (
                    <>
                      <LoginModal>
                        <Button variant="outline" className="w-full" data-testid="button-login-mobile">Entrar</Button>
                      </LoginModal>
                      <RegisterModal>
                        <Button variant="outline" className="w-full font-semibold border-primary text-primary hover:bg-primary/10" data-testid="button-register-mobile">
                          Cadastro Cliente
                        </Button>
                      </RegisterModal>
                      <Link href="/cadastro-desmanche">
                        <Button className="w-full font-semibold">Cadastro Desmanche</Button>
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 z-10" />
          {/* Fundo de malha geométrica sutil para dar ar tecnológico */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />
        </div>
        
        <div className="container mx-auto px-4 relative z-20 flex flex-col md:flex-row items-center gap-12">
          <div className="max-w-3xl md:w-3/5 text-slate-50">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 mb-6">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">100% Desmanches Credenciados pelo Detran</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold font-mono leading-snug mb-6">
              Solicite sua peça para todos os{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                Desmanches Legais
              </span>{" "}
              ao Mesmo Tempo.
            </h1>
            
            <p className="text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              Carros, motos e veículos pesados. Faça um único pedido e receba propostas de toda a rede de desmanches credenciados. Rápido, seguro e direto.
            </p>
            
            <div className="flex flex-row flex-wrap gap-2">
              <RegisterModal defaultTab="client">
                <Button size="sm" className="h-9 px-4 text-sm font-semibold rounded-full" data-testid="hero-search-parts">
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Procuro uma Peça
                </Button>
              </RegisterModal>
              <Link href="/cadastro-desmanche">
                <Button size="sm" variant="outline" className="h-9 px-4 text-sm font-semibold rounded-full bg-background/50 backdrop-blur-sm border-2" data-testid="hero-register-yard">
                  <Store className="mr-1.5 h-3.5 w-3.5" />
                  Sou um Desmanche
                </Button>
              </Link>
              <Link href="/guinchos">
                <Button size="sm" className="h-9 px-4 text-sm font-semibold rounded-full bg-green-600 hover:bg-green-700 text-white border-0" data-testid="hero-find-guincho">
                  <Truck className="mr-1.5 h-3.5 w-3.5" />
                  Preciso de um Guincho
                </Button>
              </Link>
            </div>
            
            <div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Negociação via WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Sem taxas ocultas</span>
              </div>
            </div>
          </div>
          
          <div className="md:w-2/5 relative hidden md:block">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
            <img 
              src={logoImg} 
              alt="Central dos Desmanches" 
              className="w-full max-w-lg mx-auto relative z-10 animate-in fade-in zoom-in duration-1000 drop-shadow-2xl" 
            />
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4">Como a plataforma funciona?</h2>
            <p className="text-muted-foreground text-lg">Um ecossistema inteligente desenhado para gerar negócios rápidos e seguros.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Para o Público */}
            <Card className="border-2 border-primary/10 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold font-mono mb-6">Para quem procura</h3>
                <ol className="space-y-6 relative">
                  <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-border -z-10" />
                  {[
                    "Cadastre sua solicitação de peça com detalhes e fotos.",
                    "O sistema dispara seu pedido para a rede de desmanches compatíveis.",
                    "Receba propostas diretamente na plataforma ou no seu WhatsApp.",
                    "Feche negócio com segurança com empresas documentadas."
                  ].map((step, i) => (
                    <li key={i} className="flex gap-4 items-start bg-background p-3 rounded-lg shadow-sm border">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold shrink-0 shadow-md">
                        {i + 1}
                      </span>
                      <p className="pt-1 text-muted-foreground font-medium">{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Para o Desmanche */}
            <Card className="border-2 border-secondary/20 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold font-mono mb-6">Para o Desmanche</h3>
                <ol className="space-y-6 relative">
                  <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-border -z-10" />
                  {[
                    "Faça seu credenciamento provando regularidade (Detran).",
                    "Acesse o painel e veja centenas de pedidos em tempo real.",
                    "Filtre por tipo de veículo (Carro, Moto, Veículos Pesados) e marca.",
                    "Chame o cliente direto no WhatsApp e feche a venda."
                  ].map((step, i) => (
                    <li key={i} className="flex gap-4 items-start bg-background p-3 rounded-lg shadow-sm border">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold shrink-0 shadow-md">
                        {i + 1}
                      </span>
                      <p className="pt-1 text-muted-foreground font-medium">{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-24 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4 text-slate-50">Veja como funciona na prática</h2>
            <p className="text-slate-400 text-lg">Entenda em poucos minutos como a Central dos Desmanches pode te ajudar.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <VideoCard
              src="/video-desmanches.mp4"
              label="Para Desmanches"
              accentClass="from-primary/30 to-primary/5"
              badgeClass="bg-primary text-primary-foreground"
              borderClass="border-primary/40"
              glowClass="shadow-primary/30"
            />
            <VideoCard
              src="/video-clientes.mp4"
              label="Para Quem Procura Peças"
              accentClass="from-blue-500/30 to-blue-500/5"
              badgeClass="bg-blue-500 text-white"
              borderClass="border-blue-500/40"
              glowClass="shadow-blue-500/30"
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-card relative overflow-hidden border-t">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 opacity-5 pointer-events-none">
          <Wrench className="w-96 h-96" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left">
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20" variant="outline">
                Apenas Empresas Credenciadas
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold font-mono mb-6 max-w-3xl">
                Aumente suas vendas. <br />Junte-se à maior rede do Brasil.
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
                Pague apenas por negociação concluída. O credenciamento é rigoroso, mas o resultado é garantido.
              </p>
              <Link href="/cadastro-desmanche">
                <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-transform" data-testid="cta-final-register">
                  Quero Cadastrar Meu Desmanche <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </div>
            <div className="flex-shrink-0 hidden md:block relative">
              <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full" />
              <img
                src={engineImg}
                alt="Peça automotiva"
                className="w-full max-w-md relative z-10 drop-shadow-2xl animate-in fade-in zoom-in duration-700"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-16 border-t border-slate-900 text-slate-400">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex items-center gap-8 flex-col md:flex-row text-center md:text-left">
              <img src={logoImg} alt="Central dos Desmanches" className="h-32 md:h-40 w-auto drop-shadow-lg" />
              <div className="max-w-md">
                <h4 className="text-2xl font-bold text-slate-50 mb-3 font-mono">4 Anos de Experiência</h4>
                <p className="text-base leading-relaxed">
                  Com 4 anos de CNPJ ativo no mercado automotivo, a Central dos Desmanches conecta desmanches credenciados e compradores em todo o Brasil com segurança e agilidade.
                </p>
              </div>
            </div>
            <div className="text-sm flex flex-col items-center md:items-end gap-2">
              <span className="font-semibold text-slate-200">Central dos Desmanches Ltda</span>
              <span className="text-slate-400">CNPJ: 45.450.395/0001-62</span>
              <span className="text-slate-500 mt-1">© {new Date().getFullYear()} Todos os direitos reservados.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Video Card Component ────────────────────────────────────────────────────
function VideoCard({ src, label, accentClass, badgeClass, borderClass, glowClass }: {
  src: string;
  label: string;
  accentClass: string;
  badgeClass: string;
  borderClass: string;
  glowClass: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  // Show overlay: always when paused, only on hover when playing
  const showOverlay = !playing || hovered;

  return (
    <div className="flex flex-col gap-0">
      <div
        className={`relative w-full aspect-video bg-slate-900 rounded-t-2xl border-2 ${borderClass} overflow-hidden shadow-2xl ${glowClass} cursor-pointer`}
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid={`video-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {/* Gradient overlay shown only when paused */}
        {!playing && (
          <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} z-10 pointer-events-none`} />
        )}

        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover"
          onEnded={() => setPlaying(false)}
          playsInline
        />

        {/* Play / Pause button — visible when paused, fades in on hover while playing */}
        <div
          className="absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-200"
          style={{ opacity: showOverlay ? 1 : 0 }}
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 ${borderClass} bg-black/50 shadow-lg transition-transform duration-200 ${hovered ? "scale-110" : "scale-100"}`}
          >
            {playing
              ? <Pause className="h-8 w-8 text-white fill-white" />
              : <Play className="h-8 w-8 text-white fill-white ml-1" />
            }
          </div>
        </div>
      </div>

      {/* Label tarja */}
      <div className={`w-full py-3 rounded-b-2xl flex items-center justify-center ${badgeClass} font-bold text-base tracking-wide shadow-lg`}>
        {label}
      </div>
    </div>
  );
}
