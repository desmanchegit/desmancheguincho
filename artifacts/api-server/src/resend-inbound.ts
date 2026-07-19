import { Resend } from "resend";
import type { Request, Response } from "express";

const inboxAddress = "contato@centraldosdesmanches.com.br";

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

function isInboxRecipient(addresses: unknown): boolean {
  if (!Array.isArray(addresses)) return false;
  return addresses.some((value) => {
    if (typeof value !== "string") return false;
    const email = value.match(/<([^>]+)>/)?.[1] ?? value;
    return email.trim().toLowerCase() === inboxAddress;
  });
}

export async function receiveAndForwardResendEmail(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const forwardTo = process.env.RESEND_FORWARD_TO;
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  const id = getHeader(req, "svix-id");
  const timestamp = getHeader(req, "svix-timestamp");
  const signature = getHeader(req, "svix-signature");

  if (!apiKey || !webhookSecret || !forwardTo) {
    req.log.error("Resend inbound forwarding is not configured");
    res.status(503).json({ message: "Recebimento de e-mail não configurado." });
    return;
  }
  if (!rawBody || !id || !timestamp || !signature) {
    res.status(400).json({ message: "Webhook inválido." });
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const event = resend.webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (event.type !== "email.received") {
      res.status(204).end();
      return;
    }
    if (!isInboxRecipient(event.data.to)) {
      req.log.info({ emailId: event.data.email_id }, "Ignored inbound email for another address");
      res.status(204).end();
      return;
    }

    const { error } = await resend.emails.receiving.forward({
      emailId: event.data.email_id,
      from: inboxAddress,
      to: forwardTo,
    });
    if (error) {
      req.log.error({ error, emailId: event.data.email_id }, "Failed to forward inbound Resend email");
      res.status(502).json({ message: "Não foi possível encaminhar o e-mail." });
      return;
    }

    req.log.info({ emailId: event.data.email_id, forwardTo }, "Inbound email forwarded");
    res.status(204).end();
  } catch (error) {
    req.log.warn({ error }, "Invalid Resend inbound webhook");
    res.status(400).json({ message: "Assinatura de webhook inválida." });
  }
}
