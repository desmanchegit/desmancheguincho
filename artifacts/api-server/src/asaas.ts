let _apiKey: string = process.env.ASAAS_API_KEY || "";
let _environment: string = process.env.ASAAS_ENVIRONMENT || "sandbox";

function getBaseUrl() {
  return _environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "access_token": _apiKey,
  };
}

export function setAsaasConfig(apiKey: string, environment: string) {
  _apiKey = apiKey;
  _environment = environment;
}

export function isAsaasConfigured(): boolean {
  return !!_apiKey;
}

export function getAsaasEnvironment(): string {
  return _environment;
}

export async function createAsaasCustomer(data: {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}): Promise<{ id: string } | { error: string } | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/customers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      }),
    });
    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      const firstError = errBody?.issues?.[0]?.description || "Erro ao criar cliente";
      console.error("Asaas create customer error:", JSON.stringify(errBody));
      return { error: firstError };
    }
    return (await res.json()) as { id: string };
  } catch (e) {
    console.error("Asaas customer error:", e);
    return null;
  }
}

export async function createAsaasCharge(data: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
}): Promise<{ id: string; invoiceUrl?: string; bankSlipUrl?: string; status: string } | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/payments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        customer: data.customerId,
        billingType: data.billingType,
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Asaas create charge error:", err);
      return null;
    }
    return (await res.json()) as { id: string; invoiceUrl?: string; bankSlipUrl?: string; status: string };
  } catch (e) {
    console.error("Asaas charge error:", e);
    return null;
  }
}

export async function getAsaasChargeStatus(chargeId: string): Promise<string | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/payments/${chargeId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.status;
  } catch (e) {
    console.error("Asaas get charge error:", e);
    return null;
  }
}

export async function createAsaasSubscription(data: {
  customerId: string;
  value: number;
  nextDueDate: string;
  description: string;
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  cycle: "MONTHLY" | "YEARLY";
}): Promise<{ id: string; invoiceUrl?: string; status: string } | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/subscriptions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        customer: data.customerId,
        billingType: data.billingType,
        value: data.value,
        nextDueDate: data.nextDueDate,
        description: data.description,
        cycle: data.cycle,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Asaas create subscription error:", err);
      return null;
    }
    return (await res.json()) as { id: string; invoiceUrl?: string; status: string };
  } catch (e) {
    console.error("Asaas subscription error:", e);
    return null;
  }
}

export function getDueDateString(daysFromNow: number = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}
