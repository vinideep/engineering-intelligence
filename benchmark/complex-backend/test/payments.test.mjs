import test from "node:test";
import assert from "node:assert/strict";
import { processPayment } from "../dist/payments/gateway.js";
import { eventBus } from "../dist/events/bus.js";

test("Payment Gateway: idempotent payment handling prevents duplicate charge", async () => {
  eventBus.clear();
  const tenantId = "tenant_123";
  const idempotencyKey = "tx_idempotency_abc";

  const first = await processPayment({
    tenantId,
    orderId: "order_1",
    amountCents: 5000,
    idempotencyKey,
  });

  assert.equal(first.success, true);
  assert.equal(first.isDuplicate, false);

  const second = await processPayment({
    tenantId,
    orderId: "order_1",
    amountCents: 5000,
    idempotencyKey,
  });

  assert.equal(second.success, true);
  assert.equal(second.isDuplicate, true);
  assert.equal(second.transaction.id, first.transaction.id);
});
