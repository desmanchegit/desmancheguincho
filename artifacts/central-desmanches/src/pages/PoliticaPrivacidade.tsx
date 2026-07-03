import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Central dos Desmanches</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-slate-700 leading-relaxed">
          <div className="text-center space-y-2 pb-4 border-b">
            <h1 className="text-2xl font-bold text-slate-900">
              Política de Privacidade e Termos de Uso
            </h1>
            <p className="text-sm text-muted-foreground">
              CENTRAL DOS DESMANCHES ATIVIDADES DE INTERNET LTDA – ME<br />
              CNPJ nº 45.450.395/0001-62
            </p>
          </div>

          <Section title="">
            <p>
              Olá, seja bem-vindo ao portal da Central dos Desmanches! A seguir apresentaremos a você a nossa
              POLÍTICA DE PRIVACIDADE E TERMOS DE USO. Para todos os usuários que utilizam os serviços da
              Central dos Desmanches é importante a leitura e entendimento deste documento. Antes de se
              cadastrar ou mesmo navegar em nosso site ou aplicativo, esteja ciente e de acordo com todos os
              termos. Caso não haja entendimento de algum termo, o usuário poderá entrar em contato com a
              empresa para sanar suas dúvidas.
            </p>
          </Section>

          <Section title="">
            <p>
              Esta Política de Privacidade e Termo de Uso descrevem as práticas da CENTRAL DOS DESMANCHES
              ATIVIDADES DE INTERNET LTDA-ME em relação às informações fornecidas para criar cadastros
              (contas), divulgar ou visualizar anúncios e trocar informações sobre serviços utilizando o
              nosso aplicativo ou website: <strong>www.centraldosdesmanches.com.br</strong>. A política de
              privacidade e termo de uso destina-se a qualquer estabelecimento comercial que se cadastrar
              e/ou utilizar os serviços disponibilizados, sendo igualmente aplicada a todos os usuários.
            </p>
          </Section>

          <Section title="">
            <p>
              Ao acessar o website <strong>www.centraldosdesmanches.com.br</strong> ou realizar o download
              de nosso aplicativo é necessário a leitura e entendimento das Políticas de Privacidade e
              Termos de Uso. O uso de quaisquer serviços e ferramentas integradas significa que <strong>VOCÊ LEU,
              entendeu e consentiu</strong> com esta Política de Privacidade e com os Termos de Uso de cada serviço
              que você acessar ou usar. No uso de nossos serviços, o usuário deverá obedecer a legislação
              vigente, a moral, a ordem pública e os bons costumes.
            </p>
          </Section>

          <Section title="Publicidade e Links de Terceiros">
            <p>
              Ao acessar o website ou aplicativo você deverá estar ciente sobre eventuais propagandas que
              podem conter endereços eletrônicos ou links que o direcionem para outros sites de terceiros.
              Ao acessá-los, não temos responsabilidades sobre seus conteúdos, passando desta forma a ser
              de sua responsabilidade a leitura e entendimento das regras e termos de uso desse site terceiro.
            </p>
          </Section>

          <Section title="Consentimento e Dados Pessoais">
            <p>
              A divulgação dos dados em nosso website ou aplicativo sempre será realizada após o
              consentimento do responsável pelo cadastro. Desta forma, ao criar ou atualizar seu cadastro o
              usuário consente em informar seus dados pessoais, do estabelecimento, criar uma senha, usar
              informações comerciais, endereços eletrônicos e IP, recebimento de mensagens eletrônicas,
              tráfego de dados, entre outros. Após efetivar o cadastro o usuário poderá acessar, atualizar
              ou excluir seus dados pessoais a qualquer momento.
            </p>
          </Section>

          <Section title="Criação de Conta">
            <p>
              A criação de uma conta é obrigatória para usuários comerciais que desejam divulgar seus
              estabelecimentos ou publicar anúncios, sendo necessário para o acesso desta conta o
              fornecimento do login e senha criados pelo próprio usuário no cadastro. Para usuários que
              utilizam o website ou aplicativo para pesquisa, a criação de uma conta pode ser ou não
              obrigatória de acordo com os serviços prestados.
            </p>
          </Section>

          <Section title="Planos e Pagamentos">
            <p>
              A CENTRAL DOS DESMANCHES poderá cobrar pelos serviços prestados aos usuários comerciais pela
              divulgação e publicidade de anúncios e serviços através da escolha de planos disponibilizados
              com suas respectivas informações e valores em nosso website. Cada plano compõe uma contratação
              única, cujas condições de pagamento serão disponibilizadas no momento da contratação. Cabe ao
              usuário monitorar o saldo e o tempo de validade de cada plano.
            </p>
          </Section>

          <Section title="Informações do Cadastro">
            <p>
              A criação da conta se dará após preenchimento de formulário onde serão solicitadas
              informações como: nome completo, e-mail, número de telefone, CPF, criação do login e senha,
              nome do estabelecimento, seguimento de atuação, website, CNPJ, endereço comercial, telefones
              comerciais e logomarca. A CENTRAL DOS DESMANCHES divulgará nos resultados das buscas
              informações comerciais tais como: nome do estabelecimento, endereço comercial, telefone,
              horário de funcionamento e logomarca.
            </p>
          </Section>

          <Section title="Login, Senha e Sigilo">
            <p>
              O login e a senha são intransferíveis, cabendo a responsabilidade do sigilo ao usuário. Caso
              suspeite que a confidencialidade de sua senha tenha sido quebrada, o usuário deverá proceder
              de forma imediata à sua troca. Em hipótese alguma o usuário poderá emprestar, ceder ou
              comercializar sua conta a qualquer outro interessado. O desacordo deste termo acarretará em
              penalidades, tais como: exclusão da conta e ressarcimento de todos os danos.
            </p>
          </Section>

          <Section title="Compartilhamento de Informações">
            <p>
              A CENTRAL DOS DESMANCHES poderá armazenar ou transmitir suas informações aos nossos parceiros
              comerciais e afiliados, incluindo informação pessoal e informações de contato. O usuário deve
              estar ciente e concordar que a base de dados poderá ser total ou parcialmente cedida ou
              transferida a terceiros, desde que respeitada a finalidade de dar continuidade à atividade
              prestada ou se existir obrigatoriedade legal neste sentido.
            </p>
          </Section>

          <Section title="Segurança e Responsabilidade">
            <p>
              A CENTRAL DOS DESMANCHES se compromete em manter todos seus esforços para a disponibilidade
              contínua e permanente dos serviços, no entanto, pode ocorrer eventualmente alguma
              indisponibilidade temporária decorrente de manutenção, desastres naturais, colapsos ou falhas
              nos sistemas de conexão com internet ou por motivos de força maior.
            </p>
            <p className="mt-2">
              Em hipótese alguma é permitido o acesso ao banco de dados, áreas de programação ou qualquer
              outro conjunto que faça parte da atividade de Webmaster da CENTRAL DOS DESMANCHES. Também não
              é autorizado ao usuário copiar, modificar, reproduzir, publicar, divulgar, distribuir,
              decompilar ou aplicar engenharia reversa.
            </p>
          </Section>

          <Section title="Pagamentos Online">
            <p>
              A CENTRAL DOS DESMANCHES poderá utilizar serviços terceirizados de empresas de gerenciamento
              de pagamentos online. O usuário deve estar ciente de que tais empresas poderão coletar e
              armazenar informações e dados do usuário. A CENTRAL DOS DESMANCHES não processa pagamentos
              online e não armazena informações de cartões de crédito dos usuários.
            </p>
          </Section>

          <Section title="Notificações e Marketing">
            <p>
              Ao utilizar nosso website ou aplicativo, independente da realização do cadastro, implica na
              aceitação desta política de privacidade e termos de uso. O usuário poderá receber
              notificações, mensagens e e-mails sobre informações e campanhas de marketing. O usuário
              poderá a qualquer momento solicitar o cancelamento do recebimento destas mensagens pelo
              e-mail: <strong>contato@centraldosdesmanches.com.br</strong>.
            </p>
          </Section>

          <Section title="Contato">
            <p>
              Dúvidas, sugestões ou reclamações sobre esta Política de Privacidade e Termos de Uso poderão
              ser enviadas para:{" "}
              <a href="mailto:contato@centraldosdesmanches.com.br" className="text-primary hover:underline">
                contato@centraldosdesmanches.com.br
              </a>{" "}
              ou pelo telefone <strong>(51) 9 8598-6668</strong>.
            </p>
          </Section>

          <div className="border-t pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Central dos Desmanches Atividades de Internet Ltda-ME — CNPJ 45.450.395/0001-62<br />
              www.centraldosdesmanches.com.br
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title && <h2 className="font-semibold text-slate-900 text-base">{title}</h2>}
      <div className="text-sm text-slate-600">{children}</div>
    </div>
  );
}
