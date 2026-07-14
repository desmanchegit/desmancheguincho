let _apiKey: string = process.env.ASAAS_API_KEY || "";
let _environment: string = process.env.ASAAS_ENVIRONMENT || "sandbox";
let _baseUrlForTests: string | undefined;

function getBaseUrl() {
  if (_baseUrlForTests) return _baseUrlForTests;
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

// Test-only override so HTTP behavior can be verified without contacting Asaas.
export function setAsaasBaseUrlForTests(baseUrl: string | undefined) {
  _baseUrlForTests = baseUrl;
}

export function isAsaasConfigured(): boolean {
  return !!_apiKey;
}

export function getAsaasEnvironment(): string {
  return _environment;
}

type AsaasOperation = "create customer" | "create charge" | "get charge" | "create subscription";

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

async function asaasFetch(operation: AsaasOperation, path: string, timeoutMs: number, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(getBaseUrl() + path, { ...init, headers: getHeaders(), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    console.error("Asaas " + operation + " " + (isTimeoutError(error) ? "timeout" : "network error"));
    throw error;
  }
  if (!response.ok) console.error("Asaas " + operation + " HTTP error (" + response.status + ")");
  return response;
}

export async function createAsaasCustomer(data: {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}): Promise<{ id: string } | { error: string } | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await asaasFetch("create customer", "/customers", 12_000, {
      method: "POST",
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
      return { error: firstError };
    }
    return (await res.json()) as { id: string };
  } catch {
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
    const res = await asaasFetch("create charge", "/payments", 12_000, {
      method: "POST",
      body: JSON.stringify({
        customer: data.customerId,
        billingType: data.billingType,
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
      }),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as { id: string; invoiceUrl?: string; bankSlipUrl?: string; status: string };
  } catch {
    return null;
  }
}

export async function getAsaasChargeStatus(chargeId: string): Promise<string | null> {
  if (!isAsaasConfigured()) return null;
  try {
    const res = await asaasFetch("get charge", "/payments/" + chargeId, 8_000);
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.status;
  } catch {
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
    const res = await asaasFetch("create subscription", "/subscriptions", 12_000, {
      method: "POST",
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
      return null;
    }
    return (await res.json()) as { id: string; invoiceUrl?: string; status: string };
  } catch {
    return null;
  }
}

export function getDueDateString(daysFromNow: number = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}
