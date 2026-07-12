import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";

interface GuinchoContractModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GuinchoContractModal({ open, onClose }: GuinchoContractModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Contrato de Prestação de Serviços de Divulgação
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Central dos Desmanches — leia antes de concluir o cadastro
          </p>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-600 leading-relaxed">

          <Section title="1. Partes">
            De um lado, <strong>Central dos Desmanches</strong>, administradora da plataforma de divulgação
            de serviços, doravante denominada <strong>CONTRATADA</strong>.
            <br /><br />
            De outro lado, o profissional ou empresa prestadora de serviços de guincho/plataforma,
            devidamente cadastrada na plataforma, doravante denominada <strong>CONTRATANTE</strong>.
          </Section>

          <Section title="2. Objeto">
            O presente contrato tem por objeto a divulgação dos dados de contato e da região de atuação
            do CONTRATANTE na plataforma da Central dos Desmanches, permitindo que clientes interessados
            em serviços de guincho encontrem seus contatos.
          </Section>

          <Section title="3. Planos e Pagamento">
            O CONTRATANTE poderá optar por uma das seguintes modalidades:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Plano Mensal:</strong> R$ 10,00 (dez reais) por mês.</li>
              <li><strong>Plano Anual:</strong> R$ 80,00 (oitenta reais), pagos em parcela única, com validade de 12 (doze) meses.</li>
            </ul>
            <p className="mt-2">A divulgação permanecerá ativa enquanto o plano contratado estiver vigente.</p>
          </Section>

          <Section title="4. Responsabilidades da Central dos Desmanches">
            A Central dos Desmanches compromete-se exclusivamente a divulgar os dados de contato e a
            região de atuação do CONTRATANTE.
            <br /><br />
            A Central dos Desmanches não realiza intermediação, não participa da negociação, não agenda
            serviços, não recebe valores das corridas, não cobra comissão e não possui qualquer
            responsabilidade pela prestação do serviço de guincho, sendo toda negociação realizada
            diretamente entre cliente e prestador.
          </Section>

          <Section title="5. Responsabilidades do Contratante">
            O CONTRATANTE declara que possui autorização para exercer sua atividade, sendo o único
            responsável pela qualidade dos serviços prestados, pelos valores cobrados, pelo cumprimento
            dos horários, pela emissão de documentos fiscais quando exigidos por lei e por quaisquer
            obrigações legais decorrentes de sua atividade.
            <br /><br />
            Também é de responsabilidade do CONTRATANTE manter seus dados cadastrais e contatos sempre
            atualizados.
          </Section>

          <Section title="6. Limitação de Responsabilidade">
            A Central dos Desmanches não responde por atrasos, cancelamentos, acidentes, danos materiais,
            danos morais, perdas, prejuízos, inadimplência, conflitos comerciais ou qualquer outra
            situação decorrente da contratação realizada entre cliente e prestador de serviço.
            <br /><br />
            Toda responsabilidade pela execução do serviço é exclusiva do CONTRATANTE.
          </Section>

          <Section title="7. Nova Plataforma">
            A Central dos Desmanches informa que está desenvolvendo uma nova plataforma on-line de
            localização do guincho mais próximo do cliente.
            <br /><br />
            Todos os prestadores com cadastro ativo serão migrados gratuitamente para essa nova
            plataforma, sem cobrança de taxa adicional pela migração, preservando os benefícios do plano
            vigente.
          </Section>

          <Section title="8. Vigência">
            O presente contrato vigorará durante o período correspondente ao plano contratado, podendo
            ser renovado mediante novo pagamento.
          </Section>

          <Section title="9. Disposições Finais">
            O cadastro na plataforma implica a aceitação integral dos termos deste contrato.
            <br /><br />
            Qualquer alteração nas condições de divulgação será comunicada previamente aos cadastrados.
          </Section>

          <Section title="10. Foro">
            Fica eleito o foro da Comarca de São Luís, Estado do Maranhão, para dirimir quaisquer
            controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais
            privilegiado que seja.
          </Section>

          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            Central dos Desmanches — www.centraldosdesmanches.com.br
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
