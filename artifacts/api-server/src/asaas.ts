import { assertAsaasExternalReference } from "./asaas-idempotency";

let _apiKey: string = process.env.ASAAS_API_KEY || "";
let _environment: string = process.env.ASAAS_ENVIRONMENT || "sandbox";
let _baseUrlForTests: string | undefined;

function getBaseUrl() {
  if (_baseUrlForTests) return _baseUrlForTests;
  // Integration tests run the real HTTP client against an ephemeral local
  // server. This override is intentionally unavailable outside NODE_ENV=test.
  if (process.env.NODE_ENV === "test" && process.env.ASAAS_BASE_URL_FOR_TESTS) {
    return process.env.ASAAS_BASE_URL_FOR_TESTS;
  }
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

type AsaasOperation =
  | "create customer"
  | "create charge"
  | "get charge"
  | "create subscription"
  | "list customers"
  | "list payments"
  | "list subscriptions";

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
  externalReference?: string;
}): Promise<{ id: string } | { error: string } | null> {
  if (data.externalReference !== undefined) assertAsaasExternalReference(data.externalReference);
  if (!isAsaasConfigured()) return null;
  try {
    const res = await asaasFetch("create customer", "/customers", 12_000, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
        ...(data.externalReference === undefined ? {} : { externalReference: data.externalReference }),
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

export type CreateAsaasCustomerDetailedResult =
  | { ok: true; customer: { id: string } }
  | {
    ok: false;
    errorType: "timeout" | "network" | "http" | "invalid_response";
    statusCode?: number;
    errorCode?: string;
  };

/**
 * Creates one customer without retrying and keeps transport failures distinct.
 * It deliberately never includes the provider's response body in its result.
 */
export async function createAsaasCustomerDetailed(data: {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  externalReference?: string;
}): Promise<CreateAsaasCustomerDetailedResult> {
  if (data.externalReference !== undefined) assertAsaasExternalReference(data.externalReference);
  if (!isAsaasConfigured()) return { ok: false, errorType: "network", errorCode: "ASAAS_NOT_CONFIGURED" };
  try {
    const res = await asaasFetch("create customer", "/customers", 12_000, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
        ...(data.externalReference === undefined ? {} : { externalReference: data.externalReference }),
      }),
    });
    if (!res.ok) {
      // Consume no provider payload: it can contain data supplied by the customer.
      return {
        ok: false,
        errorType: "http",
        statusCode: res.status,
        ...(res.status >= 400 && res.status < 500 ? { errorCode: "ASAAS_CUSTOMER_VALIDATION" } : {}),
      };
    }
    let raw: unknown;
    try { raw = await res.json(); } catch { return { ok: false, errorType: "invalid_response" }; }
    if (!raw || typeof raw !== "object" || typeof (raw as { id?: unknown }).id !== "string" || !(raw as { id: string }).id) {
      return { ok: false, errorType: "invalid_response" };
    }
    return { ok: true, customer: { id: (raw as { id: string }).id } };
  } catch (error) {
    return { ok: false, errorType: isTimeoutError(error) ? "timeout" : "network" };
  }
}

export async function createAsaasCharge(data: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  externalReference?: string;
}): Promise<{ id: string; invoiceUrl?: string; bankSlipUrl?: string; status: string } | null> {
  if (data.externalReference !== undefined) assertAsaasExternalReference(data.externalReference);
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
        ...(data.externalReference === undefined ? {} : { externalReference: data.externalReference }),
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

export type AsaasListFailure = {
  ok: false;
  errorType: "timeout" | "network" | "http" | "invalid_response";
  statusCode?: number;
};

export type AsaasListSuccess<T> = { ok: true; data: T[] };
export type AsaasListResult<T> = AsaasListSuccess<T> | AsaasListFailure;
export type AsaasCustomerListItem = { id: string; externalReference?: string };
export type AsaasPaymentListItem = {
  id: string; externalReference?: string; customer?: string; value?: number; dueDate?: string; status?: string;
};
export type AsaasSubscriptionListItem = {
  id: string; externalReference?: string; customer?: string; value?: number; nextDueDate?: string; cycle?: string; status?: string;
};

type AsaasListOptions = { limit?: number; offset?: number };
type AsaasListPage<T> = { data: T[]; hasMore: boolean };

function validateListOptions(options: AsaasListOptions): Required<AsaasListOptions> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Asaas list limit must be between 1 and 100");
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Asaas list offset must be a non-negative integer");
  return { limit, offset };
}

function optionalString(value: unknown): string | undefined | null {
  return value === undefined || typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | undefined | null {
  return value === undefined || (typeof value === "number" && Number.isFinite(value)) ? value : null;
}

function parseListPage<T>(raw: unknown, parseItem: (value: unknown) => T | null): AsaasListPage<T> | null {
  if (!raw || typeof raw !== "object") return null;
  const page = raw as { data?: unknown; hasMore?: unknown };
  if (!Array.isArray(page.data) || typeof page.hasMore !== "boolean") return null;
  const data: T[] = [];
  for (const item of page.data) {
    const parsed = parseItem(item);
    if (!parsed) return null;
    data.push(parsed);
  }
  if (page.hasMore && data.length === 0) return null;
  return { data, hasMore: page.hasMore };
}

function parseCustomerListItem(value: unknown): AsaasCustomerListItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const externalReference = optionalString(item.externalReference);
  if (typeof item.id !== "string" || item.id.length === 0 || externalReference === null) return null;
  return externalReference === undefined ? { id: item.id } : { id: item.id, externalReference };
}

function parsePaymentListItem(value: unknown): AsaasPaymentListItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const externalReference = optionalString(item.externalReference);
  const customer = optionalString(item.customer);
  const dueDate = optionalString(item.dueDate);
  const status = optionalString(item.status);
  const amount = optionalNumber(item.value);
  if (typeof item.id !== "string" || item.id.length === 0 || externalReference === null || customer === null || dueDate === null || status === null || amount === null) return null;
  return { id: item.id, ...(externalReference === undefined ? {} : { externalReference }), ...(customer === undefined ? {} : { customer }), ...(amount === undefined ? {} : { value: amount }), ...(dueDate === undefined ? {} : { dueDate }), ...(status === undefined ? {} : { status }) };
}

function parseSubscriptionListItem(value: unknown): AsaasSubscriptionListItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const externalReference = optionalString(item.externalReference);
  const customer = optionalString(item.customer);
  const nextDueDate = optionalString(item.nextDueDate);
  const cycle = optionalString(item.cycle);
  const status = optionalString(item.status);
  const amount = optionalNumber(item.value);
  if (typeof item.id !== "string" || item.id.length === 0 || externalReference === null || customer === null || nextDueDate === null || cycle === null || status === null || amount === null) return null;
  return { id: item.id, ...(externalReference === undefined ? {} : { externalReference }), ...(customer === undefined ? {} : { customer }), ...(amount === undefined ? {} : { value: amount }), ...(nextDueDate === undefined ? {} : { nextDueDate }), ...(cycle === undefined ? {} : { cycle }), ...(status === undefined ? {} : { status }) };
}

async function listAsaasByExternalReference<T>(
  operation: AsaasOperation,
  path: string,
  externalReference: string,
  options: AsaasListOptions,
  extraQuery: Record<string, string | undefined>,
  parseItem: (value: unknown) => T | null,
): Promise<AsaasListResult<T>> {
  assertAsaasExternalReference(externalReference);
  const { limit, offset } = validateListOptions(options);
  if (!isAsaasConfigured()) return { ok: false, errorType: "network" };

  const all: T[] = [];
  for (let pageNumber = 0; pageNumber < 50; pageNumber += 1) {
    const query = new URLSearchParams({ externalReference, limit: String(limit), offset: String(offset + pageNumber * limit) });
    for (const [key, value] of Object.entries(extraQuery)) if (value !== undefined) query.set(key, value);
    let response: Response;
    try {
      response = await asaasFetch(operation, path + "?" + query.toString(), 8_000);
    } catch (error) {
      return { ok: false, errorType: isTimeoutError(error) ? "timeout" : "network" };
    }
    if (!response.ok) return { ok: false, errorType: "http", statusCode: response.status };
    let raw: unknown;
    try { raw = await response.json(); } catch { return { ok: false, errorType: "invalid_response" }; }
    const parsed = parseListPage(raw, parseItem);
    if (!parsed) return { ok: false, errorType: "invalid_response" };
    all.push(...parsed.data);
    if (!parsed.hasMore) return { ok: true, data: all };
  }
  return { ok: false, errorType: "invalid_response" };
}

async function listAsaasCustomersByQuery(queryBase: Record<string, string>, options: AsaasListOptions): Promise<AsaasListResult<AsaasCustomerListItem>> {
  const { limit, offset } = validateListOptions(options);
  if (!isAsaasConfigured()) return { ok: false, errorType: "network" };
  const all: AsaasCustomerListItem[] = [];
  for (let pageNumber = 0; pageNumber < 50; pageNumber += 1) {
    const query = new URLSearchParams({ ...queryBase, limit: String(limit), offset: String(offset + pageNumber * limit) });
    let response: Response;
    try { response = await asaasFetch("list customers", "/customers?" + query.toString(), 8_000); }
    catch (error) { return { ok: false, errorType: isTimeoutError(error) ? "timeout" : "network" }; }
    if (!response.ok) return { ok: false, errorType: "http", statusCode: response.status };
    let raw: unknown;
    try { raw = await response.json(); } catch { return { ok: false, errorType: "invalid_response" }; }
    const parsed = parseListPage(raw, parseCustomerListItem);
    if (!parsed) return { ok: false, errorType: "invalid_response" };
    all.push(...parsed.data);
    if (!parsed.hasMore) return { ok: true, data: all };
  }
  return { ok: false, errorType: "invalid_response" };
}

export function listAsaasCustomersByExternalReference(
  externalReference: string,
  options: AsaasListOptions & { cpfCnpj?: string } = {},
): Promise<AsaasListResult<AsaasCustomerListItem>> {
  return listAsaasByExternalReference("list customers", "/customers", externalReference, options, { cpfCnpj: options.cpfCnpj }, parseCustomerListItem);
}

/** Lists all customer pages by document. The document is used only in the URL query. */
export function listAsaasCustomersByCpfCnpj(
  cpfCnpj: string, options: AsaasListOptions = {},
): Promise<AsaasListResult<AsaasCustomerListItem>> {
  const normalized = cpfCnpj.replace(/\D/g, "");
  if (!normalized) throw new Error("Asaas customer cpfCnpj must contain digits");
  return listAsaasCustomersByQuery({ cpfCnpj: normalized }, options);
}

export function listAsaasPaymentsByExternalReference(
  externalReference: string, options: AsaasListOptions = {},
): Promise<AsaasListResult<AsaasPaymentListItem>> {
  return listAsaasByExternalReference("list payments", "/payments", externalReference, options, {}, parsePaymentListItem);
}

export function listAsaasSubscriptionsByExternalReference(
  externalReference: string, options: AsaasListOptions = {},
): Promise<AsaasListResult<AsaasSubscriptionListItem>> {
  return listAsaasByExternalReference("list subscriptions", "/subscriptions", externalReference, options, {}, parseSubscriptionListItem);
}

export async function createAsaasSubscription(data: {
  customerId: string;
  value: number;
  nextDueDate: string;
  description: string;
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  cycle: "MONTHLY" | "YEARLY";
  externalReference?: string;
}): Promise<{ id: string; invoiceUrl?: string; status: string } | null> {
  if (data.externalReference !== undefined) assertAsaasExternalReference(data.externalReference);
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
        ...(data.externalReference === undefined ? {} : { externalReference: data.externalReference }),
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
