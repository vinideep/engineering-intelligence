/**
 * Engineering Intelligence OS — Benchmark Tasks Catalog
 */

export const BENCHMARK_TASKS = [
  {
    id: "task_01_refund_orchestrator",
    name: "Distributed Idempotent Refund Orchestration",
    prompt: `/engineering-intelligence implement idempotent order refund orchestration in src/orders/refund.ts and comprehensive tests in test/refunds.test.mjs.

Repository Signatures:
- db.getOrder(orderId: string): Order | undefined
- db.saveOrder(order: Order): void
- db.getPaymentByIdempotency(tenantId: string, idempotencyKey: string): PaymentTransaction | undefined
- db.savePayment(payment: PaymentTransaction): void  // PaymentTransaction: { id, tenantId, orderId, idempotencyKey, amountCents, status: "refunded", gatewayReference?: string, createdAt }
- db.registerIdempotencyKey(tenantId: string, idempotencyKey: string, paymentId: string): void
- releaseStock(tenantId: string, sku: string, quantity: number): Promise<void>
- eventBus.publish(event: { id: string; type: string; tenantId: string; payload: any; timestamp: string }): Promise<void>

Requirements:
1. In src/orders/refund.ts, export refundOrder(params: { tenantId: string; orderId: string; reason: string; idempotencyKey: string }): Promise<{ success: boolean; isDuplicate?: boolean; error?: string; refundPaymentId?: string }>
   - If db.getPaymentByIdempotency exists, return { success: true, isDuplicate: true, refundPaymentId: existing.id }
   - Validate order exists, matches tenantId, and status is "paid" (return { success: false, error } otherwise)
   - Loop order.items and await releaseStock(tenantId, item.sku, item.quantity)
   - Update order.status = "refunded", order.updatedAt, and save with db.saveOrder(order)
   - Create and save refund PaymentTransaction with amountCents: order.totalAmountCents, and call db.registerIdempotencyKey
   - Publish event with type: "order.refunded" to eventBus via eventBus.publish({ id: randomUUID(), type: "order.refunded", tenantId, payload: { orderId, reason, amountCents: order.totalAmountCents }, timestamp: new Date().toISOString() })
   - Return { success: true, isDuplicate: false, refundPaymentId: payment.id }

2. In test/refunds.test.mjs:
   - Import: import test from "node:test"; import assert from "node:assert/strict"; import { db } from "../dist/db/client.js"; import { eventBus } from "../dist/events/bus.js"; import { createAndProcessOrder } from "../dist/orders/service.js"; import { refundOrder } from "../dist/orders/refund.js";
   - In test: call db.clear(); eventBus.clear(); save tenant and stock via db.saveTenant and db.saveInventory, create paid order via createAndProcessOrder
   - Call refundOrder and assert result.success is true, order status is "refunded", and eventBus.publishedEvents.find(e => e.type === "order.refunded") is truthy
   - Call refundOrder again with same idempotencyKey and assert result.isDuplicate is true

Output complete files in code blocks:
\`\`\`typescript
// src/orders/refund.ts
...code...
\`\`\`

\`\`\`javascript
// test/refunds.test.mjs
...code...
\`\`\`
`,
    targetFile: "src/orders/refund.ts",
    testFile: "test/refunds.test.mjs",
    adversarialSuite: "benchmark/harness/adversarial.test.mjs",
  },
];
