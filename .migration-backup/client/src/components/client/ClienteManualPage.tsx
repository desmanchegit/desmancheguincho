import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen, User, Package, ClipboardList, Handshake,
  MessageSquare, Star, CheckCircle2, MessageCircleWarning,
  AlertTriangle, Info, ChevronRight,
} from "lucide-react";

function Callout({ type, children }: { type: "info" | "warning" | "success" | "danger"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    success: "bg-green-50 border-green-200 text-green-900",
    danger: "bg-red-50 border-red-200 text-red-900",
  };
  const icons = {
    info: <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />,
    danger: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />,
  };
  return (
    <div className={`flex gap-2 border rounded-lg px-4 py-3 text-sm ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30 py-4">
          <CardTitle className="flex items-center gap-3 text-lg font-mono">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <div className="flex-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-4">
      {items.map((i, idx) => (
        <li key={idx} className="flex gap-2 items-start text-sm text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
          <span dangerouslySetInnerHTML={{ __html: i }} />
        </li>
      ))}
    </ul>
  );
}

const TOC = [
  { id: "c-intro", label: "Como funciona a plataforma" },
  { id: "c-cadastro", label: "Perfil & Cadastro" },
  { id: "c-pedido", label: "Criar um Pedido de Peça" },
  { id: "c-propostas", label: "Receber Propostas" },
  { id: "c-negociacao", label: "Negociações" },
  { id: "c-chat", label: "Chat com Desmanches" },
  { id: "c-resultado", label: "Registrar o Resultado" },
  { id: "c-avaliacoes", label: "Avaliações" },
  { id: "c-suporte", label: "Reclamações & Suporte" },
];

export default function ClienteManualPage() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold font-mono tracking-tight">Manual do Usuário</h1>
        </div>
        <p className="text-muted-foreground">Tudo que você precisa saber para encontrar a peça certa e fechar um bom negócio na Central dos Desmanches.</p>
      </div>

      <div className="flex gap-6">
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nesta seção</p>
            <nav className="space-y-1">
              {TOC.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1.5 rounded transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <Section id="c-intro" icon={BookOpen} title="Como Funciona a Plataforma">
            <p>
              A <strong className="text-foreground">Central dos Desmanches</strong> facilita a busca por peças automotivas usadas e originais. Em vez de ligar para desmanche por desmanche, você publica um único pedido e os parceiros cadastrados enviam as propostas para você.
            </p>
            <p><strong className="text-foreground">Passo a passo simples:</strong></p>
            <div className="space-y-2">
              <Step n={1}>Crie um pedido descrevendo a peça que precisa e os dados do seu veículo.</Step>
              <Step n={2}>Desmanches parceiros recebem o pedido e enviam propostas com preço e condições.</Step>
              <Step n={3}>Você compara as propostas e escolhe a melhor.</Step>
              <Step n={4}>A proposta aceita vira uma negociação — combinam-se os detalhes de entrega e pagamento via chat.</Step>
              <Step n={5}>Ao final, você registra o resultado e avalia o atendimento.</Step>
            </div>
            <Callout type="info">
              O serviço é <strong>gratuito para clientes</strong>. Você não paga nada para publicar pedidos ou receber propostas.
            </Callout>
          </Section>

          <Section id="c-cadastro" icon={User} title="Perfil & Cadastro">
            <p>Mantenha seu perfil sempre atualizado — isso acelera o processo de negociação e garante que os desmanches consigam entrar em contato com você.</p>
            <p><strong className="text-foreground">Informações importantes do perfil:</strong></p>
            <Ul items={[
              "<strong>Nome completo</strong> — aparece para os desmanches quando você faz um pedido.",
              "<strong>WhatsApp</strong> — canal de contato rápido. Alguns desmanches usam para confirmar detalhes.",
              "<strong>Endereço (CEP)</strong> — usado para calcular frete e mostrar desmanches próximos à sua região.",
              "<strong>E-mail</strong> — onde você recebe notificações de propostas e atualizações.",
            ]} />
            <Callout type="warning">
              Sem WhatsApp e endereço preenchidos, você não consegue criar novos pedidos. Preencha o perfil antes de começar a usar a plataforma.
            </Callout>
          </Section>

          <Section id="c-pedido" icon={Package} title="Criar um Pedido de Peça">
            <p>Um bom pedido aumenta muito a chance de receber propostas relevantes. Quanto mais informações, melhor.</p>
            <p><strong className="text-foreground">Como criar um pedido:</strong></p>
            <div className="space-y-2">
              <Step n={1}>Acesse a aba <em>Meus Pedidos</em> e clique em <strong>Solicitar Peça</strong>.</Step>
              <Step n={2}>Informe o nome da peça (ex.: "Cabeçote do motor", "Maçaneta interna traseira direita").</Step>
              <Step n={3}>Selecione o tipo de veículo, marca, modelo, ano e motorização.</Step>
              <Step n={4}>Escolha a categoria da peça (motor, transmissão, elétrica, lataria, suspensão etc.).</Step>
              <Step n={5}>Adicione observações relevantes (ex.: "veículo automático", "cor preta", "com nota fiscal").</Step>
              <Step n={6}>Confirme e aguarde as propostas chegarem.</Step>
            </div>
            <Callout type="success">
              Pedidos com informações detalhadas recebem propostas mais precisas e em menos tempo. Inclua o máximo de detalhes possível sobre o veículo e a peça.
            </Callout>
            <p><strong className="text-foreground">Quantos pedidos posso ter?</strong> Não há limite. Você pode ter vários pedidos simultâneos para peças diferentes.</p>
          </Section>

          <Section id="c-propostas" icon={ClipboardList} title="Receber e Comparar Propostas">
            <p>Quando um desmanche parceiro tiver a peça que você precisa, ele enviará uma <strong className="text-foreground">proposta</strong> com preço, prazo e condições. Você pode receber propostas de vários desmanches para o mesmo pedido.</p>
            <p><strong className="text-foreground">O que analisar em cada proposta:</strong></p>
            <Ul items={[
              "<strong>Preço total</strong> — verifique se o frete já está incluso ou é cobrado à parte.",
              "<strong>Prazo de entrega</strong> — dias úteis para a peça chegar até você.",
              "<strong>Estado da peça</strong> — original, revisada, com garantia?",
              "<strong>Fotos</strong> — desmanches que enviam fotos da peça real merecem mais confiança.",
              "<strong>Nota do desmanche</strong> — veja a avaliação média de outros clientes.",
            ]} />
            <Callout type="info">
              Antes de aceitar, você pode enviar uma mensagem ao desmanche pelo chat de pré-proposta para tirar dúvidas adicionais — sem precisar aceitar a proposta primeiro.
            </Callout>
            <p><strong className="text-foreground">Posso aceitar mais de uma proposta?</strong> Não — ao aceitar uma proposta, o pedido é vinculado àquele desmanche e as outras propostas são automaticamente recusadas.</p>
          </Section>

          <Section id="c-negociacao" icon={Handshake} title="Negociações">
            <p>Ao aceitar uma proposta, cria-se uma <strong className="text-foreground">Negociação</strong> na aba <em>Negociações</em>. É aqui que você acompanha o andamento até a peça chegar.</p>
            <p><strong className="text-foreground">O que fazer durante a negociação:</strong></p>
            <Ul items={[
              "Combine o endereço de entrega e a forma de pagamento pelo chat.",
              "Confirme os detalhes com o desmanche se surgir alguma dúvida.",
              "Acompanhe o prazo de entrega acordado.",
              "Se a peça chegar com defeito ou diferente do combinado, registre a ocorrência pela plataforma.",
            ]} />
            <Callout type="danger">
              <strong>Não pague antes de negociar todos os detalhes pelo chat da plataforma.</strong> Pagamentos fora do sistema não são rastreáveis e a plataforma não consegue intervir em disputas não documentadas.
            </Callout>
          </Section>

          <Section id="c-chat" icon={MessageSquare} title="Chat com Desmanches">
            <p>O <strong className="text-foreground">Chat</strong> é o canal oficial de comunicação com os desmanches. Todas as mensagens são registradas e podem ser usadas como evidência em caso de conflito.</p>
            <Ul items={[
              "Use antes de aceitar uma proposta para tirar dúvidas sobre a peça ou o veículo.",
              "Combine detalhes de entrega, pagamento e garantia pelo chat.",
              "Solicite fotos adicionais da peça — desmanches sérios atendem prontamente.",
              "Em caso de atraso na entrega, comunique pelo chat para manter o registro.",
            ]} />
            <Callout type="warning">
              Desmanches que pedem para continuar a negociação fora da plataforma (WhatsApp pessoal, e-mail externo) perdem a proteção do sistema. Prefira manter tudo registrado aqui.
            </Callout>
          </Section>

          <Section id="c-resultado" icon={CheckCircle2} title="Registrar o Resultado da Negociação">
            <p>Quando a negociação chegar ao fim — seja com a peça entregue ou com um cancelamento — você precisa <strong className="text-foreground">registrar o resultado</strong>. Isso é fundamental.</p>
            <p><strong className="text-foreground">Como registrar:</strong></p>
            <div className="space-y-2">
              <Step n={1}>Acesse a aba <em>Negociações</em> e localize a negociação em questão.</Step>
              <Step n={2}>Clique em <strong>Registrar Resultado</strong>.</Step>
              <Step n={3}>Selecione o desfecho: Recebi a Peça, Cancelei a Compra, ou outro motivo.</Step>
              <Step n={4}>Adicione observações se necessário e confirme.</Step>
            </div>
            <Callout type="danger">
              <strong>Sempre registre o resultado</strong>, mesmo se a negociação foi cancelada. Negociações sem resultado não têm cobertura da plataforma em caso de problemas futuros. É o seu registro oficial do que aconteceu.
            </Callout>
            <p><strong className="text-foreground">E se o desmanche registrar algo diferente?</strong> Se o resultado que você registrou for diferente do que o desmanche registrou, o caso vai para <strong>moderação do administrador</strong>, que analisará as evidências e decidirá o desfecho correto.</p>
          </Section>

          <Section id="c-avaliacoes" icon={Star} title="Avaliações">
            <p>Após registrar o resultado de uma negociação concluída, você pode <strong className="text-foreground">avaliar o desmanche</strong> com uma nota de 1 a 5 estrelas e um comentário.</p>
            <Ul items={[
              "As avaliações são públicas e visíveis no perfil do desmanche.",
              "Outros clientes usam sua avaliação para decidir se vão negociar com aquele parceiro.",
              "Avaliações honestas ajudam a plataforma a manter apenas parceiros de qualidade.",
              "Você tem até 7 dias após o fechamento da negociação para enviar sua avaliação.",
            ]} />
            <Callout type="success">
              Dedicar 1 minuto para avaliar o atendimento contribui para toda a comunidade. Uma avaliação justa — positiva ou negativa — ajuda os próximos clientes a escolherem melhor.
            </Callout>
          </Section>

          <Section id="c-suporte" icon={MessageCircleWarning} title="Reclamações & Suporte">
            <p>Se você tiver um problema que a plataforma não resolveu automaticamente, use a aba <strong className="text-foreground">Sugestões & Reclamações</strong>.</p>
            <Ul items={[
              "<strong>Problema com um desmanche</strong> — peça não chegou, veio errada, desmanche sumiu.",
              "<strong>Dúvida sobre o funcionamento</strong> — qualquer situação não coberta pelo manual.",
              "<strong>Sugestão de melhoria</strong> — ideia para tornar a plataforma melhor.",
              "<strong>Erro técnico</strong> — bug ou problema no sistema.",
            ]} />
            <p>Nossa equipe responde por e-mail em até 2 dias úteis. Descreva a situação com o máximo de detalhes possível, incluindo o número do pedido ou negociação, se houver.</p>
            <Callout type="info">
              Para disputas sobre o resultado de uma negociação, o caminho correto é registrar o resultado pelo sistema — o admin é notificado automaticamente quando há divergência. Não precisa abrir uma reclamação para esses casos.
            </Callout>
          </Section>
        </div>
      </div>
    </div>
  );
}
