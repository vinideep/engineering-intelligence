export type OrderStatus = "draft" | "pending_payment" | "paid" | "allocated" | "cancelled" | "refunded";

export interface Tenant {
  id: string;
  name: string;
  plan: "starter" | "enterprise";
  createdAt: string;
}

export interface ProductInventory {
  sku: string;
  tenantId: string;
  totalQuantity: number;
  reservedQuantity: number;
  version: number;
}

export interface OrderItem {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  items: OrderItem[];
  totalAmountCents: number;
  status: OrderStatus;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  tenantId: string;
  orderId: string;
  idempotencyKey: string;
  amountCents: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
  gatewayReference?: string;
  createdAt: string;
}
