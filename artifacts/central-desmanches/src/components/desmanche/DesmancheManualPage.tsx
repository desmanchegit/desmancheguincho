import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen, ShieldCheck, Package, ClipboardList, Handshake,
  MessageSquare, Star, DollarSign, FileCheck, User,
  MessageCircleWarning, AlertTriangle, CheckCircle2, Info, ChevronRight,
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
        <CardHeader className="border-b bg-slate-800/50 py-4">
          <CardTitle className="flex items-center gap-3 text-lg font-mono text-white">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-sm leading-relaxed text-slate-300 bg-slate-800/30">
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
      <div className="flex-1 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-4">
      {items.map((i, idx) => (
        <li key={idx} className="flex gap-2 items-start text-sm text-slate-300">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
          <span dangerouslySetInnerHTML={{ __html: i }} />
        </li>
      ))}
    </ul>
  );
}

const TOC = [
  { id: "d-intro", label: "Como funciona a plataforma" },
  { id: "d-credenciamento", label: "Credenciamento e Aprovação" },
  { id: "d-mural", label: "Mural de Pedidos" },
  { id: "d-propostas", label: "Enviando Propostas" },
  { id: "d-negociacoes", label: "Negociações" },
  { id: "d-chat", label: "Chat com Clientes" },
  { id: "d-avaliacoes", label: "Avaliações & Reputação" },
  { id: "d-financeiro", label: "Assinatura & Pagamentos" },
  { id: "d-documentacao", label: "Documentação & Licenças" },
  { id: "d-perfil", label: "Perfil da Empresa" },
  { id: "d-suporte", label: "Sugestões & Reclamações" },
];

export default function DesmancheManualPage() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold font-mono tracking-tight text-white">Manual do Desmanche</h1>
        </div>
        <p className="text-slate-400">Tudo que você precisa saber para usar a Central dos Desmanches e fechar mais negócios.</p>
      </div>

      <div className="flex gap-6">
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Nesta seção</p>
            <nav className="space-y-1">
              {TOC.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="w-full text-left text-xs text-slate-400 hover:text-white hover:bg-slate-700 px-2 py-1.5 rounded transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <Section id="d-intro" icon={BookOpen} title="Como Funciona a Plataforma">
            <p>
              A <strong className="text-white">Central dos Desmanches</strong> conecta você, desmanche parceiro, a clientes que buscam peças automotivas. Você recebe pedidos, envia propostas e fecha negócios diretamente pela plataforma — tudo registrado e organizado em um só lugar.
            </p>
            <Callout type="success">
              Diferente de classificados, aqui os clientes já chegam com a necessidade específica. Você não precisa criar anúncios — basta responder aos pedidos que fazem sentido para o seu estoque.
            </Callout>
            <p><strong className="text-white">Ciclo completo de uma venda:</strong></p>
            <div className="space-y-2">
              <Step n={1}>Cliente publica um pedido descrevendo a peça, o veículo e outras informações relevantes.</Step>
              <Step n={2}>O pedido aparece no seu Mural. Você analisa se tem a peça e envia uma proposta com preço e prazo.</Step>
              <Step n={3}>Se o cliente aceitar sua proposta, cria-se uma <strong>Negociação</strong> vinculada ao pedido.</Step>
              <Step n={4}>Vocês combinam os detalhes via Chat (entrega, pagamento, garantia).</Step>
              <Step n={5}>Ao final, ambos registram o resultado: venda concluída, cancelamento ou outra situação.</Step>
              <Step n={6}>O cliente avalia seu atendimento — a nota vai para o seu perfil público.</Step>
            </div>
          </Section>

          <Section id="d-credenciamento" icon={ShieldCheck} title="Credenciamento e Aprovação">
            <p>Para operar na plataforma, seu desmanche precisa ser <strong className="text-white">aprovado pelo administrador</strong>. O processo é simples mas exige documentação válida.</p>
            <p><strong className="text-white">Documentação necessária:</strong></p>
            <Ul items={[
              "<strong>Licença do Detran (CRDA)</strong> — obrigatória e deve estar dentro da validade.",
              "<strong>CNPJ ativo</strong> — o nome fantasia e razão social devem ser consistentes.",
              "<strong>Dados do responsável legal</strong> — nome completo e CPF do titular.",
              "<strong>Endereço completo</strong> — CEP, rua, número, bairro, cidade e estado.",
            ]} />
            <p><strong className="text-white">Tempo de análise:</strong> O admin analisa em até 2 dias úteis. Você receberá uma notificação por e-mail com o resultado.</p>
            <Callout type="warning">
              Se a licença do Detran estiver vencida, seu credenciamento será recusado. Renove-a antes de submeter o cadastro.
            </Callout>
            <p><strong className="text-white">Alertas de vencimento:</strong> O sistema monitora a data de validade da sua licença e exibe um aviso no painel quando o vencimento estiver se aproximando (padrão: 30 dias antes). Você também recebe um e-mail de aviso.</p>
          </Section>

          <Section id="d-mural" icon={Package} title="Mural de Pedidos">
            <p>O <strong className="text-white">Mural de Pedidos</strong> é onde aparecem todas as solicitações de peças abertas pelos clientes. É o coração da plataforma para o desmanche.</p>
            <p><strong className="text-white">O que você vê em cada pedido:</strong></p>
            <Ul items={[
              "Nome e descrição da peça solicitada.",
              "Marca, modelo, ano e motorização do veículo.",
              "Tipo de veículo (carro de passeio, moto, caminhão, utilitário, trator).",
              "Cidade e estado do cliente.",
              "Data de publicação do pedido.",
              "Número de propostas já enviadas por outros desmanches.",
            ]} />
            <p><strong className="text-white">Filtros disponíveis:</strong></p>
            <Ul items={[
              "<strong>Busca por texto</strong> — filtra por nome da peça, marca ou modelo.",
              "<strong>Tipo de veículo</strong> — mostra apenas pedidos do tipo de veículo que você atende.",
              "<strong>Marca do veículo</strong> — filtre pela marca que você tem mais no estoque.",
              "<strong>Categoria de peça</strong> — motor, lataria, elétrica, suspensão etc.",
            ]} />
            <Callout type="info">
              Configure os <strong>Tipos de Veículo</strong> que você atende no seu Perfil. Com isso, o Mural filtra automaticamente os pedidos relevantes para o seu negócio.
            </Callout>
            <Callout type="success">
              O badge colorido no menu lateral mostra quantos pedidos novos estão disponíveis. Responda rápido — clientes costumam fechar com quem responde primeiro.
            </Callout>
          </Section>

          <Section id="d-propostas" icon={ClipboardList} title="Enviando Propostas">
            <p>Quando encontrar um pedido que faz sentido pro seu estoque, é hora de enviar uma <strong className="text-white">proposta</strong>.</p>
            <p><strong className="text-white">O que incluir em uma boa proposta:</strong></p>
            <Ul items={[
              "<strong>Preço</strong> — valor total da peça. Seja competitivo mas realista com o estado da peça.",
              "<strong>Prazo de entrega</strong> — quantos dias para a peça chegar ao cliente.",
              "<strong>Condições de pagamento</strong> — à vista, parcelado, com ou sem frete incluso.",
              "<strong>Estado da peça</strong> — original, revisada, com garantia. Seja honesto.",
              "<strong>Fotos</strong> — quando possível, anexe fotos da peça. Aumenta muito a taxa de conversão.",
            ]} />
            <Callout type="warning">
              Você pode conversar com o cliente pelo <strong>chat de pré-proposta</strong> antes de enviar valores — útil para tirar dúvidas sobre o veículo. Use o botão "Perguntar ao Cliente" no card do pedido.
            </Callout>
            <Callout type="info">
              Propostas com fotos e descrição detalhada convertem até 3x mais que propostas apenas com preço. Invista 2 minutos a mais nos detalhes.
            </Callout>
          </Section>

          <Section id="d-negociacoes" icon={Handshake} title="Negociações">
            <p>Quando o cliente aceita sua proposta, cria-se uma <strong className="text-white">Negociação</strong> na aba <em>Minhas Negociações</em> com todo o histórico vinculado.</p>
            <p><strong className="text-white">Status de uma negociação:</strong></p>
            <Ul items={[
              "<strong>Em Andamento</strong> — proposta aceita, aguardando conclusão ou cancelamento.",
              "<strong>Concluída</strong> — venda finalizada com sucesso, registrada por ambas as partes.",
              "<strong>Cancelada</strong> — encerrada sem venda (cliente desistiu, peça indisponível etc.).",
              "<strong>Em Divergência</strong> — resultados diferentes registrados pelas partes — vai para moderação do admin.",
            ]} />
            <p><strong className="text-white">Registrando o resultado:</strong></p>
            <div className="space-y-2">
              <Step n={1}>Acesse a negociação na aba <em>Minhas Negociações</em>.</Step>
              <Step n={2}>Clique em <strong>Registrar Resultado</strong> quando a situação estiver definida.</Step>
              <Step n={3}>Selecione: Venda Concluída, Cancelamento pelo Cliente ou Cancelamento pelo Desmanche.</Step>
              <Step n={4}>Adicione observações se necessário e confirme.</Step>
            </div>
            <Callout type="danger">
              <strong>Nunca deixe uma negociação sem resultado registrado.</strong> Negociações sem desfecho ficam paradas na sua fila, prejudicam seus indicadores e podem ser escaladas para moderação pelo admin após o período de inatividade configurado.
            </Callout>
          </Section>

          <Section id="d-chat" icon={MessageSquare} title="Chat com Clientes">
            <p>O <strong className="text-white">Chat</strong> é o canal oficial de comunicação com os clientes. Todas as mensagens são registradas permanentemente e podem ser usadas como evidência em caso de conflito.</p>
            <Ul items={[
              "Use antes de enviar uma proposta para tirar dúvidas sobre o veículo.",
              "Combine detalhes de entrega, endereço e forma de pagamento pelo chat.",
              "Envie fotos adicionais da peça quando solicitado.",
              "Mantenha um tom profissional — as mensagens podem ser analisadas pelo admin em caso de disputa.",
            ]} />
            <Callout type="warning">
              Não combine pagamentos ou acordos fora da plataforma. Transações externas não são rastreáveis e a plataforma não pode intervir em disputas que aconteceram fora do sistema.
            </Callout>
            <p><strong className="text-white">Notificações:</strong> O badge de mensagens não lidas aparece no menu lateral. Responda rapidamente — clientes fecham com quem responde primeiro.</p>
          </Section>

          <Section id="d-avaliacoes" icon={Star} title="Avaliações & Reputação">
            <p>Ao final de cada negociação concluída, o cliente pode <strong className="text-white">avaliar seu atendimento</strong> com uma nota de 1 a 5 estrelas e um comentário público.</p>
            <p><strong className="text-white">O que impacta sua nota:</strong></p>
            <Ul items={[
              "<strong>Velocidade de resposta</strong> — clientes valorizam desmanches ágeis.",
              "<strong>Honestidade sobre a peça</strong> — descreva exatamente o estado. Surpresas negativas geram 1 estrela.",
              "<strong>Cumprimento do prazo</strong> — se comprometeu com 3 dias, entregue em 3 dias.",
              "<strong>Qualidade da comunicação</strong> — seja claro, educado e proativo.",
            ]} />
            <Callout type="success">
              Sua nota média é o principal fator de decisão para clientes que recebem propostas de vários desmanches ao mesmo tempo. Uma nota acima de 4,5 estrelas aumenta significativamente sua taxa de conversão.
            </Callout>
            <p>As avaliações não podem ser excluídas. Notas ruins são oportunidade de aprendizado — leia o comentário, identifique o ponto de melhoria e corrija o processo.</p>
          </Section>

          <Section id="d-financeiro" icon={DollarSign} title="Assinatura & Pagamentos">
            <p>O acesso à plataforma é cobrado por uma <strong className="text-white">assinatura mensal</strong>. A cobrança é automática e você recebe o link de pagamento por e-mail no início de cada ciclo.</p>
            <p><strong className="text-white">Formas de pagamento aceitas:</strong></p>
            <Ul items={[
              "<strong>PIX</strong> — compensação imediata, recomendado.",
              "<strong>Boleto bancário</strong> — prazo de 3 dias úteis para compensar.",
            ]} />
            <p><strong className="text-white">O que acontece se eu atrasar?</strong></p>
            <Ul items={[
              "Após o vencimento, a fatura fica com status <strong>Vencida</strong>.",
              "Após X dias (configurado pelo admin), sua conta pode ser suspensa automaticamente.",
              "Com a conta suspensa, você não aparece no mural de pedidos e não pode enviar propostas.",
              "Para reativar, basta quitar a fatura em aberto — a reativação é automática.",
            ]} />
            <Callout type="info">
              Acesse a aba <em>Assinatura & Faturas</em> para ver o histórico completo, baixar comprovantes e verificar o status da fatura atual.
            </Callout>
          </Section>

          <Section id="d-documentacao" icon={FileCheck} title="Documentação & Licenças">
            <p>A aba <strong className="text-white">Minha Documentação</strong> gerencia sua Licença do Detran (CRDA) e outros documentos obrigatórios para operar na plataforma.</p>
            <p><strong className="text-white">Status dos documentos:</strong></p>
            <Ul items={[
              "<strong>Regular</strong> (verde) — documentação válida, tudo em ordem.",
              "<strong>Próxima do Vencimento</strong> (amarelo) — dentro do período de alerta. Renove em breve.",
              "<strong>Vencida</strong> (vermelho) — exige renovação imediata. Pode resultar em suspensão da conta.",
            ]} />
            <Callout type="danger">
              Com a licença do Detran vencida, sua conta pode ser suspensa. Renove a licença e envie o novo documento o quanto antes para regularizar a situação.
            </Callout>
            <p><strong className="text-white">Como atualizar:</strong> Acesse <em>Minha Documentação</em>, localize o documento vencido e use o botão de upload para enviar o arquivo atualizado. O admin revisará e validará em até 2 dias úteis.</p>
          </Section>

          <Section id="d-perfil" icon={User} title="Perfil da Empresa">
            <p>O <strong className="text-white">Perfil da Empresa</strong> é seu cartão de visitas na plataforma. Clientes acessam seu perfil antes de aceitar uma proposta — um perfil completo transmite profissionalismo e confiança.</p>
            <p><strong className="text-white">O que manter atualizado:</strong></p>
            <Ul items={[
              "<strong>Logo</strong> — imagem de até 2MB. Prefira fundo branco ou transparente.",
              "<strong>Nome Fantasia</strong> — como você aparece para os clientes.",
              "<strong>Telefone & WhatsApp</strong> — contato principal.",
              "<strong>Responsável Legal</strong> — nome e CPF do titular da empresa.",
              "<strong>Endereço Completo</strong> — aparece no mapa para clientes que buscam desmanches próximos.",
              "<strong>Tipos de Veículo</strong> — selecione os tipos que você atende. Isso filtra automaticamente o Mural de Pedidos.",
            ]} />
            <Callout type="success">
              Desmanches com logo, telefone e endereço preenchidos recebem muito mais visualizações de perfil do que os com cadastro incompleto.
            </Callout>
          </Section>

          <Section id="d-suporte" icon={MessageCircleWarning} title="Sugestões & Reclamações">
            <p>A aba <strong className="text-white">Sugestões & Reclamações</strong> é o canal direto entre você e a equipe da Central dos Desmanches.</p>
            <Ul items={[
              "<strong>Sugestão</strong> — tem uma ideia para melhorar a plataforma? Manda aqui.",
              "<strong>Reclamação</strong> — problema com cobrança, cliente mal-intencionado, bug no sistema.",
              "<strong>Dúvida</strong> — qualquer situação que o manual não cobre.",
            ]} />
            <p>Nossa equipe responde por e-mail ao endereço cadastrado em até 2 dias úteis.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
