import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Package,
  ShieldCheck,
  TrendingUp,
  Star,
  ArrowLeft,
  Users,
  Bell,
  Wrench,
  CarFront,
  Banknote,
  FileCheck,
  Building2,
} from "lucide-react";
import logoImg from "@assets/Design_sem_nome_(23)_1772229532951.png";

const CLIENT_STEPS = [
  {
    icon: ClipboardList,
    step: "01",
    title: "Abra seu pedido",
    desc: "Informe o veículo, a peça que precisa e fotos se tiver. Leva menos de 3 minutos.",
  },
  {
    icon: Bell,
    step: "02",
    title: "Receba propostas",
    desc: "Os desmanches credenciados da sua região e de todo o Brasil analisam seu pedido e enviam propostas com preço e prazo.",
  },
  {
    icon: MessageSquare,
    step: "03",
    title: "Negocie diretamente",
    desc: "Compare as propostas, converse com o desmanche pelo chat integrado e escolha a melhor oferta com segurança.",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "Feche o negócio",
    desc: "Confirme a compra direto com o desmanche. Sem intermediários, sem taxas ocultas.",
  },
];

const DESMANCHE_STEPS = [
  {
    icon: FileCheck,
    step: "01",
    title: "Faça seu credenciamento",
    desc: "Preencha o cadastro completo com CNPJ, documentos e endereço. Nossa equipe analisa e aprova em até 48 horas.",
  },
  {
    icon: Search,
    step: "02",
    title: "Monitore o mural de pedidos",
    desc: "Acesse o mural em tempo real com todos os pedidos abertos de clientes buscando peças compatíveis com seu estoque.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Envie sua proposta",
    desc: "Encontrou uma peça que você tem? Envie uma proposta com preço, prazo e condição. O cliente recebe notificação imediata.",
  },
];

const CLIENT_BENEFITS = [
  { icon: ShieldCheck, title: "Empresas verificadas", desc: "Todos os desmanches passam por processo de credenciamento com documentação." },
  { icon: Wrench, title: "Para mecânicos e oficinas", desc: "Cadastro gratuito para clientes. Ideal para oficinas que precisam de peças com frequência." },
];

const DESMANCHE_BENEFITS = [
  { icon: Users, title: "Alcance nacional", desc: "Seus pedidos chegam de todo o Brasil, não apenas da sua cidade." },
  { icon: TrendingUp, title: "Mais vendas", desc: "Clientes ativos buscando peças todos os dias. Estoque parado vira oportunidade." },
  { icon: Building2, title: "Credencial de confiança", desc: "Ser credenciado aumenta a percepção de qualidade e atrai mais compradores." },
];

const FAQS = [
  {
    q: "Quanto custa para o cliente usar a plataforma?",
    a: "Nada. O cliente não paga absolutamente nada pela plataforma — nem mensalidade, nem taxa, nem comissão. Você paga apenas a peça diretamente ao desmanche após fechar o negócio.",
  },
  {
    q: "Quanto tempo leva a aprovação do credenciamento?",
    a: "Nossa equipe analisa os documentos enviados em até 48 horas úteis. Você recebe o retorno por e-mail.",
  },
  {
    q: "Quais tipos de veículo a plataforma atende?",
    a: "Carros, motos e veículos pesados.",
  },
  {
    q: "Posso comprar peças de qualquer estado do Brasil?",
    a: "Sim. Seu pedido é enviado a desmanches credenciados de todo o Brasil. O frete e as condições de envio são combinados diretamente com cada desmanche ao fechar o negócio.",
  },
  {
    q: "Como o cliente sabe que o desmanche é confiável?",
    a: "Todo desmanche credenciado passa por verificação de documentos. Além disso, os compradores deixam avaliações após cada negociação.",
  },
];

export default function ComoFunciona() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/">
            <img src={logoImg} alt="Central dos Desmanches" className="h-20 w-auto cursor-pointer" />
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/como-funciona" className="text-foreground font-semibold">Como Funciona</Link>
            <Link href="/cadastro-desmanche" className="hover:text-foreground transition-colors">Para Desmanches</Link>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Button>
          </Link>
        </div>
      </nav>

      <div className="bg-gradient-to-b from-foreground to-foreground/90 text-background py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <Badge className="mb-4 bg-primary text-primary-foreground">Central dos Desmanches</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Como funciona a plataforma
          </h1>
          <p className="text-lg text-background/70">
            Entenda como conectamos clientes que precisam de peças com os melhores desmanches credenciados do Brasil.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-6xl space-y-24">

        <section>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CarFront className="h-6 w-6 text-blue-600" />
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200">Para Clientes e Oficinas</Badge>
          </div>
          <h2 className="text-3xl font-bold mb-2">Como comprar peças</h2>
          <p className="text-muted-foreground mb-10 max-w-2xl">
            Encontre a peça que precisa sem precisar ligar para desmanche por desmanche. Abra um pedido e receba propostas de dezenas de fornecedores credenciados.
          </p>
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {CLIENT_STEPS.map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-muted/30 absolute -top-2 -left-1 select-none">{s.step}</div>
                <div className="pt-8 pl-2">
                  <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            {CLIENT_BENEFITS.map((b) => (
              <Card key={b.title} className="border-muted">
                <CardContent className="p-5">
                  <b.icon className="h-5 w-5 text-primary mb-2" />
                  <h4 className="font-semibold text-sm mb-1">{b.title}</h4>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="border-t" />

        <section>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Building2 className="h-6 w-6 text-orange-600" />
            </div>
            <Badge variant="outline" className="text-orange-600 border-orange-200">Para Desmanches</Badge>
          </div>
          <h2 className="text-3xl font-bold mb-2">Como vender mais peças</h2>
          <p className="text-muted-foreground mb-10 max-w-2xl">
            Torne-se um desmanche credenciado e acesse um fluxo constante de clientes buscando exatamente o que você tem no estoque.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {DESMANCHE_STEPS.map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-muted/30 absolute -top-2 -left-1 select-none">{s.step}</div>
                <div className="pt-8 pl-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg w-fit mb-3">
                    <s.icon className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {DESMANCHE_BENEFITS.map((b) => (
              <Card key={b.title} className="border-muted">
                <CardContent className="p-5">
                  <b.icon className="h-5 w-5 text-orange-600 mb-2" />
                  <h4 className="font-semibold text-sm mb-1">{b.title}</h4>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/cadastro-desmanche">
              <Button size="lg" variant="default" className="gap-2">
                <Building2 className="h-4 w-4" /> Credenciar meu desmanche
              </Button>
            </Link>
          </div>
        </section>

        <div className="border-t" />

        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Perguntas frequentes</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {FAQS.map((faq) => (
              <Card key={faq.q} className="border-muted">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2 text-sm">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-foreground text-background rounded-2xl p-10 text-center">
          <h2 className="text-3xl font-bold mb-3">Pronto para começar?</h2>
          <p className="text-background/70 mb-8 max-w-xl mx-auto">
            Seja você um cliente buscando peças ou um desmanche querendo vender mais — a Central dos Desmanches é o lugar certo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <Search className="h-4 w-4" /> Buscar peças agora
              </Button>
            </Link>
            <Link href="/cadastro-desmanche">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-background/30 text-background hover:bg-background/10 gap-2">
                <Building2 className="h-4 w-4" /> Cadastrar meu desmanche
              </Button>
            </Link>
          </div>
        </section>

      </div>

      <footer className="border-t bg-muted/30 py-8 mt-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logoImg} alt="Central dos Desmanches" className="h-10 w-auto" />
          <p className="text-sm text-muted-foreground">© 2026 Central dos Desmanches. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/como-funciona" className="hover:text-foreground transition-colors">Como Funciona</Link>
            <Link href="/cadastro-desmanche" className="hover:text-foreground transition-colors">Para Desmanches</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
