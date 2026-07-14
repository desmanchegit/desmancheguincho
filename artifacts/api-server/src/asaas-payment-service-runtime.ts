import * as asaas from "./asaas";
import * as storage from "./storage";
import { ensureAsaasCustomerForDesmanche } from "./asaas-customer-service-runtime";
import {
  ensureAsaasPaymentForBillingTransaction as ensurePayment,
  type AsaasPaymentServiceDependencies,
  type EnsureAsaasPaymentResult,
} from "./asaas-payment-service";

const dependencies: AsaasPaymentServiceDependencies = {
  getBillingTransaction: storage.getBillingTransactionForAsaasPayment,
  persistOrReuseDueDate: storage.persistOrReuseAsaasDueDate,
  associateIntent: storage.associateAsaasCreationIntentToBillingTransaction,
  completePayment: storage.completeAsaasPaymentForBillingTransaction,
  ensureCustomer: ensureAsaasCustomerForDesmanche,
  createOrGetIntent: storage.createOrGetAsaasCreationIntent,
  claimIntent: storage.claimAsaasCreationIntent,
  markAmbiguous: storage.markAsaasCreationIntentAmbiguous,
  markFailed: storage.markAsaasCreationIntentFailed,
  listPaymentsByExternalReference: asaas.listAsaasPaymentsByExternalReference,
  createCharge: asaas.createAsaasChargeDetailed,
  getDueDateString: asaas.getDueDateString,
};

export function ensureAsaasPaymentForBillingTransaction(
  billingTransactionId: string,
  desmancheId: string,
): Promise<EnsureAsaasPaymentResult> {
  return ensurePayment({ billingTransactionId, desmancheId }, dependencies);
}
