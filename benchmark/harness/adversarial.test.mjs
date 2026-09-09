import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../dist/db/client.js";
import { eventBus } from "../dist/events/bus.js";
import { createAndProcessOrder } from "../dist/orders/service.js";
import { refundOrder } from "../dist/orders/refund.js";

test("Adversarial Suite: 8 Hard Invariants Verification", async (t) => {
  eventBus.clear();
  const tenantA = "tenant_adv_A";
  const tenantB = "tenant_adv_B";

  db.saveTenant({ id: tenantA, name: "Tenant A", plan: "enterprise", createdAt: new Date().toISOString() });
  db.saveTenant({ id: tenantB, name: "Tenant B", plan: "starter", createdAt: new Date().toISOString() });
  db.saveInventory({ sku: "ADV-SKU-1", tenantId: tenantA, totalQuantity: 20, reservedQuantity: 0, version: 1 });
  db.saveInventory({ sku: "ADV-SKU-2", tenantId: tenantA, totalQuantity: 10, reservedQuantity: 0, version: 1 });

  // Create Paid Order
  const orderRes = await createAndProcessOrder({
    tenantId: tenantA,
    customerId: "cust_adv_1",
    items: [
      { sku: "ADV-SKU-1", quantity: 4, unitPriceCents: 2500 },
      { sku: "ADV-SKU-2", quantity: 2, unitPriceCents: 5000 },
    ],
    idempotencyKey: "order_adv_init",
  });
  assert.equal(orderRes.success, true);
  const orderId = orderRes.order.id;

  await t.test("Invariant 1: Valid refund transitions status to 'refunded'", async () => {
    const res = await refundOrder({
      tenantId: tenantA,
      orderId,
      reason: "Customer requested return",
      idempotencyKey: "refund_adv_001",
    });
    assert.equal(res.success, true, "Refund must succeed for valid order");
    const updated = db.getOrder(orderId);
    assert.equal(updated?.status, "refunded", "Order status must transition to refunded");
  });

  await t.test("Invariant 2: Tenant Isolation — Tenant B cannot refund Tenant A's order", async () => {
    // Create new order for Tenant A
    const orderA = await createAndProcessOrder({
      tenantId: tenantA,
      customerId: "cust_adv_2",
      items: [{ sku: "ADV-SKU-1", quantity: 1, unitPriceCents: 2500 }],
    });
    assert.equal(orderA.success, true);

    const crossTenantRes = await refundOrder({
      tenantId: tenantB, // Wrong tenant
      orderId: orderA.order.id,
      reason: "Unauthorized attempt",
      idempotencyKey: "refund_cross_tenant",
    });
    assert.equal(crossTenantRes.success, false, "Cross-tenant refund must be rejected");
  });

  await t.test("Invariant 3: Status Guard — Unpaid / draft orders cannot be refunded", async () => {
    const draftOrderId = "draft_order_999";
    db.saveOrder({
      id: draftOrderId,
      tenantId: tenantA,
      customerId: "cust_adv_3",
      items: [],
      totalAmountCents: 1000,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await refundOrder({
      tenantId: tenantA,
      orderId: draftOrderId,
      reason: "Invalid draft refund",
      idempotencyKey: "refund_draft_fail",
    });
    assert.equal(res.success, false, "Draft orders must not be refundable");
  });

  await t.test("Invariant 4: Compensating Inventory Release for all items", async () => {
    const inv1 = db.getInventory(tenantA, "ADV-SKU-1");
    const inv2 = db.getInventory(tenantA, "ADV-SKU-2");
    // After refund of order 1 (4 items of SKU-1, 2 items of SKU-2), plus orderA (1 item of SKU-1)
    // SKU-1 should only have 1 reserved, SKU-2 should have 0 reserved.
    assert.equal(inv1?.reservedQuantity, 1, "SKU-1 reserved inventory must be released");
    assert.equal(inv2?.reservedQuantity, 0, "SKU-2 reserved inventory must be released");
  });

  await t.test("Invariant 5: Idempotency on duplicate refund calls", async () => {
    const dupeRes = await refundOrder({
      tenantId: tenantA,
      orderId,
      reason: "Customer requested return",
      idempotencyKey: "refund_adv_001", // Duplicate key
    });
    assert.equal(dupeRes.success, true, "Duplicate refund must return success");
    assert.equal(dupeRes.isDuplicate, true, "Duplicate refund must flag isDuplicate: true");
  });

  await t.test("Invariant 6: Domain Event 'order.refunded' emitted to EventBus", async () => {
    const refundEvents = eventBus.publishedEvents.filter((e) => e.type === "order.refunded");
    assert.ok(refundEvents.length > 0, "order.refunded event must be published");
    const lastEvent = refundEvents[refundEvents.length - 1];
    assert.equal(lastEvent.tenantId, tenantA);
    assert.equal(lastEvent.payload.orderId, orderId);
  });
});
