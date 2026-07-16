import { tytFetch } from "./client";
import { tytEndpoints } from "./endpoints";

export interface AsaasPaymentDetails {
    id: string;
    status: string;
    value: number;
    billingType: string;
    invoiceUrl?: string;
    transactionReceiptUrl?: string;
    bankSlipUrl?: string;
}

export async function getAsaasPayment(paymentId: string, token: string) {
    const res = await tytFetch(tytEndpoints.asaas.paymentById(paymentId), { method: "GET", token });
    return res;
}
