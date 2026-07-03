import nodemailer from "nodemailer";

function getAppUrl() {
  return process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

async function sendMail(to: string, subject: string, html: string) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM || "Central dos Desmanches <noreply@centraldesmanches.com.br>";
  if (!transport) {
    console.log(`\n📧 [EMAIL - sem SMTP configurado]\nPara: ${to}\nAssunto: ${subject}\n${html.replace(/<[^>]+>/g, " ")}\n`);
    return;
  }
  await transport.sendMail({ from, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${getAppUrl()}/verificar-email?token=${token}`;
  await sendMail(
    to,
    "Confirme seu email — Central dos Desmanches",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <h2 style="color:#1e293b;margin-bottom:8px;">Confirme seu e-mail</h2>
      <p style="color:#475569;">Olá! Clique no botão abaixo para ativar sua conta na <strong>Central dos Desmanches</strong>.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Verificar meu e-mail
      </a>
      <p style="color:#94a3b8;font-size:13px;">O link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Ou copie e cole este link:<br/><a href="${link}" style="color:#f97316;">${link}</a></p>
    </div>
    `
  );
}

export async function sendModerationNotificationEmail(opts: {
  clientEmail: string;
  clientName: string;
  desmancheEmail: string;
  desmancheName: string;
  orderTitle: string;
  negotiationId: string;
}) {
  const { clientEmail, clientName, desmancheEmail, desmancheName, orderTitle, negotiationId } = opts;
  const appUrl = getAppUrl();

  const sharedBody = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <span style="font-size:28px;">⚖️</span>
        <h2 style="color:#1e293b;margin:0;">Negociação em Moderação</h2>
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="color:#9a3412;font-weight:600;margin:0 0 6px 0;font-size:14px;">📦 Pedido</p>
        <p style="color:#7c2d12;margin:0;font-size:14px;">${orderTitle}</p>
      </div>
  `;

  const sharedFooter = `
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        Você receberá outra notificação assim que a moderação encerrar o caso.<br/>
        <a href="${appUrl}" style="color:#f97316;">Acessar plataforma</a> · Referência: <code>${negotiationId}</code>
      </p>
    </div>
  `;

  const results = await Promise.allSettled([
    sendMail(
      clientEmail,
      "Sua negociação está em moderação — Central dos Desmanches",
      `${sharedBody}
      <p style="color:#475569;">Olá, <strong>${clientName}</strong>!</p>
      <p style="color:#475569;">
        Detectamos uma divergência entre as informações fornecidas pelo desmanche e as suas sobre o pedido acima.
        Por isso, a negociação foi encaminhada para análise pela nossa equipe de moderação.
      </p>
      <p style="color:#475569;">
        <strong>O que acontece agora?</strong><br/>
        Nossa equipe irá revisar o caso e tomar a decisão mais justa para ambas as partes.
        Você não precisa fazer nada — aguarde nosso contato.
      </p>
    ${sharedFooter}`
    ),
    sendMail(
      desmancheEmail,
      "Negociação encaminhada à moderação — Central dos Desmanches",
      `${sharedBody}
      <p style="color:#475569;">Olá, <strong>${desmancheName}</strong>!</p>
      <p style="color:#475569;">
        Detectamos uma divergência entre as informações que você forneceu e as do cliente sobre o pedido acima.
        A negociação foi encaminhada para análise pela nossa equipe de moderação.
      </p>
      <p style="color:#475569;">
        <strong>O que acontece agora?</strong><br/>
        Nossa equipe irá revisar o caso e tomar a decisão mais justa para ambas as partes.
        Você não precisa fazer nada — aguarde nosso contato.
      </p>
    ${sharedFooter}`
    ),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const recipient = i === 0 ? clientEmail : desmancheEmail;
      console.error(`Moderation email failed for ${recipient}:`, result.reason);
    }
  });
}

export async function sendWelcomeClientEmail(to: string, name: string) {
  const appUrl = getAppUrl();
  await sendMail(
    to,
    "Bem-vindo à Central dos Desmanches! 🎉",
    `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:36px 32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Central dos Desmanches</h1>
        <p style="color:#fed7aa;margin:8px 0 0 0;font-size:14px;">A maior rede de desmanches credenciados do Brasil</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1e293b;margin:0 0 8px 0;font-size:20px;">Olá, ${name}! Seja bem-vindo(a) 👋</h2>
        <p style="color:#475569;margin:0 0 24px 0;line-height:1.6;">Sua conta foi criada com sucesso. Agora você tem acesso a <strong>centenas de desmanches credenciados</strong> prontos para atender seu pedido de peças.</p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h3 style="color:#1e293b;margin:0 0 14px 0;font-size:15px;">📋 Como funciona em 3 passos:</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#f97316;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">1</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Publique seu pedido</strong> — descreva a peça que precisa, o veículo e o nível de urgência.</p>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#f97316;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">2</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Receba propostas</strong> — desmanches credenciados enviam preço e condições diretamente para você.</p>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#f97316;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">3</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Negocie e feche</strong> — escolha a melhor proposta, combine o envio e avalie o parceiro.</p>
            </div>
          </div>
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="color:#9a3412;margin:0;font-size:13px;">⚠️ <strong>Antes de criar seu primeiro pedido:</strong> complete seu perfil com WhatsApp e endereço de entrega para que os desmanches possam fazer propostas completas.</p>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${appUrl}/cliente" style="display:inline-block;padding:14px 32px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Acessar minha conta →
          </a>
        </div>

        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Dúvidas? Acesse nosso <a href="${appUrl}/como-funciona" style="color:#f97316;">guia completo</a> ou responda este e-mail.</p>
      </div>
      <div style="background:#f1f5f9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">© Central dos Desmanches · <a href="${appUrl}" style="color:#94a3b8;">${appUrl}</a></p>
      </div>
    </div>
    `
  );
}

export async function sendWelcomeDesmancheEmail(to: string, tradingName: string) {
  const appUrl = getAppUrl();
  await sendMail(
    to,
    "Cadastro recebido — Central dos Desmanches 🔧",
    `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:36px 32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Central dos Desmanches</h1>
        <p style="color:#94a3b8;margin:8px 0 0 0;font-size:14px;">Plataforma para desmanches credenciados</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1e293b;margin:0 0 8px 0;font-size:20px;">Olá, ${tradingName}! 🎉</h2>
        <p style="color:#475569;margin:0 0 24px 0;line-height:1.6;">Seu cadastro foi recebido com sucesso e está sendo <strong>analisado pela nossa equipe</strong>. Assim que aprovado, você terá acesso completo ao painel de parceiro.</p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h3 style="color:#166534;margin:0 0 12px 0;font-size:15px;">✅ O que acontece agora:</h3>
          <ul style="color:#15803d;margin:0;padding-left:18px;font-size:14px;line-height:1.8;">
            <li>Nossa equipe analisa seus documentos (em até 2 dias úteis)</li>
            <li>Você recebe um e-mail de confirmação quando aprovado</li>
            <li>Acesso liberado ao painel de pedidos e negociações</li>
          </ul>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h3 style="color:#1e293b;margin:0 0 14px 0;font-size:15px;">🚀 Como funciona a plataforma para você:</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#0f172a;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">1</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Acesse o Mural de Pedidos</strong> — veja em tempo real as peças que clientes estão buscando.</p>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#0f172a;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">2</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Envie propostas</strong> — informe preço, prazo e condições para os pedidos que você tem em estoque.</p>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="background:#0f172a;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:24px;text-align:center;">3</span>
              <p style="color:#475569;margin:0;font-size:14px;line-height:1.5;"><strong style="color:#1e293b;">Negocie e entregue</strong> — gerencie tudo pelo painel: envio, rastreamento e avaliações.</p>
            </div>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${appUrl}/desmanche" style="display:inline-block;padding:14px 32px;background:#1e293b;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Acessar meu painel →
          </a>
        </div>

        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">Aguardando aprovação? Você pode fazer login e acompanhar o status do cadastro no painel.</p>
      </div>
      <div style="background:#f1f5f9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">© Central dos Desmanches · <a href="${appUrl}" style="color:#94a3b8;">${appUrl}</a></p>
      </div>
    </div>
    `
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${getAppUrl()}/redefinir-senha?token=${token}`;
  await sendMail(
    to,
    "Redefinição de senha — Central dos Desmanches",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <h2 style="color:#1e293b;margin-bottom:8px;">Redefinir senha</h2>
      <p style="color:#475569;">Recebemos uma solicitação de redefinição de senha para a sua conta na <strong>Central dos Desmanches</strong>.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Redefinir minha senha
      </a>
      <p style="color:#94a3b8;font-size:13px;">O link expira em 1 hora. Se você não solicitou isso, ignore este e-mail.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Ou copie e cole este link:<br/><a href="${link}" style="color:#f97316;">${link}</a></p>
    </div>
    `
  );
}
