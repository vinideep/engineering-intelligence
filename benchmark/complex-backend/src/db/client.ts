import type { Order, PaymentTransaction, ProductInventory, Tenant } from "./schema.js";

export class InMemoryTenantDatabase {
  private tenants = new Map<string, Tenant>();
  private inventory = new Map<string, ProductInventory>();
  private orders = new Map<string, Order>();
  private payments = new Map<string, PaymentTransaction>();
  private idempotencyStore = new Map<string, string>();

  public saveTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, { ...tenant });
  }

  public getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  public saveInventory(inv: ProductInventory): void {
    const key = `${inv.tenantId}:${inv.sku}`;
    this.inventory.set(key, { ...inv });
  }

  public getInventory(tenantId: string, sku: string): ProductInventory | undefined {
    return this.inventory.get(`${tenantId}:${sku}`);
  }

  public saveOrder(order: Order): void {
    this.orders.set(order.id, { ...order });
  }

  public getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  public savePayment(payment: PaymentTransaction): void {
    this.payments.set(payment.id, { ...payment });
  }

  public getPaymentByIdempotency(tenantId: string, idempotencyKey: string): PaymentTransaction | undefined {
    const key = `${tenantId}:${idempotencyKey}`;
    const paymentId = this.idempotencyStore.get(key);
    if (!paymentId) return undefined;
    return this.payments.get(paymentId);
  }

  public registerIdempotencyKey(tenantId: string, idempotencyKey: string, resourceId: string): void {
    this.idempotencyStore.set(`${tenantId}:${idempotencyKey}`, resourceId);
  }

  public clear(): void {
    this.tenants.clear();
    this.inventory.clear();
    this.orders.clear();
    this.payments.clear();
    this.idempotencyStore.clear();
  }

  public reset(): void {
    this.clear();
  }
}

export const db = new InMemoryTenantDatabase();
export default db;
