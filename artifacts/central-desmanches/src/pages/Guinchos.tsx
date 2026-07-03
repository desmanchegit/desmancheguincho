import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginModal } from "@/components/auth/LoginModal";
import { RegisterModal } from "@/components/auth/RegisterModal";
import { useAuth } from "@/hooks/use-auth";
import { GuinchoMiniMap } from "@/components/guincho/GuinchoMiniMap";
import { GuinchosMapView } from "@/components/guincho/GuinchosMapView";
import {
  Truck, MapPin, Phone, Search, TrendingUp, Menu, CheckCircle, Star, List, Map as MapIcon,
} from "lucide-react";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

type Guincho = {
  id: string;
  name: string;
  trading_name: string;
  phone: string;
  whatsapp: string;
  description: string | null;
  zip_code: string;
  street: string;
  number: string | null;
  city: string;
  state: string;
  service_radius: number;
  neighborhood: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

function fullAddress(g: Guincho) {
  const parts = [
    g.street ? `${g.street}${g.number ? `, ${g.number}` : ""}` : null,
    g.neighborhood,
    `${g.city} – ${g.state}`,
    g.zip_code ? `CEP ${g.zip_code}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function Guinchos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState({ city: "", state: "" });
  const [view, setView] = useState<"list" | "map">("list");

  const panelPath = user?.type === "client" ? "/cliente"
    : user?.type === "desmanche" ? "/desmanche"
    : user?.type === "admin" ? "/admin"
    : null;

  const { data, isLoading } = useQuery<{ guinchos: Guincho[]; total: number }>({
    queryKey: ["/api/guinchos", search.city, search.state],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.city) params.set("city", search.city);
      if (search.state) params.set("state", search.state);
      const res = await fetch(`/api/guinchos?${params}`);
      return res.json();
    },
    staleTime: 30000,
  });

  const guinchos = data?.guinchos ?? [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch({ city, state });
  }

  function openWhatsapp(whatsapp: string) {
    const num = whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${num}`, "_blank");
  }

  const tickerSegments = [
    "Guinchos credenciados em todo o Brasil",
    "Atendimento 24h disponível",
    "Contato direto via WhatsApp",
    "Sem intermediários, sem taxas ocultas",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">

      {/* Ticker */}
      <div className="bg-foreground text-background py-2 px-4 flex items-center gap-4 border-b-4 border-primary relative z-50">
        <div className="flex items-center gap-2 font-mono text-sm shrink-0 font-bold z-10 bg-foreground relative">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          LIVE STATUS
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker whitespace-nowrap font-mono text-sm flex gap-8 w-fit">
            {[...tickerSegments, ...tickerSegments].map((seg, i) => (
              <span key={i} className={`flex items-center gap-2 ${i % 2 === 0 ? "text-green-300" : "text-yellow-200"}`}>
                {i % tickerSegments.length === 0 && <TrendingUp className="h-4 w-4 text-green-400" />}
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
          <Link href="/">
            <img src={logoImg} alt="Central dos Desmanches" className="h-20 md:h-24 w-auto drop-shadow-md cursor-pointer" />
          </Link>

          <div className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/como-funciona" className="hover:text-foreground transition-colors">Como Funciona</Link>
            <Link href="/guinchos" className="text-foreground font-semibold transition-colors">Guinchos</Link>
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
                  <Button variant="outline">Entrar</Button>
                </LoginModal>
                <RegisterModal>
                  <Button variant="outline" className="font-semibold border-primary text-primary hover:bg-primary/10">
                    Cadastro Cliente
                  </Button>
                </RegisterModal>
                <Link href="/guincho/dashboard">
                  <Button className="font-semibold bg-green-600 hover:bg-green-700">
                    <Truck className="mr-2 h-4 w-4" />
                    Área do Guincho
                  </Button>
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
                  <Link href="/guinchos" className="text-foreground font-semibold">Guinchos Credenciados</Link>
                  <Link href="/cadastro-desmanche" className="hover:text-foreground transition-colors">Para Desmanches</Link>
                  <Link href="/cadastro-guincho" className="hover:text-foreground transition-colors">Sou Guincho</Link>
                </div>
                <div className="flex flex-col gap-3 mt-8 border-t pt-8">
                  {panelPath ? (
                    <Button className="w-full font-semibold" onClick={() => navigate(panelPath)}>Ir para o Painel</Button>
                  ) : (
                    <>
                      <LoginModal><Button variant="outline" className="w-full">Entrar</Button></LoginModal>
                      <RegisterModal>
                        <Button variant="outline" className="w-full font-semibold border-primary text-primary hover:bg-primary/10">Cadastro Cliente</Button>
                      </RegisterModal>
                      <Link href="/cadastro-desmanche">
                        <Button className="w-full font-semibold">Cadastro Desmanche</Button>
                      </Link>
                      <Link href="/guincho/dashboard">
                        <Button className="w-full font-semibold bg-green-600 hover:bg-green-700">
                          <Truck className="mr-2 h-4 w-4" />
                          Área do Guincho
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-20 bg-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-900/20 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="relative container mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Rede de Guinchos Credenciados
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Guincho Rápido,<br />
            <span className="text-green-400">Contato Direto</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Encontre guinchos parceiros na sua cidade. Fale direto pelo WhatsApp, sem intermediários.
          </p>

          {/* Search box inline no hero */}
          <form onSubmit={handleSearch} className="mt-8 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="pl-9 h-12 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-green-500"
              />
            </div>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-12 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Todos os estados</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <Button type="submit" className="h-12 px-6 bg-green-600 hover:bg-green-700 font-semibold">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>

          {/* Login card for guinchos */}
          <div className="mt-6 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm text-slate-300">
            <Truck className="h-5 w-5 text-green-400 shrink-0" />
            <span>Já tem cadastro?</span>
            <Link href="/guincho/dashboard">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 font-semibold h-8 px-4">
                Entrar como Guincho
              </Button>
            </Link>
            <span className="text-slate-500">ou</span>
            <Link href="/cadastro-guincho" className="text-green-400 hover:text-green-300 font-medium underline underline-offset-2">
              Cadastrar
            </Link>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            {[
              { icon: CheckCircle, label: "100% Credenciados" },
              { icon: Truck, label: "Atendimento 24h" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className="h-4 w-4 text-green-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border rounded-2xl p-5 animate-pulse h-52" />
            ))}
          </div>
        ) : guinchos.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-2">
              <Truck className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-xl font-semibold">Nenhum guincho encontrado</p>
            <p className="text-muted-foreground text-sm">
              {search.city || search.state
                ? "Tente buscar em outra cidade ou estado."
                : "Ainda não temos guinchos cadastrados nessa região."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              {(search.city || search.state) && (
                <Button variant="outline" onClick={() => { setCity(""); setState(""); setSearch({ city: "", state: "" }); }}>
                  Limpar filtros
                </Button>
              )}
              <Link href="/cadastro-guincho">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Truck className="mr-2 h-4 w-4" />
                  Cadastrar meu guincho
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{data?.total}</span> guincho(s) encontrado(s)
                {(search.city || search.state) && (
                  <Button variant="ghost" size="sm" className="ml-2 h-auto py-0 text-xs text-muted-foreground underline" onClick={() => { setCity(""); setState(""); setSearch({ city: "", state: "" }); }}>
                    limpar filtros
                  </Button>
                )}
              </p>
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
                <button
                  onClick={() => setView("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === "map" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Mapa
                </button>
              </div>
            </div>

            {view === "map" ? (
              guinchos.some((g) => g.latitude && g.longitude) ? (
                <GuinchosMapView
                  guinchos={guinchos
                    .filter((g): g is Guincho & { latitude: number; longitude: number } => !!g.latitude && !!g.longitude)
                    .map((g) => ({
                      id: g.id,
                      tradingName: g.trading_name,
                      neighborhood: g.neighborhood,
                      city: g.city,
                      state: g.state,
                      whatsapp: g.whatsapp,
                      latitude: g.latitude,
                      longitude: g.longitude,
                    }))}
                  onWhatsapp={openWhatsapp}
                />
              ) : (
                <div className="text-center py-16 text-sm text-muted-foreground bg-muted/30 rounded-xl border">
                  Nenhum guincho com localização no mapa ainda.
                </div>
              )
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {guinchos.map((g) => (
                <div key={g.id} className="group bg-card border rounded-2xl p-5 space-y-4 hover:shadow-lg hover:border-green-500/40 transition-all duration-200">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors overflow-hidden">
                      {g.photo_url ? (
                        <img src={g.photo_url} alt={g.trading_name} className="w-full h-full object-cover" />
                      ) : (
                        <Truck className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold leading-tight truncate">{g.trading_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{g.name}</p>
                    </div>
                    <Badge className="shrink-0 bg-green-500/10 text-green-600 border-green-500/20 text-xs font-medium">
                      Ativo
                    </Badge>
                  </div>

                  {/* Description */}
                  {g.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{g.description}</p>
                  )}

                  {/* Mini map */}
                  {g.latitude && g.longitude && (
                    <GuinchoMiniMap latitude={g.latitude} longitude={g.longitude} label={g.trading_name} />
                  )}

                  {/* Location */}
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-green-500 mt-0.5" />
                    <span className="leading-snug">{fullAddress(g)}</span>
                  </div>
                  <div className="text-xs font-medium text-foreground -mt-2">até {g.service_radius} km de raio</div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                      onClick={() => openWhatsapp(g.whatsapp)}
                    >
                      <Phone className="mr-1.5 h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-medium"
                      onClick={() => { window.location.href = `tel:${g.phone.replace(/\D/g, "")}`; }}
                    >
                      Ligar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* CTA bottom */}
        <div className="mt-16 rounded-2xl bg-slate-950 border border-slate-800 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 mb-1">
            <Truck className="h-6 w-6 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Tem uma empresa de guincho?</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Anuncie na Central dos Desmanches e receba chamados de clientes da sua região.
          </p>
          <Link href="/cadastro-guincho">
            <Button className="bg-green-600 hover:bg-green-700 font-semibold mt-2">
              Quero anunciar meu guincho
            </Button>
          </Link>
        </div>
      </main>

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
