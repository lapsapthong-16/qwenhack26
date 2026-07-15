declare module "pg" {
  export class Pool {
    constructor(options?: Record<string, unknown>);
    query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  }
}
