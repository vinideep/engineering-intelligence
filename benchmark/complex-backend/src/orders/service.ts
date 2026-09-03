import { db } from "../db/client.js";
import { eventBus } from "../events/bus.js";
import { reserveStock, releaseStock } from "../inventory/stock.js";
import { processPayment } from "../payments/gateway.js";
import { randomUUID } from "node:crypto";
import type { Order, OrderItem } from "../db/schema.js";

export interface CreateOrderInput {
  tenantId: string;
  customerId: string;
  items: OrderItem[];
  idempotencyKey?: string;
}

export async function createAndProcessOrder(input: CreateOrderInput): Promise<{ success: boolean; order?: Order; error?: string }> {
  const totalAmountCents = input.items.reduce((acc, item) => acc + item.unitPriceCents * item.quantity, 0);
  const orderId = randomUUID();
  const now = new Date().toISOString();

  const order: Order = {
    id: orderId,
    tenantId: input.tenantId,
    customerId: input.customerId,
    items: input.items,
    totalAmountCents,
    status: "draft",
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  db.saveOrder(order);

  // 1. Reserve Inventory
  const reservedItems: Array<{ sku: string; quantity: number }> = [];
  for (const item of input.items) {
    const res = await reserveStock(input.tenantId, item.sku, item.quantity);
    if (!res.success) {
      // Compensate / Rollback previously reserved stock
      for (const r of reservedItems) {
        await releaseStock(input.tenantId, r.sku, r.quantity);
      }
      order.status = "cancelled";
      order.updatedAt = new Date().toISOString();
      db.saveOrder(order);
      return { success: false, error: res.error };
    }
    reservedItems.push({ sku: item.sku, quantity: item.quantity });
  }

  // 2. Process Payment
  const paymentKey = input.idempotencyKey ? `pay_${input.idempotencyKey}` : randomUUID();
  const payment = await processPayment({
    tenantId: input.tenantId,
    orderId: order.id,
    amountCents: totalAmountCents,
    idempotencyKey: paymentKey,
  });

  if (!payment.success) {
    for (const r of reservedItems) {
      await releaseStock(input.tenantId, r.sku, r.quantity);
    }
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    db.saveOrder(order);
    return { success: false, error: "Payment processing failed" };
  }

  order.status = "paid";
  order.updatedAt = new Date().toISOString();
  db.saveOrder(order);

  await eventBus.publish({
    id: randomUUID(),
    type: "order.completed",
    tenantId: input.tenantId,
    payload: { orderId: order.id, customerId: order.customerId, totalAmountCents },
    timestamp: new Date().toISOString(),
  });

  return { success: true, order };
}
