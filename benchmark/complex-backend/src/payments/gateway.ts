import { db } from "../db/client.js";
import { eventBus } from "../events/bus.js";
import { randomUUID } from "node:crypto";
import type { PaymentTransaction } from "../db/schema.js";

export interface ProcessPaymentInput {
  tenantId: string;
  orderId: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface PaymentResult {
  success: boolean;
  transaction: PaymentTransaction;
  isDuplicate: boolean;
}

export async function processPayment(input: ProcessPaymentInput): Promise<PaymentResult> {
  const existing = db.getPaymentByIdempotency(input.tenantId, input.idempotencyKey);
  if (existing) {
    return {
      success: existing.status === "succeeded",
      transaction: existing,
      isDuplicate: true,
    };
  }

  const tx: PaymentTransaction = {
    id: randomUUID(),
    tenantId: input.tenantId,
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    amountCents: input.amountCents,
    status: "succeeded",
    gatewayReference: `gw_${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };

  db.savePayment(tx);
  db.registerIdempotencyKey(input.tenantId, input.idempotencyKey, tx.id);

  await eventBus.publish({
    id: randomUUID(),
    type: "payment.succeeded",
    tenantId: input.tenantId,
    payload: { paymentId: tx.id, orderId: input.orderId, amountCents: input.amountCents },
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    transaction: tx,
    isDuplicate: false,
  };
}
