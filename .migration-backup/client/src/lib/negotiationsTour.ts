import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

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

interface StartArgs {
  setActiveTab: (tab: string) => void;
  onFinish: () => void;
}

export function startDesmancheNegotiationsTour({ setActiveTab, onFinish }: StartArgs) {
  const steps: DriveStep[] = [
    {
      popover: {
        title: "Tour: Minhas Negociações",
        description:
          "Te mostro rapidinho as 3 abas desta página e o que aparece em cada uma. Coloquei um pedido de exemplo em cada aba pra você visualizar.",
      },
      onHighlightStarted: () => setActiveTab("propostas"),
    },
    {
      element: '[data-tour="neg-tab-propostas"]',
      popover: {
        title: "1. Propostas Enviadas",
        description:
          "Aqui ficam todas as propostas que você mandou no Mural de Pedidos. Divididas em 'Aguardando Resposta' (cliente ainda não viu/respondeu) e 'Respondidas' (aceitas ou recusadas).",
        side: "bottom",
        align: "start",
      },
      onHighlightStarted: () => setActiveTab("propostas"),
    },
    {
      element: '[data-tour="neg-sample-proposal"]',
      popover: {
        title: "Como aparece uma proposta",
        description:
          "Cada card mostra o pedido do cliente, sua mensagem, o valor proposto e o status. Quando o cliente responder, o card muda de cor e você é avisado.",
        side: "top",
        align: "center",
      },
      onHighlightStarted: () => setActiveTab("propostas"),
    },
    {
      element: '[data-tour="neg-tab-andamento"]',
      popover: {
        title: "2. Em Andamento",
        description:
          "Quando o cliente aceita uma proposta, ela vira uma negociação e aparece aqui. É onde acontece a venda — você combina o envio, informa o rastreio e acompanha até a entrega.",
        side: "bottom",
        align: "center",
      },
      onHighlightStarted: () => setActiveTab("andamento"),
    },
    {
      element: '[data-tour="neg-sample-negotiation"]',
      popover: {
        title: "Como aparece uma negociação ativa",
        description:
          "Aqui você vê os dados do cliente, o valor combinado e o botão 'Informar Envio da Peça' — clica nele assim que despachar pra registrar o código de rastreio.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="neg-tab-historico"]',
      popover: {
        title: "3. Histórico",
        description:
          "Tudo que já terminou fica aqui — vendas concluídas, canceladas, ou que não foram pra frente. Serve pra você consultar depois e acompanhar sua performance.",
        side: "bottom",
        align: "end",
      },
      onHighlightStarted: () => setActiveTab("historico"),
    },
    {
      element: '[data-tour="neg-sample-history"]',
      popover: {
        title: "Como aparece um pedido no histórico",
        description:
          "Pedidos no histórico ficam só pra consulta. Você vê o status final, valor e dados do cliente — tudo registrado.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="neg-close-demo"]',
      popover: {
        title: "Pronto!",
        description:
          "Agora é só clicar em 'Fechar exemplo' pra voltar pros seus dados reais. Se quiser rever, é só clicar de novo em 'Ver tour com exemplos'.",
        side: "bottom",
        align: "end",
      },
    },
  ];

  const d = driver({
    ...COMMON_OPTS,
    steps,
    onDestroyed: () => {
      onFinish();
    },
  });

  d.drive();
}
