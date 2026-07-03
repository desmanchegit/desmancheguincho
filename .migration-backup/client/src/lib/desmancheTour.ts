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

export function startDesmancheFullTour(userId: string) {
  const d = driver({
    ...COMMON_OPTS,
    steps: [
      {
        popover: {
          title: "Tour Completo — Painel do Desmanche",
          description:
            "Vou te guiar por todas as seções do seu painel, explicando como usar cada funcionalidade para fechar mais negócios e manter sua operação organizada. Use <strong>Próximo</strong> e <strong>Voltar</strong> para navegar.",
        },
      },

      // ── MEU PAINEL (OVERVIEW) ─────────────────────────────────────
      {
        element: '[data-tour="desmanche-overview"]',
        popover: {
          title: "Meu Painel",
          description:
            "A tela inicial do seu painel. De relance você vê o resumo do seu negócio: negociações ativas, propostas enviadas, receita do mês e atalhos para as ações mais usadas.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-overview"),
      },
      {
        element: '[data-tour="desmanche-overview-metrics"]',
        popover: {
          title: "Seus Números",
          description:
            "<ul style='margin:4px 0 0 16px;padding:0;list-style:disc'><li><strong>Em Negociação</strong> — propostas aceitas em andamento</li><li><strong>Propostas Enviadas</strong> — aguardando resposta do cliente</li><li><strong>Fechamentos</strong> — negociações concluídas</li></ul>Monitore esses indicadores diariamente para entender a saúde do seu negócio.",
          side: "bottom",
          align: "start",
        },
      },

      // ── MURAL DE PEDIDOS ──────────────────────────────────────────
      {
        element: '[data-tour="desmanche-orders"]',
        popover: {
          title: "Mural de Pedidos",
          description:
            "O coração da plataforma. Aqui aparecem <strong>todos os pedidos abertos</strong> de clientes buscando peças. Você escolhe quais pedidos fazem sentido pro seu estoque e envia sua proposta com preço e condições.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-orders"),
      },
      {
        element: '[data-tour="desmanche-orders-search"]',
        popover: {
          title: "Busca e Filtros",
          description:
            "Use a barra de busca para encontrar pedidos por peça, marca ou modelo. Os filtros avançados permitem refinar por <strong>tipo de veículo</strong>, <strong>categoria de peça</strong> e <strong>estado</strong> — assim você só vê o que realmente tem a oferecer. Configure os tipos de veículo que você atende no seu Perfil para filtrar automaticamente.",
          side: "bottom",
          align: "start",
        },
      },

      // ── MINHAS NEGOCIAÇÕES ────────────────────────────────────────
      {
        element: '[data-tour="desmanche-negotiations"]',
        popover: {
          title: "Minhas Negociações",
          description:
            "Tudo o que acontece depois que sua proposta é aceita. Acompanhe cada negociação desde a aceitação até a entrega — ou até um cancelamento. Manter esse histórico atualizado é fundamental para a sua reputação.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-negotiations"),
      },
      {
        element: '[data-tour="desmanche-negotiations"]',
        popover: {
          title: "Registre Sempre o Resultado",
          description:
            "Quando uma negociação terminar — venda fechada, cliente desistiu, peça não disponível — <strong>marque o resultado aqui</strong>. Negociações sem desfecho registrado ficam paradas na sua fila e prejudicam seus indicadores. O admin pode intervir em casos de divergência entre as versões do cliente e do desmanche.",
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="desmanche-negotiations"]',
        popover: {
          title: "Avaliações dos Clientes",
          description:
            "Ao final de cada negociação, o cliente avalia o seu atendimento com estrelas e comentário. Sua <strong>nota média</strong> aparece no seu perfil público — é o que convence novos clientes a escolherem você antes da concorrência. Atenda rápido, seja honesto sobre a condição da peça e cumpra o combinado.",
          side: "right",
          align: "start",
        },
      },

      // ── CHAT ─────────────────────────────────────────────────────
      {
        element: '[data-tour="desmanche-chat"]',
        popover: {
          title: "Mensagens",
          description:
            "Chat direto com os clientes. Use para tirar dúvidas antes de enviar uma proposta, pedir mais detalhes sobre a peça ou combinar a entrega. <strong>Todas as mensagens ficam registradas</strong> e podem ser usadas como evidência em caso de conflito.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-chat"),
      },

      // ── DOCUMENTAÇÃO ──────────────────────────────────────────────
      {
        element: '[data-tour="desmanche-docs"]',
        popover: {
          title: "Minha Documentação",
          description:
            "Mantenha seus documentos sempre em dia. A plataforma verifica automaticamente a <strong>Licença do Detran</strong> e avisa quando o vencimento estiver se aproximando — você também recebe o alerta aqui no painel e por e-mail.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-docs"),
      },
      {
        element: '[data-tour="desmanche-docs-grid"]',
        popover: {
          title: "Status dos Documentos",
          description:
            "O card de status mostra se sua documentação está <strong>Regular</strong>, <strong>Próxima do Vencimento</strong> ou <strong>Vencida</strong>. Documentação vencida pode suspender seu acesso ao mural de pedidos — fique sempre em dia para não perder negócios.",
          side: "top",
          align: "start",
        },
      },

      // ── ASSINATURA & FATURAS ──────────────────────────────────────
      {
        element: '[data-tour="desmanche-finance"]',
        popover: {
          title: "Assinatura & Faturas",
          description:
            "Veja o seu plano atual, histórico de faturas pagas e faturas em aberto. O pagamento é feito via <strong>PIX ou boleto bancário</strong> gerado automaticamente. Manter a assinatura em dia é necessário para permanecer ativo na plataforma.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-finance"),
      },
      {
        element: '[data-tour="desmanche-finance"]',
        popover: {
          title: "Plano e Cobranças",
          description:
            "A cobrança é mensal e automática. Você recebe o link de pagamento por e-mail e também pode acessar suas faturas aqui. Em caso de problema com alguma cobrança, entre em contato pelo canal de Sugestões & Reclamações.",
          side: "right",
          align: "start",
        },
      },

      // ── PERFIL DA EMPRESA ─────────────────────────────────────────
      {
        element: '[data-tour="desmanche-profile"]',
        popover: {
          title: "Perfil da Empresa",
          description:
            "Seu cartão de visitas na plataforma. Clientes veem o seu perfil antes de aceitar uma proposta. Um perfil completo com <strong>logo, descrição e dados corretos</strong> transmite profissionalismo e aumenta a confiança.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-profile"),
      },
      {
        element: '[data-tour="desmanche-profile-content"]',
        popover: {
          title: "O que Manter Atualizado",
          description:
            "<ul style='margin:4px 0 0 16px;padding:0;list-style:disc'><li><strong>Logo</strong> — imagem de até 2MB</li><li><strong>Nome Fantasia & Telefone</strong> — contato para os clientes</li><li><strong>Responsável & CPF</strong> — dados do titular</li><li><strong>Endereço</strong> — aparece no mapa para clientes locais</li><li><strong>Tipos de Veículo</strong> — define quais pedidos você vê no mural</li></ul>",
          side: "top",
          align: "start",
        },
      },

      // ── SUGESTÕES & RECLAMAÇÕES ───────────────────────────────────
      {
        element: '[data-tour="desmanche-feedback"]',
        popover: {
          title: "Sugestões & Reclamações",
          description:
            "Canal direto com a equipe da Central dos Desmanches. Use para reportar problemas técnicos, sugerir melhorias, questionar cobranças ou pedir ajuda com qualquer situação que não se resolveu de outra forma. Respondemos por e-mail.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: nav("desmanche-feedback"),
      },
      {
        element: '[data-tour="desmanche-feedback-form"]',
        popover: {
          title: "Enviar uma Mensagem",
          description:
            "Escolha o tipo da mensagem (Sugestão, Reclamação ou Dúvida), escreva o que precisa e envie. Nossa equipe analisa cada mensagem e responde diretamente no seu e-mail cadastrado.",
          side: "top",
          align: "start",
        },
      },

      // ── HELP BUTTON ────────────────────────────────────────────────
      {
        element: '[data-tour="help-button"]',
        popover: {
          title: "Refaça este tour quando quiser",
          description:
            "O botão <strong>Ajuda</strong> fica sempre visível no cabeçalho do painel. Clique nele a qualquer momento para rever este guia completo.",
          side: "bottom",
          align: "end",
        },
      },
    ],
    onDestroyed: () => {
      markTourCompleted(userId, "desmanche");
    },
  });

  d.drive();
}
