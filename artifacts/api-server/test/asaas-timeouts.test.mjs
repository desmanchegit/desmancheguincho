import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import {
  cancelAsaasOpenCharge, cancelAsaasSubscription, createAsaasCharge, createAsaasCustomer, createAsaasSubscription, getAsaasChargeStatus, getAsaasSubscriptionPaymentLink,
  setAsaasBaseUrlForTests, setAsaasConfig,
} from "../dist/asaas.mjs";

const customer = { name: "Cliente teste", email: "cliente@example.test", phone: "11999999999", cpfCnpj: "123.456.789-00" };
const charge = { customerId: "cus_test", value: 10, dueDate: "2026-07-20", description: "Teste", billingType: "PIX" };
const subscription = { customerId: "cus_test", value: 10, nextDueDate: "2026-07-20", description: "Teste", billingType: "PIX", cycle: "MONTHLY" };

function startServer(t, handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      t.after(() => new Promise((done, fail) => server.close((error) => error ? fail(error) : done())));
      resolve("http://127.0.0.1:" + port);
    });
  });
}

function refusedUrl() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve("http://127.0.0.1:" + port));
    });
  });
}

test("cliente Asaas usa timeouts, preserva contratos e nunca faz retry", async (t) => {
  const calls = [];
  const baseUrl = await startServer(t, (req, res) => {
    calls.push({ path: req.url, method: req.method, headers: req.headers });
    if (req.url.startsWith("/slow")) return setTimeout(() => res.end(JSON.stringify({ id: "late" })), 200);
    if (req.url.startsWith("/error-customer")) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ issues: [{ description: "Erro de validação" }] }));
    }
    if (req.url.startsWith("/error")) {
      res.writeHead(500, { "content-type": "application/json" });
      return res.end(JSON.stringify({ issue: "internal" }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    if (req.url.startsWith("/payments/")) return res.end(JSON.stringify({ id: "pay_test", status: "PENDING", externalReference: null }));
    if (req.url.startsWith("/subscriptions/") && req.url.includes("/payments")) {
      return res.end(JSON.stringify({
        data: [{ id: "pay_subscription", status: "PENDING", invoiceUrl: "http://local/subscription-invoice", externalReference: null }],
        hasMore: false,
      }));
    }
    return res.end(JSON.stringify({ id: "asaas_test", status: "PENDING", paymentLink: "http://local/subscription-checkout", invoiceUrl: "http://local/invoice" }));
  });
  const originalTimeout = AbortSignal.timeout;
  const timeoutValues = [];
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  t.after(() => {
    AbortSignal.timeout = originalTimeout;
    console.error = originalConsoleError;
    setAsaasBaseUrlForTests(undefined);
  });
  setAsaasConfig("fake-asaas-key", "sandbox");
  setAsaasBaseUrlForTests(baseUrl);

  AbortSignal.timeout = (milliseconds) => {
    timeoutValues.push(milliseconds);
    return originalTimeout(milliseconds);
  };
  assert.equal((await createAsaasCustomer(customer)).id, "asaas_test");
  assert.equal((await createAsaasCharge(charge)).id, "asaas_test");
  assert.deepEqual(await createAsaasSubscription(subscription), { id: "asaas_test", status: "PENDING" });
  assert.equal(await getAsaasSubscriptionPaymentLink("sub_test"), "http://local/subscription-invoice");
  assert.equal(await getAsaasChargeStatus("pay_test"), "PENDING");
  assert.equal(await cancelAsaasSubscription("sub_test"), true);
  assert.equal(await cancelAsaasOpenCharge("pay_test"), true);
  assert.ok(calls.some((call) => call.path === "/subscriptions/sub_test" && call.method === "DELETE"));
  assert.ok(calls.some((call) => call.path === "/payments/pay_test" && call.method === "DELETE"));
  assert.deepEqual(timeoutValues, [12000, 12000, 12000, 8000, 8000, 8000, 8000, 8000]);
  assert.ok(calls.every((call) => call.headers.access_token === "fake-asaas-key" && call.headers["content-type"] === "application/json"));

  setAsaasBaseUrlForTests(baseUrl + "/error-customer");
  assert.deepEqual(await createAsaasCustomer(customer), { error: "Erro de validação" });
  setAsaasBaseUrlForTests(baseUrl + "/error");
  assert.equal(await createAsaasCharge(charge), null);
  assert.equal(await createAsaasSubscription(subscription), null);
  assert.equal(await getAsaasChargeStatus("pay_test"), null);

  setAsaasBaseUrlForTests(await refusedUrl());
  assert.equal(await createAsaasCustomer(customer), null);
  assert.equal(await createAsaasCharge(charge), null);
  assert.equal(await createAsaasSubscription(subscription), null);
  assert.equal(await getAsaasChargeStatus("pay_test"), null);

  AbortSignal.timeout = () => originalTimeout(25);
  setAsaasBaseUrlForTests(baseUrl + "/slow");
  assert.equal(await createAsaasCharge(charge), null);
  assert.equal(await getAsaasChargeStatus("pay_test"), null);
  assert.equal(calls.filter((call) => call.path === "/slow/payments").length, 1);
  assert.equal(calls.filter((call) => call.path === "/slow/payments/pay_test").length, 1);
  assert.ok(logs.includes("Asaas create charge timeout"));
  assert.ok(logs.includes("Asaas get charge timeout"));
  assert.ok(logs.includes("Asaas create customer HTTP error (400)"));
  assert.ok(logs.includes("Asaas create charge HTTP error (500)"));
  assert.ok(logs.includes("Asaas create customer network error"));
  assert.equal(logs.some((log) => log.includes("fake-asaas-key") || log.includes("cliente@example.test")), false);
  assert.ok(calls.every((call) => call.headers.host.startsWith("127.0.0.1:")));
});
