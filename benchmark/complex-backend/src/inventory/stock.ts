import { db } from "../db/client.js";
import { eventBus } from "../events/bus.js";
import { randomUUID } from "node:crypto";

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  error?: string;
}

export async function reserveStock(tenantId: string, sku: string, quantity: number): Promise<ReservationResult> {
  const current = db.getInventory(tenantId, sku);
  if (!current) {
    return { success: false, error: `SKU ${sku} not found` };
  }

  const available = current.totalQuantity - current.reservedQuantity;
  if (available < quantity) {
    return { success: false, error: `Insufficient inventory for ${sku}: available ${available}, requested ${quantity}` };
  }

  current.reservedQuantity += quantity;
  current.version += 1;
  db.saveInventory(current);

  const resId = randomUUID();
  await eventBus.publish({
    id: randomUUID(),
    type: "inventory.reserved",
    tenantId,
    payload: { sku, quantity, reservationId: resId },
    timestamp: new Date().toISOString(),
  });

  return { success: true, reservationId: resId };
}

export async function releaseStock(tenantId: string, sku: string, quantity: number): Promise<void> {
  const current = db.getInventory(tenantId, sku);
  if (!current) return;
  current.reservedQuantity = Math.max(0, current.reservedQuantity - quantity);
  current.version += 1;
  db.saveInventory(current);

  await eventBus.publish({
    id: randomUUID(),
    type: "inventory.released",
    tenantId,
    payload: { sku, quantity },
    timestamp: new Date().toISOString(),
  });
}
