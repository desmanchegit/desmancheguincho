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
  doneBtnText: "Entendi",
  progressText: "{{current}} de {{total}}",
};

export function startDesmancheFinanceTour() {
  const steps: DriveStep[] = [
    {
      popover: {
        title: "Como funciona a cobrança",
        description:
          "Te explico em poucos passos como funciona o pagamento das negociações aqui na Central. É bem simples.",
      },
    },
    {
      element: '[data-tour="finance-model"]',
      popover: {
        title: "1. Cobrança por negociação",
        description:
          "Toda vez que uma negociação é concluída e avaliada, é gerada uma pequena cobrança no valor mostrado aqui. Você não paga uma a uma — elas ficam acumulando no mês.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="finance-cycle"]',
      popover: {
        title: "2. Ciclo mensal",
        description:
          "Aqui você acompanha o ciclo do mês: quantas negociações já foram concluídas, quanto está acumulado e quantos dias faltam pro fechamento.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="finance-history"]',
      popover: {
        title: "3. Histórico de operações",
        description:
          "Todas as suas operações aparecem nesta lista. Enquanto o ciclo está aberto, elas ficam com status 'Acumulando'. Quando o mês fecha, mudam pra 'Faturado'.",
        side: "top",
        align: "center",
      },
    },
    {
      popover: {
        title: "4. No fim do mês, vira um boleto só",
        description:
          "No fechamento do ciclo (a cada 30 dias), todas as cobranças acumuladas viram uma única fatura — você paga tudo de uma vez por boleto bancário ou PIX. Sem dor de cabeça com várias cobranças avulsas.",
      },
    },
  ];

  const d = driver({
    ...COMMON_OPTS,
    steps,
  });

  d.drive();
}
