import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { markTourCompleted } from "./tour";

const COMMON_OPTS = {
  showProgress: true,
  allowClose: true,
  overlayColor: "rgba(0, 0, 0, 0.65)",
  stagePadding: 8,
  stageRadius: 8,
  popoverClass: "cdesmanches-tour",
  nextBtnText: "Próximo",
  prevBtnText: "Voltar",
  doneBtnText: "Finalizar",
  progressText: "{{current}} de {{total}}",
};

function nav(tourKey: string) {
  return () => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${tourKey}"]`);
    if (el) el.click();
  };
}

export function startAdminFullTour(userId: string) {
  const d = driver({
    ...COMMON_OPTS,
    steps: [
      {
        popover: {
          title: "Tour Completo — Painel Admin",
          description:
            "Vou te guiar por todas as seções do painel administrativo, explicando o que cada uma faz. Use os botões <strong>Próximo</strong> e <strong>Voltar</strong> para navegar.",
        },
      },

      // ── VISÃO GERAL ────────────────────────────────────────────────
      {
        element: '[data-tour="admin-overview"]',
        popover: {
          title: "Visão Geral",
          description:
            "O ponto de partida do painel. Aqui você enxerga de um só olhar o estado da plataforma: quantos desmanches estão ativos, pedidos abertos, aprovações pendentes e receita do período.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-overview"),
      },
      {
        element: '[data-tour="admin-overview-metrics"]',
        popover: {
          title: "Indicadores Principais",
          description:
            "<ul style='margin:4px 0 0 16px;padding:0;list-style:disc'><li><strong>Total de Usuários</strong> — clientes cadastrados</li><li><strong>Desmanches Ativos</strong> — parceiros operando</li><li><strong>Pedidos Abertos</strong> — solicitações sem proposta aceita</li><li><strong>Receita</strong> — assinaturas pagas no período</li></ul>",
          side: "top",
          align: "start",
        },
      },

      // ── APROVAÇÕES ─────────────────────────────────────────────────
      {
        element: '[data-tour="admin-approvals"]',
        popover: {
          title: "Aprovações de Credenciamento",
          description:
            "Aqui chegam os cadastros de novos desmanches aguardando análise. Você confere a documentação enviada, verifica a licença do Detran e decide se aprova ou recusa o credenciamento.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-approvals"),
      },
      {
        element: '[data-tour="admin-approvals-content"]',
        popover: {
          title: "Fila de Aprovação",
          description:
            "Cada card mostra o desmanche com seus dados e documentos. Clique em <strong>Ver Detalhes</strong> para abrir o perfil completo antes de tomar a decisão. O badge amarelo no menu lateral indica quantos estão pendentes.",
          side: "top",
          align: "start",
        },
      },

      // ── DESMANCHES ─────────────────────────────────────────────────
      {
        element: '[data-tour="admin-desmanches"]',
        popover: {
          title: "Desmanches Credenciados",
          description:
            "Lista completa de todos os desmanches aprovados na plataforma. Você pode filtrar por status (ativo, inativo, suspenso), buscar pelo nome e acessar o perfil individual de cada empresa.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-desmanches"),
      },
      {
        element: '[data-tour="admin-desmanches-content"]',
        popover: {
          title: "Gerenciar Desmanches",
          description:
            "Clique em qualquer desmanche para ver detalhes completos: negociações, histórico de pagamentos, documentos e reputação. Você pode alterar o status manualmente quando necessário.",
          side: "top",
          align: "start",
        },
      },

      // ── PESSOAS CADASTRADAS ─────────────────────────────────────────
      {
        element: '[data-tour="admin-users"]',
        popover: {
          title: "Pessoas Cadastradas",
          description:
            "Todos os clientes (compradores e mecânicos) cadastrados na plataforma. Use essa seção para verificar perfis, histórico de pedidos e negociações, e gerenciar contas quando necessário.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-users"),
      },
      {
        element: '[data-tour="admin-users-content"]',
        popover: {
          title: "Lista de Clientes",
          description:
            "Busque pelo nome ou e-mail, filtre por período de cadastro e acesse o perfil detalhado de cada cliente. O botão <strong>Novo Cliente</strong> permite criar contas manualmente quando solicitado.",
          side: "top",
          align: "start",
        },
      },

      // ── PEDIDOS ────────────────────────────────────────────────────
      {
        element: '[data-tour="admin-orders"]',
        popover: {
          title: "Anúncios & Pedidos de Peças",
          description:
            "Visão global de todos os pedidos e anúncios da plataforma, independentemente do status. Aqui você pode investigar qualquer transação, acompanhar o ciclo completo de uma negociação e intervir quando necessário.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-orders"),
      },
      {
        element: '[data-tour="admin-orders-content"]',
        popover: {
          title: "Histórico Completo de Pedidos",
          description:
            "Clique em qualquer pedido para expandir e ver: propostas recebidas, negociações vinculadas, mensagens do chat e resultado final informado pelas partes. Fundamental para resolver disputas e moderar conflitos.",
          side: "top",
          align: "start",
        },
      },

      // ── ASSINATURAS & RECEITAS ──────────────────────────────────────
      {
        element: '[data-tour="admin-finance"]',
        popover: {
          title: "Assinaturas & Receitas",
          description:
            "Acompanhe a saúde financeira da plataforma: receita total, faturas pagas, faturas em aberto e inadimplência. Integrado ao Asaas para cobrança automática via PIX e boleto.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-finance"),
      },
      {
        element: '[data-tour="admin-finance-metrics"]',
        popover: {
          title: "Painel Financeiro",
          description:
            "<ul style='margin:4px 0 0 16px;padding:0;list-style:disc'><li><strong>Receita Paga</strong> — faturas já quitadas</li><li><strong>Aguardando Pagamento</strong> — emitidas mas ainda não pagas</li><li><strong>Vencidas</strong> — inadimplência ativa</li><li><strong>Total de Assinantes</strong> — desmanches com plano ativo</li></ul>",
          side: "bottom",
          align: "start",
        },
      },

      // ── RELATÓRIOS ─────────────────────────────────────────────────
      {
        element: '[data-tour="admin-reports"]',
        popover: {
          title: "Relatórios",
          description:
            "Estatísticas detalhadas da plataforma: pedidos por status, crescimento de cadastros, taxa de conversão de propostas e performance dos desmanches. Use para tomar decisões estratégicas.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-reports"),
      },
      {
        element: '[data-tour="admin-reports-content"]',
        popover: {
          title: "Gráficos & Exportação",
          description:
            "Visualize os dados em gráficos interativos ou exporte tudo em CSV para análise externa. O botão <strong>Atualizar</strong> recarrega os dados mais recentes do banco.",
          side: "top",
          align: "start",
        },
      },

      // ── MODERAÇÃO ──────────────────────────────────────────────────
      {
        element: '[data-tour="admin-moderation"]',
        popover: {
          title: "Moderação de Divergências",
          description:
            "Quando o resultado de uma negociação informado pelo cliente é diferente do informado pelo desmanche, ela cai aqui para análise. Você tem o poder de decidir o desfecho correto baseado nas evidências.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-moderation"),
      },
      {
        element: '[data-tour="admin-moderation-content"]',
        popover: {
          title: "Casos em Divergência",
          description:
            "Cada caso mostra as versões do cliente e do desmanche lado a lado, com todo o histórico de chat e fotos como evidência. Analise com cuidado antes de tomar a decisão — ela afeta a reputação de ambas as partes.",
          side: "top",
          align: "start",
        },
      },

      // ── RECLAMAÇÕES ────────────────────────────────────────────────
      {
        element: '[data-tour="admin-complaints"]',
        popover: {
          title: "Reclamações",
          description:
            "Canal de reclamações formais abertas por clientes e desmanches. Diferente das divergências de moderação, aqui entram casos mais complexos que exigem uma resposta administrativa formal.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-complaints"),
      },
      {
        element: '[data-tour="admin-complaints-filters"]',
        popover: {
          title: "Filtrar por Status",
          description:
            "Filtre as reclamações por status — <strong>Pendente</strong>, <strong>Em Análise</strong> ou <strong>Resolvido</strong>. Priorize sempre as pendentes para manter um bom tempo de resposta e a confiança dos usuários na plataforma.",
          side: "bottom",
          align: "start",
        },
      },

      // ── CONTEÚDO DO SITE ────────────────────────────────────────────
      {
        element: '[data-tour="admin-site-content"]',
        popover: {
          title: "Conteúdo do Site",
          description:
            "Controle o que aparece na página pública da Central dos Desmanches. Aqui você gerencia o ticker de estatísticas ao vivo, números exibidos no site e outros conteúdos dinâmicos para visitantes.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-site-content"),
      },
      {
        element: '[data-tour="admin-site-content"]',
        popover: {
          title: "Dados Reais vs. Dados Customizados",
          description:
            "Você pode alternar entre exibir os dados reais do banco (cadastros e pedidos reais) ou definir números manualmente — útil nos primeiros meses da plataforma antes de acumular volume suficiente.",
          side: "top",
          align: "start",
        },
      },

      // ── CONFIGURAÇÕES ───────────────────────────────────────────────
      {
        element: '[data-tour="admin-settings"]',
        popover: {
          title: "Configurações",
          description:
            "Parâmetros globais da plataforma: integração com o Asaas (cobrança automática), alertas de vencimento de licença do Detran, tempo de expiração de negociações paradas e outras regras de negócio.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("admin-settings"),
      },
      {
        element: '[data-tour="admin-settings-asaas"]',
        popover: {
          title: "Integração Asaas",
          description:
            "Configure a chave de API do Asaas para habilitar cobrança automática de assinaturas via <strong>PIX</strong> e <strong>boleto bancário</strong>. Sem essa chave, as faturas são registradas no sistema mas não geram cobranças reais. Use o modo <strong>Sandbox</strong> para testar antes de ir para produção.",
          side: "right",
          align: "start",
        },
      },

      // ── HELP BUTTON ────────────────────────────────────────────────
      {
        element: '[data-tour="help-button"]',
        popover: {
          title: "Refaça este tour quando quiser",
          description:
            "O botão <strong>Ajuda</strong> fica sempre disponível no cabeçalho. Clique nele a qualquer momento para rever este guia completo do painel.",
          side: "bottom",
          align: "end",
        },
      },
    ],
    onDestroyed: () => {
      markTourCompleted(userId, "admin");
    },
  });

  d.drive();
}
