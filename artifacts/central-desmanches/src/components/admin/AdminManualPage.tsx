import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, ShieldCheck, Store, Users, Package, DollarSign,
  FileBarChart2, Scale, MessageCircleWarning, Globe, Settings,
  Handshake, MessageSquare, Star, FileText, AlertTriangle,
  CheckCircle2, Info, Zap, ChevronRight, User, FileCheck,
  ShieldAlert, TrendingUp, Lock, Bell, ClipboardList,
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

function Section({ id, icon: Icon, title, badge, children }: { id: string; icon: any; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-muted/30 py-4">
          <CardTitle className="flex items-center gap-3 text-lg font-mono">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {title}
            {badge && <Badge variant="secondary" className="ml-auto">{badge}</Badge>}
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

const TOC_ADMIN = [
  { id: "intro", label: "Introdução à Plataforma" },
  { id: "visao-geral", label: "Visão Geral & Métricas" },
  { id: "credenciamento", label: "Aprovação de Desmanches" },
  { id: "desmanches", label: "Gestão de Desmanches" },
  { id: "usuarios", label: "Gestão de Clientes" },
  { id: "pedidos", label: "Pedidos & Anúncios" },
  { id: "financeiro", label: "Assinaturas & Receitas" },
  { id: "relatorios", label: "Relatórios" },
  { id: "moderacao", label: "Moderação de Divergências" },
  { id: "reclamacoes", label: "Reclamações" },
  { id: "site-content", label: "Conteúdo do Site" },
  { id: "configuracoes", label: "Configurações" },
  { id: "permissoes", label: "Permissões de Admins" },
];

const TOC_DESMANCHE = [
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

const TOC_CLIENTE = [
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

function AdminContent() {
  return (
    <div className="space-y-6">
      <Section id="intro" icon={BookOpen} title="Introdução à Plataforma">
        <p>
          A <strong className="text-foreground">Central dos Desmanches</strong> é uma plataforma B2B/B2C que conecta clientes que precisam de peças automotivas a desmanches credenciados. O papel do administrador é garantir a qualidade dos parceiros, a integridade das transações e a saúde financeira da operação.
        </p>
        <Callout type="info">
          O painel administrativo é o centro de controle de toda a plataforma. Com ele você aprova parceiros, monitora negociações, gerencia cobranças e resolve conflitos.
        </Callout>
        <p><strong className="text-foreground">Fluxo geral da plataforma:</strong></p>
        <div className="space-y-2">
          <Step n={1}>Desmanche se cadastra e envia documentação para credenciamento.</Step>
          <Step n={2}>Admin analisa e aprova (ou recusa) o credenciamento.</Step>
          <Step n={3}>Desmanche aprovado aparece no mural e pode receber pedidos.</Step>
          <Step n={4}>Cliente cria um pedido de peça com detalhes do veículo.</Step>
          <Step n={5}>Desmanches enviam propostas com preço, prazo e condições.</Step>
          <Step n={6}>Cliente aceita uma proposta — cria-se uma negociação.</Step>
          <Step n={7}>Ambas as partes registram o resultado ao final.</Step>
          <Step n={8}>Se houver divergência, o admin modera e decide o desfecho.</Step>
        </div>
      </Section>

      <Section id="visao-geral" icon={TrendingUp} title="Visão Geral & Métricas">
        <p>A tela inicial do painel mostra os <strong className="text-foreground">indicadores-chave</strong> da plataforma em tempo real. Use-a diariamente para identificar anomalias antes que virem problemas.</p>
        <Ul items={[
          "<strong>Total de Usuários</strong> — todos os clientes cadastrados (compradores e mecânicos).",
          "<strong>Desmanches Ativos</strong> — parceiros com cadastro aprovado e assinatura em dia.",
          "<strong>Pedidos Abertos</strong> — solicitações de peças sem proposta aceita ainda.",
          "<strong>Pendências de Aprovação</strong> — novos desmanches aguardando análise (badge vermelho no menu).",
          "<strong>Ticker LIVE</strong> — faixa animada na parte superior com dados em tempo real de clientes, negociações, pedidos e desmanches ativos.",
        ]} />
        <Callout type="warning">
          Um número alto de "Pedidos Abertos" sem aumento correspondente em "Negociações Ativas" pode indicar baixa cobertura de desmanches em alguma região ou categoria de peça.
        </Callout>
      </Section>

      <Section id="credenciamento" icon={ShieldCheck} title="Aprovação de Desmanches" badge="Ação Crítica">
        <p>Antes de operar, todo desmanche precisa passar pela <strong className="text-foreground">análise de credenciamento</strong>. Esse processo garante que apenas empresas legítimas e documentadas participem da plataforma.</p>
        <p><strong className="text-foreground">Documentos verificados:</strong></p>
        <Ul items={[
          "Licença do Detran (CRDA ou equivalente estadual) — com data de validade.",
          "CNPJ ativo e razão social correspondente.",
          "Dados do responsável legal (nome e CPF).",
          "Endereço completo do estabelecimento.",
        ]} />
        <p><strong className="text-foreground">Como analisar:</strong></p>
        <div className="space-y-2">
          <Step n={1}>Acesse <em>Aprovações</em> no menu lateral — o badge indica quantos estão pendentes.</Step>
          <Step n={2}>Clique em <strong>Ver Detalhes</strong> no card do desmanche para abrir o perfil completo com todos os documentos anexados.</Step>
          <Step n={3}>Verifique a validade da licença do Detran e a consistência dos dados cadastrais.</Step>
          <Step n={4}>Clique em <strong>Aprovar</strong> para ativar o parceiro, ou <strong>Recusar</strong> informando o motivo.</Step>
        </div>
        <Callout type="danger">
          Aprovar um desmanche sem verificar a licença do Detran expõe a plataforma a riscos legais. A licença precisa estar válida e o CNPJ deve estar ativo na Receita Federal.
        </Callout>
        <Callout type="info">
          O sistema envia notificação automática ao desmanche quando o status muda (aprovado ou recusado).
        </Callout>
      </Section>

      <Section id="desmanches" icon={Store} title="Gestão de Desmanches">
        <p>A aba <strong className="text-foreground">Desmanches</strong> lista todos os parceiros credenciados. Use-a para monitorar a performance, alterar status e investigar problemas.</p>
        <p><strong className="text-foreground">Status disponíveis:</strong></p>
        <Ul items={[
          "<strong>Ativo</strong> — operando normalmente, visível no mural de pedidos.",
          "<strong>Pendente</strong> — aguardando aprovação do credenciamento.",
          "<strong>Inativo</strong> — suspensão manual pelo admin (inadimplência, irregularidade etc.).",
        ]} />
        <p><strong className="text-foreground">Perfil individual do desmanche:</strong></p>
        <Ul items={[
          "Dados cadastrais completos (razão social, CNPJ, endereço, responsável).",
          "Histórico de negociações e taxa de conversão.",
          "Documentos com datas de vencimento monitoradas.",
          "Histórico de pagamentos e faturas.",
          "Avaliações recebidas dos clientes.",
        ]} />
        <Callout type="warning">
          Quando um desmanche tem a assinatura vencida há mais de X dias (configurável em <em>Configurações</em>), o sistema pode suspendê-lo automaticamente. Verifique as configurações de inadimplência.
        </Callout>
      </Section>

      <Section id="usuarios" icon={Users} title="Gestão de Clientes">
        <p>A aba <strong className="text-foreground">Pessoas Cadastradas</strong> centraliza todos os compradores e mecânicos da plataforma.</p>
        <Ul items={[
          "Busque por nome, e-mail ou CPF.",
          "Acesse o perfil individual com histórico completo de pedidos e negociações.",
          "Veja os pedidos que cada cliente abriu e o desfecho de cada negociação.",
          "Crie uma conta manualmente pelo botão <strong>Novo Cliente</strong> (útil para migrações ou cadastros assistidos).",
          "Clientes com e-mail não verificado aparecem com um aviso — o sistema enviou o e-mail de confirmação automaticamente.",
        ]} />
        <Callout type="info">
          Clientes não podem ser excluídos diretamente pelo painel para preservar o histórico de negociações. Caso necessário, desative a conta manualmente alterando o status.
        </Callout>
      </Section>

      <Section id="pedidos" icon={Package} title="Pedidos & Anúncios">
        <p>A aba <strong className="text-foreground">Anúncios & Pedidos</strong> exibe todas as solicitações de peças e anúncios de estoque em qualquer status. É a ferramenta de investigação e auditoria das transações.</p>
        <p><strong className="text-foreground">O que você vê em cada pedido:</strong></p>
        <Ul items={[
          "Dados da peça solicitada (nome, marca, modelo do veículo, ano, categoria).",
          "Cliente que fez o pedido e data de criação.",
          "Propostas recebidas de desmanches — com preços, prazos e condições.",
          "Negociação vinculada (quando uma proposta foi aceita).",
          "Histórico do chat entre cliente e desmanche.",
          "Resultado final registrado por ambas as partes.",
        ]} />
        <p><strong className="text-foreground">Status dos pedidos:</strong></p>
        <Ul items={[
          "<strong>Aberto</strong> — aguardando propostas ou resposta do cliente.",
          "<strong>Em Negociação</strong> — proposta aceita, transação em andamento.",
          "<strong>Concluído</strong> — resultado registrado por ambas as partes.",
          "<strong>Cancelado</strong> — pedido encerrado sem conclusão.",
        ]} />
        <Callout type="info">
          Use a busca e os filtros de status para encontrar pedidos específicos rapidamente. O filtro de data ajuda a analisar períodos específicos.
        </Callout>
      </Section>

      <Section id="financeiro" icon={DollarSign} title="Assinaturas & Receitas" badge="Asaas">
        <p>A aba <strong className="text-foreground">Assinaturas & Receitas</strong> centraliza toda a gestão financeira da plataforma, integrada ao gateway de pagamento <strong className="text-foreground">Asaas</strong>.</p>
        <p><strong className="text-foreground">Indicadores financeiros:</strong></p>
        <Ul items={[
          "<strong>Receita Paga</strong> — soma de todas as faturas quitadas no período.",
          "<strong>Aguardando Pagamento</strong> — faturas emitidas mas ainda dentro do prazo.",
          "<strong>Vencidas</strong> — inadimplência ativa (atenção imediata necessária).",
          "<strong>Total de Assinantes</strong> — desmanches com plano ativo.",
        ]} />
        <p><strong className="text-foreground">Como funciona o ciclo de cobrança:</strong></p>
        <div className="space-y-2">
          <Step n={1}>No início de cada ciclo mensal, o sistema gera automaticamente uma fatura para cada desmanche ativo.</Step>
          <Step n={2}>O Asaas emite a cobrança via <strong>PIX</strong> ou <strong>boleto bancário</strong> e envia o link por e-mail ao desmanche.</Step>
          <Step n={3}>O desmanche paga dentro do prazo — o status da fatura muda para "Pago" automaticamente.</Step>
          <Step n={4}>Faturas vencidas ficam marcadas em vermelho. O sistema pode suspender o desmanche automaticamente após X dias de inadimplência (configurável).</Step>
        </div>
        <Callout type="warning">
          Sem a chave de API do Asaas configurada em <em>Configurações</em>, as faturas são registradas no sistema mas <strong>não geram cobranças reais</strong>. Configure a chave antes do go-live.
        </Callout>
        <Callout type="info">
          Use o modo <strong>Sandbox</strong> do Asaas para testar o fluxo completo de cobrança sem movimentar dinheiro real. Mude para <strong>Produção</strong> apenas quando tudo estiver validado.
        </Callout>
        <p><strong className="text-foreground">Planos disponíveis:</strong> O sistema opera com plano mensal. Novos planos podem ser adicionados futuramente pelo time de desenvolvimento.</p>
      </Section>

      <Section id="relatorios" icon={FileBarChart2} title="Relatórios">
        <p>A aba <strong className="text-foreground">Relatórios</strong> consolida as principais métricas da plataforma em gráficos e tabelas para apoio à tomada de decisão estratégica.</p>
        <p><strong className="text-foreground">Métricas disponíveis:</strong></p>
        <Ul items={[
          "Pedidos por status (abertos, em negociação, concluídos, cancelados).",
          "Crescimento de cadastros de clientes e desmanches por período.",
          "Taxa de conversão: pedidos que viraram negociações.",
          "Taxa de conclusão: negociações que foram concluídas com sucesso.",
          "Receita por período com comparativo mensal.",
          "Desmanches mais ativos por volume de propostas enviadas.",
          "Categorias de peças mais solicitadas.",
        ]} />
        <Callout type="success">
          Use o botão <strong>Exportar CSV</strong> para levar os dados para Excel ou Google Sheets e criar suas próprias visualizações e análises personalizadas.
        </Callout>
      </Section>

      <Section id="moderacao" icon={Scale} title="Moderação de Divergências" badge="Ação Manual">
        <p>Quando o resultado de uma negociação registrado pelo <strong className="text-foreground">cliente</strong> diverge do registrado pelo <strong className="text-foreground">desmanche</strong>, o caso entra automaticamente na fila de <strong className="text-foreground">Moderação</strong>.</p>
        <p><strong className="text-foreground">Exemplos de divergência:</strong></p>
        <Ul items={[
          "Cliente informa que a peça não chegou; desmanche informa que entregou.",
          "Cliente diz que cancelou; desmanche informa venda concluída.",
          "Desmanche diz que peça foi enviada; cliente nega ter recebido.",
        ]} />
        <p><strong className="text-foreground">Como moderar:</strong></p>
        <div className="space-y-2">
          <Step n={1}>Acesse o caso na aba <em>Moderação</em>. O sistema exibe as versões lado a lado.</Step>
          <Step n={2}>Analise o histórico completo do chat como evidência — mensagens são imutáveis.</Step>
          <Step n={3}>Verifique se há fotos, comprovantes ou informações adicionais nos anexos.</Step>
          <Step n={4}>Selecione o desfecho correto: <strong>Concluído com Sucesso</strong>, <strong>Cancelado pelo Desmanche</strong>, ou <strong>Cancelado pelo Cliente</strong>.</Step>
          <Step n={5}>Salve a decisão — ambas as partes são notificadas e a negociação encerra com o status definido pelo admin.</Step>
        </div>
        <Callout type="danger">
          A decisão do admin é final e impacta diretamente a reputação (avaliação) de ambas as partes. Analise todas as evidências antes de decidir.
        </Callout>
      </Section>

      <Section id="reclamacoes" icon={MessageCircleWarning} title="Reclamações">
        <p>A aba <strong className="text-foreground">Reclamações</strong> gerencia casos que chegam pelo canal de "Sugestões & Reclamações" disponível para clientes e desmanches.</p>
        <p><strong className="text-foreground">Status da reclamação:</strong></p>
        <Ul items={[
          "<strong>Pendente</strong> — nova, ainda não analisada. Prioridade máxima.",
          "<strong>Em Análise</strong> — admin tomou ciência e está investigando.",
          "<strong>Resolvido</strong> — caso encerrado com resposta ao usuário.",
        ]} />
        <p><strong className="text-foreground">Boas práticas:</strong></p>
        <Ul items={[
          "Responda todas as reclamações em até 48 horas para manter a confiança na plataforma.",
          "Use o campo de resposta interna para registrar a decisão tomada — fica no histórico.",
          "Reclamações sobre desmanches específicos podem exigir análise das negociações vinculadas.",
          "Reclamações de desmanche sobre cobranças devem ser tratadas com o financeiro.",
        ]} />
      </Section>

      <Section id="site-content" icon={Globe} title="Conteúdo do Site">
        <p>A aba <strong className="text-foreground">Conteúdo do Site</strong> controla os elementos dinâmicos exibidos na página pública da Central dos Desmanches para visitantes não logados.</p>
        <p><strong className="text-foreground">O que você pode controlar:</strong></p>
        <Ul items={[
          "<strong>Ticker LIVE</strong> — faixa animada com estatísticas em tempo real (clientes, desmanches, pedidos, negociações).",
          "<strong>Dados Reais vs. Customizados</strong> — alterne entre exibir os números reais do banco de dados ou definir números manuais.",
          "Número manual de clientes, desmanches, pedidos e negociações para exibição pública.",
        ]} />
        <Callout type="info">
          Nos primeiros meses, quando o volume real ainda é baixo, considere usar dados customizados para apresentar projeções mais representativas do potencial da plataforma. Mude para dados reais à medida que o volume crescer.
        </Callout>
      </Section>

      <Section id="configuracoes" icon={Settings} title="Configurações do Sistema">
        <p>As <strong className="text-foreground">Configurações</strong> definem os parâmetros globais que regem o comportamento automático da plataforma.</p>
        <p><strong className="text-foreground">Integração Asaas (Pagamentos):</strong></p>
        <Ul items={[
          "<strong>Chave de API</strong> — insira a chave do seu ambiente Asaas para ativar cobranças automáticas.",
          "<strong>Ambiente</strong> — Sandbox (para testes) ou Produção (cobranças reais). Nunca coloque a chave de produção em ambiente de desenvolvimento.",
        ]} />
        <p><strong className="text-foreground">Alertas de Licença do Detran:</strong></p>
        <Ul items={[
          "Defina quantos dias antes do vencimento o sistema deve alertar o desmanche e o admin.",
          "O desmanche verá um banner no topo do painel e o admin verá a lista na Visão Geral.",
          "Recomendado: 30 dias de antecedência para dar tempo hábil de renovação.",
        ]} />
        <p><strong className="text-foreground">Negociações Paradas:</strong></p>
        <Ul items={[
          "Define o número de dias sem atividade para que uma negociação seja marcada como parada.",
          "Negociações paradas aparecem como pendência e podem ser escaladas para moderação.",
        ]} />
      </Section>

      <Section id="permissoes" icon={Lock} title="Permissões de Administradores">
        <p>A aba <strong className="text-foreground">Permissões</strong> (visível apenas para o Super Admin) permite criar perfis de acesso restrito para outros administradores da plataforma.</p>
        <Ul items={[
          "O <strong>Super Admin</strong> tem acesso irrestrito a todas as seções.",
          "Admins secundários podem ter acesso apenas a seções específicas (ex.: só Relatórios e Financeiro).",
          "Útil para equipes onde diferentes pessoas gerenciam áreas distintas.",
          "Um admin com acesso restrito não consegue visualizar nem acessar seções não autorizadas.",
        ]} />
        <Callout type="warning">
          Guarde as credenciais do Super Admin com segurança. Em caso de perda de acesso, será necessário intervenção direta no banco de dados.
        </Callout>
      </Section>
    </div>
  );
}

function DesmancheContent() {
  return (
    <div className="space-y-6">
      <Section id="d-intro" icon={BookOpen} title="Como Funciona a Plataforma">
        <p>A <strong className="text-foreground">Central dos Desmanches</strong> conecta você, desmanche parceiro, a clientes que buscam peças automotivas. Você recebe pedidos, envia propostas e fecha negócios diretamente pela plataforma — tudo registrado e organizado em um só lugar.</p>
        <Callout type="success">
          Diferente de anúncios classifiados, aqui os clientes já chegam com a necessidade específica. Você não precisa criar anúncios para cada peça — basta responder aos pedidos que fazem sentido para o seu estoque.
        </Callout>
        <p><strong className="text-foreground">Ciclo completo de uma venda:</strong></p>
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
        <p>Para operar na plataforma, seu desmanche precisa ser <strong className="text-foreground">aprovado pelo administrador</strong>. O processo é simples mas exige documentação válida.</p>
        <p><strong className="text-foreground">Documentação necessária:</strong></p>
        <Ul items={[
          "<strong>Licença do Detran (CRDA)</strong> — obrigatória e deve estar dentro da validade.",
          "<strong>CNPJ ativo</strong> — o nome fantasia e razão social devem ser consistentes.",
          "<strong>Dados do responsável legal</strong> — nome completo e CPF do titular.",
          "<strong>Endereço completo</strong> — CEP, rua, número, bairro, cidade e estado.",
        ]} />
        <p><strong className="text-foreground">Tempo de análise:</strong> O admin analisa em até 2 dias úteis. Você receberá uma notificação por e-mail com o resultado.</p>
        <Callout type="warning">
          Se a licença do Detran estiver vencida, seu credenciamento será recusado. Renove-a antes de submeter o cadastro.
        </Callout>
        <p><strong className="text-foreground">Alertas de vencimento:</strong> O sistema monitora a data de validade da sua licença e exibe um aviso no painel quando o vencimento estiver se aproximando (padrão: 30 dias antes). Você também recebe um e-mail de aviso.</p>
      </Section>

      <Section id="d-mural" icon={Package} title="Mural de Pedidos">
        <p>O <strong className="text-foreground">Mural de Pedidos</strong> é onde aparecem todas as solicitações de peças abertas pelos clientes. É o coração da plataforma para o desmanche.</p>
        <p><strong className="text-foreground">O que você vê em cada pedido:</strong></p>
        <Ul items={[
          "Nome e descrição da peça solicitada.",
          "Marca, modelo, ano e motorização do veículo.",
          "Tipo de veículo (carro de passeio, moto, caminhão, utilitário, trator).",
          "Cidade e estado do cliente.",
          "Data de publicação do pedido.",
          "Número de propostas já enviadas por outros desmanches.",
        ]} />
        <p><strong className="text-foreground">Filtros disponíveis:</strong></p>
        <Ul items={[
          "<strong>Busca por texto</strong> — filtra por nome da peça, marca ou modelo.",
          "<strong>Tipo de veículo</strong> — mostra apenas pedidos do tipo de veículo que você atende.",
          "<strong>Marca do veículo</strong> — filtre pela marca que você tem mais no estoque.",
          "<strong>Categoria de peça</strong> — motor, lataria, elétrica, suspensão etc.",
        ]} />
        <Callout type="info">
          Configure os <strong>Tipos de Veículo</strong> que você atende no seu Perfil. Com isso, o Mural filtra automaticamente os pedidos relevantes para o seu negócio — você não perde tempo com pedidos fora do seu escopo.
        </Callout>
        <Callout type="success">
          O badge colorido no menu lateral mostra quantos pedidos novos estão disponíveis. Atualize a página ou configure notificações para não perder oportunidades.
        </Callout>
      </Section>

      <Section id="d-propostas" icon={ClipboardList} title="Enviando Propostas">
        <p>Quando encontrar um pedido que faz sentido pro seu estoque, é hora de enviar uma <strong className="text-foreground">proposta</strong>.</p>
        <p><strong className="text-foreground">O que incluir em uma boa proposta:</strong></p>
        <Ul items={[
          "<strong>Preço</strong> — valor total da peça. Seja competitivo mas realista com o estado da peça.",
          "<strong>Prazo de entrega</strong> — quantos dias para a peça chegar ao cliente.",
          "<strong>Condições de pagamento</strong> — à vista, parcelado, com ou sem frete incluso.",
          "<strong>Estado da peça</strong> — original, revisada, com garantia. Seja honesto — isso afeta a avaliação.",
          "<strong>Fotos</strong> — quando possível, anexe fotos da peça. Aumenta muito a taxa de conversão.",
        ]} />
        <Callout type="warning">
          Você pode conversar com o cliente pelo <strong>chat de pré-proposta</strong> antes de enviar valores — útil para tirar dúvidas sobre o veículo ou confirmar se a peça serve. Acesse pelo botão "Perguntar ao Cliente" no card do pedido.
        </Callout>
        <p><strong className="text-foreground">Quantas propostas posso enviar?</strong> Não há limite de propostas por pedido, mas cada pedido aceita apenas uma proposta por desmanche. Você pode editar ou cancelar uma proposta enquanto ela ainda estiver no status "Enviada".</p>
        <Callout type="info">
          Propostas com fotos e descrição detalhada convertem até 3x mais que propostas apenas com preço. Invista 2 minutos a mais na descrição e nos detalhes.
        </Callout>
      </Section>

      <Section id="d-negociacoes" icon={Handshake} title="Negociações">
        <p>Quando o cliente aceita sua proposta, cria-se uma <strong className="text-foreground">Negociação</strong>. Ela fica na aba <em>Minhas Negociações</em> com todo o histórico vinculado.</p>
        <p><strong className="text-foreground">Status de uma negociação:</strong></p>
        <Ul items={[
          "<strong>Em Andamento</strong> — proposta aceita, aguardando conclusão ou cancelamento.",
          "<strong>Concluída</strong> — venda finalizada com sucesso, registrada por ambas as partes.",
          "<strong>Cancelada</strong> — encerrada sem venda (cliente desistiu, peça indisponível etc.).",
          "<strong>Em Divergência</strong> — resultados registrados pelas partes são diferentes — vai para moderação do admin.",
        ]} />
        <p><strong className="text-foreground">Registrando o resultado:</strong></p>
        <div className="space-y-2">
          <Step n={1}>Acesse a negociação na aba <em>Minhas Negociações</em>.</Step>
          <Step n={2}>Clique em <strong>Registrar Resultado</strong> quando a situação estiver definida.</Step>
          <Step n={3}>Selecione o resultado: Venda Concluída, Cancelamento pelo Cliente ou Cancelamento pelo Desmanche.</Step>
          <Step n={4}>Adicione observações se necessário e confirme.</Step>
        </div>
        <Callout type="danger">
          <strong>Nunca deixe uma negociação sem resultado registrado.</strong> Negociações sem desfecho ficam paradas na sua fila, prejudicam seus indicadores e podem ser escaladas para moderação pelo admin após o período de inatividade.
        </Callout>
      </Section>

      <Section id="d-chat" icon={MessageSquare} title="Chat com Clientes">
        <p>O <strong className="text-foreground">Chat</strong> é o canal oficial de comunicação entre desmanche e cliente dentro da plataforma. Todas as mensagens ficam registradas permanentemente.</p>
        <Ul items={[
          "Use o chat para tirar dúvidas sobre o veículo antes de enviar uma proposta.",
          "Combine detalhes de entrega, endereço e forma de pagamento pelo chat.",
          "Envie fotos adicionais da peça quando solicitado.",
          "Mantenha um tom profissional — as mensagens podem ser usadas como evidência em caso de conflito.",
        ]} />
        <Callout type="warning">
          Não combine pagamentos ou acordos fora da plataforma. Transações externas não são rastreáveis e a plataforma não pode intervir em disputas que aconteceram fora do sistema.
        </Callout>
        <p><strong className="text-foreground">Notificações:</strong> O badge de mensagens não lidas aparece no menu lateral. Responda rapidamente — clientes costumam fechar com o desmanche que responde primeiro.</p>
      </Section>

      <Section id="d-avaliacoes" icon={Star} title="Avaliações & Reputação">
        <p>Ao final de cada negociação concluída, o cliente tem a opção de <strong className="text-foreground">avaliar seu atendimento</strong> com uma nota de 1 a 5 estrelas e um comentário.</p>
        <p><strong className="text-foreground">O que impacta sua nota:</strong></p>
        <Ul items={[
          "<strong>Velocidade de resposta</strong> — clientes valorizam desmanches que respondem rápido.",
          "<strong>Honestidade sobre a peça</strong> — descreva exatamente o estado. Surpresas negativas geram 1 estrela.",
          "<strong>Cumprimento do prazo</strong> — se comprometeu com 3 dias, entregue em 3 dias.",
          "<strong>Qualidade da comunicação</strong> — seja claro, educado e proativo.",
        ]} />
        <Callout type="success">
          Sua nota média aparece no seu perfil público e é o principal fator de decisão para clientes que recebem propostas de vários desmanches ao mesmo tempo. Uma nota acima de 4,5 estrelas aumenta significativamente sua taxa de conversão.
        </Callout>
        <p>As avaliações não podem ser excluídas. Notas ruins são oportunidade de aprendizado — leia o comentário, identifique o ponto de melhoria e corrija o processo.</p>
      </Section>

      <Section id="d-financeiro" icon={DollarSign} title="Assinatura & Pagamentos">
        <p>O acesso à plataforma é cobrado por uma <strong className="text-foreground">assinatura mensal</strong>. A cobrança é automática e você recebe o link de pagamento por e-mail no início de cada ciclo.</p>
        <p><strong className="text-foreground">Formas de pagamento aceitas:</strong></p>
        <Ul items={[
          "<strong>PIX</strong> — compensação imediata, recomendado.",
          "<strong>Boleto bancário</strong> — prazo de 3 dias úteis para compensar.",
        ]} />
        <p><strong className="text-foreground">O que acontece se eu atrasar?</strong></p>
        <Ul items={[
          "Após o vencimento, a fatura fica com status <strong>Vencida</strong>.",
          "Após X dias (configurado pelo admin), sua conta pode ser suspensa automaticamente.",
          "Com a conta suspensa, você não aparece no mural de pedidos e não pode enviar propostas.",
          "Para reativar, basta quitar a fatura em aberto — a reativação é automática.",
        ]} />
        <Callout type="info">
          Acesse a aba <em>Assinatura & Faturas</em> no seu painel para ver o histórico completo, baixar o comprovante de pagamento e verificar o status da fatura atual.
        </Callout>
      </Section>

      <Section id="d-documentacao" icon={FileCheck} title="Documentação & Licenças">
        <p>A aba <strong className="text-foreground">Minha Documentação</strong> gerencia sua Licença do Detran (CRDA) e outros documentos obrigatórios para operar na plataforma.</p>
        <p><strong className="text-foreground">Status dos documentos:</strong></p>
        <Ul items={[
          "<strong>Regular</strong> (verde) — documentação válida, tudo em ordem.",
          "<strong>Próxima do Vencimento</strong> (amarelo) — dentro do período de alerta definido pelo admin.",
          "<strong>Vencida</strong> (vermelho) — exige renovação imediata. Pode resultar em suspensão.",
        ]} />
        <Callout type="danger">
          Com a licença do Detran vencida, sua conta pode ser suspensa. Renove a licença e envie o novo documento o quanto antes para regularizar a situação.
        </Callout>
        <p><strong className="text-foreground">Como atualizar um documento:</strong> Acesse <em>Minha Documentação</em>, localize o documento com vencimento próximo e use o botão de upload para enviar o arquivo atualizado. O admin revisará e validará.</p>
      </Section>

      <Section id="d-perfil" icon={User} title="Perfil da Empresa">
        <p>O <strong className="text-foreground">Perfil da Empresa</strong> é o seu cartão de visitas na plataforma. Clientes acessam seu perfil antes de aceitar uma proposta — um perfil completo transmite profissionalismo e confiança.</p>
        <p><strong className="text-foreground">O que manter atualizado:</strong></p>
        <Ul items={[
          "<strong>Logo</strong> — imagem de até 2MB. Prefira fundo branco ou transparente.",
          "<strong>Nome Fantasia</strong> — como você aparece para os clientes.",
          "<strong>Telefone & WhatsApp</strong> — contato principal para os clientes.",
          "<strong>Responsável Legal</strong> — nome e CPF do titular da empresa.",
          "<strong>Endereço Completo</strong> — aparece no mapa para clientes que buscam desmanches próximos.",
          "<strong>Tipos de Veículo</strong> — selecione os tipos que você atende. Isso filtra automaticamente o Mural.",
        ]} />
        <Callout type="success">
          Desmanches com logo, telefone e endereço preenchidos recebem 40% mais visualizações de perfil do que os com cadastro incompleto.
        </Callout>
      </Section>

      <Section id="d-suporte" icon={MessageCircleWarning} title="Sugestões & Reclamações">
        <p>A aba <strong className="text-foreground">Sugestões & Reclamações</strong> é o canal direto entre você e a equipe da Central dos Desmanches.</p>
        <Ul items={[
          "<strong>Sugestão</strong> — tem uma ideia para melhorar a plataforma? Manda aqui.",
          "<strong>Reclamação</strong> — problema com cobrança, cliente mal-intencionado, bug no sistema.",
          "<strong>Dúvida</strong> — qualquer situação que o manual não cobre.",
        ]} />
        <p>Nossa equipe responde por e-mail ao endereço cadastrado em até 2 dias úteis.</p>
      </Section>
    </div>
  );
}

function ClienteContent() {
  return (
    <div className="space-y-6">
      <Section id="c-intro" icon={BookOpen} title="Como Funciona a Plataforma">
        <p>A <strong className="text-foreground">Central dos Desmanches</strong> facilita a busca por peças automotivas usadas e originais. Em vez de ligar para desmanche por desmanche, você publica um único pedido e os parceiros cadastrados enviam as propostas para você.</p>
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
          Pedidos com informações detalhadas recebem propostas mais precisas e em menos tempo. Inclua o máximo de detalhes que puder sobre o veículo e a peça.
        </Callout>
        <p><strong className="text-foreground">Quantos pedidos posso ter abertos?</strong> Não há limite. Você pode ter vários pedidos simultâneos para peças diferentes.</p>
      </Section>

      <Section id="c-propostas" icon={ClipboardList} title="Receber e Comparar Propostas">
        <p>Quando um desmanche parceiro tiver a peça que você precisa, ele enviará uma <strong className="text-foreground">proposta</strong> com preço, prazo e condições. Você pode receber propostas de vários desmanches para o mesmo pedido.</p>
        <p><strong className="text-foreground">O que analisar em cada proposta:</strong></p>
        <Ul items={[
          "<strong>Preço total</strong> — verifique se o frete já está incluso ou é cobrado à parte.",
          "<strong>Prazo de entrega</strong> — dias úteis para a peça chegar até você.",
          "<strong>Estado da peça</strong> — original, revisada, com garantia? Qualquer garantia oferecida?",
          "<strong>Fotos</strong> — desmanches que enviam fotos da peça real merecem mais confiança.",
          "<strong>Nota do desmanche</strong> — veja a avaliação média de outros clientes.",
        ]} />
        <Callout type="info">
          Antes de aceitar, você pode enviar uma mensagem ao desmanche pelo chat de pré-proposta para tirar dúvidas adicionais — sem precisar aceitar a proposta primeiro.
        </Callout>
        <p><strong className="text-foreground">Posso aceitar mais de uma proposta?</strong> Não — ao aceitar uma proposta, o pedido é vinculado àquele desmanche e as outras propostas são automaticamente recusadas.</p>
      </Section>

      <Section id="c-negociacao" icon={Handshake} title="Negociações">
        <p>Ao aceitar uma proposta, cria-se uma <strong className="text-foreground">Negociação</strong> que fica registrada na aba <em>Negociações</em>. É aqui que você acompanha o andamento até a peça chegar.</p>
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
  );
}

const TABS = [
  { key: "admin", label: "Administrador", icon: ShieldCheck, toc: TOC_ADMIN },
  { key: "desmanche", label: "Desmanche", icon: Store, toc: TOC_DESMANCHE },
  { key: "cliente", label: "Cliente", icon: User, toc: TOC_CLIENTE },
];

export default function AdminManualPage() {
  const [activeTab, setActiveTab] = useState("admin");
  const current = TABS.find(t => t.key === activeTab)!;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold font-mono tracking-tight">Manual do Sistema</h1>
        </div>
        <p className="text-muted-foreground">Documentação completa da plataforma Central dos Desmanches — para Admin, Desmanche e Cliente.</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6 border-b pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-6">
        {/* Table of contents */}
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nesta seção</p>
            <nav className="space-y-1">
              {current.toc.map(item => (
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "admin" && <AdminContent />}
          {activeTab === "desmanche" && <DesmancheContent />}
          {activeTab === "cliente" && <ClienteContent />}
        </div>
      </div>
    </div>
  );
}
