export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string;
  payload: T;
  timestamp: string;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  public publishedEvents: DomainEvent[] = [];

  public subscribe(eventType: string, handler: EventHandler): () => void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  public async publish<T>(event: DomainEvent<T>): Promise<void> {
    this.publishedEvents.push(event);
    const list = this.handlers.get(event.type) ?? [];
    for (const handler of list) {
      await handler(event);
    }
  }

  public clear(): void {
    this.publishedEvents = [];
    this.handlers.clear();
  }

  public get events(): DomainEvent[] {
    return this.publishedEvents;
  }

  public get history(): DomainEvent[] {
    return this.publishedEvents;
  }
}

export const eventBus = new EventBus();
export default eventBus;
