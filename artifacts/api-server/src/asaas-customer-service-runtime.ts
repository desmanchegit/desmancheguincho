import * as asaas from "./asaas";
import * as storage from "./storage";
import {
  ensureAsaasCustomerForDesmanche as ensureDesmanche,
  ensureAsaasCustomerForGuincho as ensureGuincho,
  type AsaasCustomerServiceDependencies,
  type EnsureAsaasCustomerResult,
} from "./asaas-customer-service";

const dependencies: AsaasCustomerServiceDependencies = {
  async getDesmanche(id) {
    const item: any = await storage.getDesmancheById(id);
    return item ? { id: item.id, name: item.companyName, email: item.email, phone: item.phone, cpfCnpj: item.cnpj } : null;
  },
  async getGuincho(id) {
    const item: any = storage.getGuinchoById(id);
    const cpfCnpj = item?.document_type === "cpf" ? item.cpf : item?.cnpj;
    return item ? { id: item.id, name: item.name, email: item.email, phone: item.phone, cpfCnpj: cpfCnpj ?? "", asaasCustomerId: item.asaas_customer_id } : null;
  },
  async getDesmancheCustomerId(id) {
    const billing: any = await storage.getDesmancheBilling(id);
    return billing?.asaasCustomerId ?? null;
  },
  createOrGetIntent: storage.createOrGetAsaasCreationIntent,
  claimIntent: storage.claimAsaasCreationIntent,
  markAmbiguous: storage.markAsaasCreationIntentAmbiguous,
  markFailed: storage.markAsaasCreationIntentFailed,
  completeDesmanche: storage.completeAsaasCustomerForDesmanche,
  completeGuincho: storage.completeAsaasCustomerForGuincho,
  listByExternalReference: asaas.listAsaasCustomersByExternalReference,
  listByCpfCnpj: asaas.listAsaasCustomersByCpfCnpj,
  createCustomer: asaas.createAsaasCustomerDetailed,
};

export function ensureAsaasCustomerForDesmanche(desmancheId: string): Promise<EnsureAsaasCustomerResult> {
  return ensureDesmanche(desmancheId, dependencies);
}

export function ensureAsaasCustomerForGuincho(guinchoId: string): Promise<EnsureAsaasCustomerResult> {
  return ensureGuincho(guinchoId, dependencies);
}
