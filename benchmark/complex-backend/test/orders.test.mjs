import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../dist/db/client.js";
import { createAndProcessOrder } from "../dist/orders/service.js";
import { eventBus } from "../dist/events/bus.js";

test("Order Service: full order creation, inventory reservation, and payment cycle", async () => {
  eventBus.clear();
  const tenantId = "tenant_123";
  db.saveTenant({ id: tenantId, name: "Acme Corp", plan: "enterprise", createdAt: new Date().toISOString() });
  db.saveInventory({ sku: "WIDGET-01", tenantId, totalQuantity: 10, reservedQuantity: 0, version: 1 });

  const result = await createAndProcessOrder({
    tenantId,
    customerId: "cust_999",
    items: [{ sku: "WIDGET-01", quantity: 2, unitPriceCents: 5000 }],
    idempotencyKey: "order_req_001",
  });

  assert.equal(result.success, true);
  assert.ok(result.order);
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.totalAmountCents, 10000);

  const inv = db.getInventory(tenantId, "WIDGET-01");
  assert.equal(inv?.reservedQuantity, 2);

  const orderCompletedEvent = eventBus.publishedEvents.find((e) => e.type === "order.completed");
  assert.ok(orderCompletedEvent);
});

test("Order Service: inventory insufficiency aborts order and triggers rollback", async () => {
  eventBus.clear();
  const tenantId = "tenant_123";
  db.saveInventory({ sku: "WIDGET-02", tenantId, totalQuantity: 1, reservedQuantity: 0, version: 1 });

  const result = await createAndProcessOrder({
    tenantId,
    customerId: "cust_999",
    items: [{ sku: "WIDGET-02", quantity: 5, unitPriceCents: 1000 }],
  });

  assert.equal(result.success, false);
  assert.match(result.error || "", /Insufficient inventory/);

  const inv = db.getInventory(tenantId, "WIDGET-02");
  assert.equal(inv?.reservedQuantity, 0);
});
