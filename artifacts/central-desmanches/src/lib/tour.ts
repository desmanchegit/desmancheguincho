import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type TourRole = "client" | "desmanche" | "admin";

const STORAGE_PREFIX = "tour_completed_v1";

const COMMON_OPTS = {
  showProgress: true,
  allowClose: true,
  overlayColor: "rgba(0, 0, 0, 0.6)",
  stagePadding: 6,
  stageRadius: 8,
  popoverClass: "cdesmanches-tour",
  nextBtnText: "Próximo",
  prevBtnText: "Voltar",
  doneBtnText: "Finalizar",
  progressText: "{{current}} de {{total}}",
};

const clientSteps: DriveStep[] = [
  {
    popover: {
      title: "Bem-vindo à Central dos Desmanches!",
      description:
        "Vou te mostrar rapidinho como usar o seu painel para encontrar as peças que precisa. É só seguir os próximos passos.",
    },
  },
  {
    element: '[data-tour="client-overview"]',
    popover: {
      title: "Meu Painel",
      description:
        "Aqui você tem um resumo de tudo: pedidos ativos, propostas recebidas e atalhos rápidos pras ações principais.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-orders"]',
    popover: {
      title: "Meus Pedidos",
      description:
        "Toda solicitação de peça que você fizer aparece aqui. É também o lugar pra criar um novo pedido — clicando em 'Solicitar Peça' você abre o formulário guiado.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-proposals"]',
    popover: {
      title: "Propostas",
      description:
        "Quando os desmanches responderem ao seu pedido, as ofertas chegam aqui com preço, condições e fotos. Você compara e escolhe a melhor.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-negotiations"]',
    popover: {
      title: "Negociações",
      description:
        "Ao aceitar uma proposta, ela vira uma negociação. Aqui você acompanha o andamento até a peça chegar até você.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-negotiations"]',
    popover: {
      title: "⚠️ Sempre informe o resultado da negociação",
      description:
        "Esse passo é fundamental. Sempre que uma negociação terminar — seja porque a peça chegou, porque você desistiu ou porque o desmanche não cumpriu o combinado — marque o resultado aqui. É só assim que a plataforma consegue te ajudar caso aconteça algum problema, mediar conflitos e proteger seus direitos. Negociações sem retorno ficam sem cobertura.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-chat"]',
    popover: {
      title: "Mensagens",
      description:
        "Converse direto com os desmanches pra tirar dúvidas, pedir mais fotos ou combinar entrega. Tudo registrado no chat — e essas conversas servem como prova caso algo dê errado.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-negotiations"]',
    popover: {
      title: "⭐ Avalie o desmanche ao final",
      description:
        "Depois que a negociação fechar, deixe sua avaliação na tela de Negociações. Sua nota e comentário ajudam outros clientes a escolherem com segurança e premiam os desmanches que atendem bem. Avaliar leva 30 segundos e fortalece toda a comunidade.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-profile"]',
    popover: {
      title: "Meu Perfil",
      description:
        "Mantenha seus dados, WhatsApp e endereço sempre atualizados — isso ajuda os desmanches a fecharem negócio com você mais rápido.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="client-feedback"]',
    popover: {
      title: "Sugestões & Reclamações",
      description:
        "Esse é o canal direto com a equipe da Central. Use pra mandar sugestões de melhoria, relatar problemas com algum desmanche ou pedir ajuda com qualquer situação que o suporte normal não resolveu. Sua voz nos ajuda a melhorar a plataforma.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="help-button"]',
    popover: {
      title: "Refaça o tour quando quiser",
      description:
        "Esse botão de ajuda fica sempre disponível. Se quiser rever este passo a passo, é só clicar nele.",
      side: "bottom",
      align: "end",
    },
  },
];

const desmancheSteps: DriveStep[] = [
  {
    popover: {
      title: "Bem-vindo, parceiro!",
      description:
        "Vou te apresentar rapidamente o painel do desmanche. Aqui é onde você recebe pedidos, envia propostas e gerencia suas vendas.",
    },
  },
  {
    element: '[data-tour="desmanche-overview"]',
    popover: {
      title: "Meu Painel",
      description:
        "Visão geral do seu negócio: pedidos novos, propostas em andamento, faturamento e atalhos rápidos.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-orders"]',
    popover: {
      title: "Mural de Pedidos",
      description:
        "É o coração da plataforma. Aqui aparecem todas as solicitações de peças dos clientes. Filtre por marca, tipo de veículo ou categoria, escolha o que faz sentido pra você e envie sua proposta.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-negotiations"]',
    popover: {
      title: "Minhas Negociações",
      description:
        "Acompanhe os pedidos onde você já enviou proposta — quais estão em conversa, quais foram aceitos e quais já fecharam.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-negotiations"]',
    popover: {
      title: "Conta pra gente como terminou",
      description:
        "Sempre que uma negociação chegar ao fim — venda fechada, cliente desistiu ou simplesmente não respondeu — marca aqui o status. Isso ajuda a manter seus números organizados, sua reputação coerente com o que realmente aconteceu e permite que a gente entenda melhor o seu dia a dia pra apoiar quando precisar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-negotiations"]',
    popover: {
      title: "⭐ Boas avaliações = mais negócios",
      description:
        "Os clientes vão avaliar o seu atendimento ao final de cada negociação. Atender com agilidade, ser honesto sobre o estado da peça e cumprir o combinado eleva sua nota — e sua nota é o que faz novos clientes confiarem em você antes da concorrência.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-ads"]',
    popover: {
      title: "Meus Anúncios",
      description:
        "Tem peças paradas no estoque? Anuncie aqui pra que os clientes encontrem antes mesmo de fazer um pedido.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-docs"]',
    popover: {
      title: "Minha Documentação",
      description:
        "Mantenha sua licença do Detran e demais documentos sempre em dia. A gente avisa quando algo estiver perto de vencer.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-finance"]',
    popover: {
      title: "Assinatura & Faturas",
      description:
        "Veja seu plano atual, faturas pagas e em aberto, e gerencie a sua assinatura.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="desmanche-profile"]',
    popover: {
      title: "Perfil da Empresa",
      description:
        "Atualize logo, dados de contato e tipos de veículos que você atende — assim os clientes confiam mais e fecham negócio.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="help-button"]',
    popover: {
      title: "Refaça o tour quando quiser",
      description:
        "Esse botão de ajuda fica sempre disponível. Se precisar rever, é só clicar.",
      side: "bottom",
      align: "end",
    },
  },
];

const adminSteps: DriveStep[] = [
  {
    popover: {
      title: "Painel Administrativo",
      description:
        "Vou te mostrar rapidamente as áreas do painel admin. Você gerencia desmanches, usuários, pedidos e a operação inteira por aqui.",
    },
  },
  {
    element: '[data-tour="admin-overview"]',
    popover: {
      title: "Visão Geral",
      description:
        "Indicadores principais da plataforma: cadastros, pedidos, negociações e receita.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-approvals"]',
    popover: {
      title: "Aprovações",
      description:
        "Cadastros de desmanches aguardando análise. Aqui você confere a documentação e aprova ou recusa.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-desmanches"]',
    popover: {
      title: "Desmanches",
      description:
        "Lista completa dos desmanches credenciados. Veja detalhes, edite status e acompanhe a performance de cada um.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-users"]',
    popover: {
      title: "Pessoas Cadastradas",
      description:
        "Todos os clientes da plataforma. Veja perfis, histórico de pedidos e gerencie contas.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-orders"]',
    popover: {
      title: "Anúncios / Pedidos",
      description:
        "Todos os pedidos e anúncios da plataforma. Use pra moderar, acompanhar negociações ou resolver pendências.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-finance"]',
    popover: {
      title: "Assinaturas & Receitas",
      description:
        "Acompanhe pagamentos, faturas e a receita gerada pelos desmanches.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-reports"]',
    popover: {
      title: "Relatórios",
      description:
        "Estatísticas detalhadas pra entender o crescimento da plataforma e tomar decisões.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-moderation"]',
    popover: {
      title: "Moderação",
      description:
        "Itens que precisam da sua atenção: conteúdo suspeito, denúncias e pendências da operação.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-complaints"]',
    popover: {
      title: "Reclamações",
      description:
        "Reclamações abertas por clientes ou desmanches. Trate cada caso e mantenha a saúde da plataforma.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="help-button"]',
    popover: {
      title: "Refaça o tour quando quiser",
      description:
        "Esse botão de ajuda fica sempre disponível. Se precisar rever, é só clicar.",
      side: "bottom",
      align: "end",
    },
  },
];

const STEPS_BY_ROLE: Record<TourRole, DriveStep[]> = {
  client: clientSteps,
  desmanche: desmancheSteps,
  admin: adminSteps,
};

function storageKey(userId: string, role: TourRole) {
  return `${STORAGE_PREFIX}_${role}_${userId}`;
}

export function hasCompletedTour(userId: string, role: TourRole): boolean {
  try {
    return localStorage.getItem(storageKey(userId, role)) === "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(userId: string, role: TourRole) {
  try {
    localStorage.setItem(storageKey(userId, role), "1");
  } catch {
    /* noop */
  }
}

export function startTour(userId: string, role: TourRole) {
  const steps = STEPS_BY_ROLE[role];
  if (!steps || steps.length === 0) return;

  const filteredSteps = steps.filter((step) => {
    if (!step.element) return true;
    const selector = step.element as string;
    return !!document.querySelector(selector);
  });

  if (filteredSteps.length === 0) return;

  const d = driver({
    ...COMMON_OPTS,
    steps: filteredSteps,
    onDestroyed: () => {
      markTourCompleted(userId, role);
    },
  });

  d.drive();
}

export function maybeAutoStartTour(userId: string, role: TourRole, delayMs = 700) {
  if (!userId) return;
  if (hasCompletedTour(userId, role)) return;
  setTimeout(() => startTour(userId, role), delayMs);
}
