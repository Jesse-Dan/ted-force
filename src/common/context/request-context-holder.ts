import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestContextState } from "./request-context";

export class RequestContextHolder {
  private static readonly storage = new AsyncLocalStorage<RequestContextState>();

  static run<T>(state: RequestContextState, callback: () => T): T {
    return this.storage.run(state, callback);
  }

  static get(): RequestContextState | undefined {
    return this.storage.getStore();
  }

  static require(): RequestContextState {
    const state = this.get();

    if (!state) {
      throw new Error("Request context is unavailable outside the HTTP pipeline.");
    }

    return state;
  }

  static patch(patch: Partial<RequestContextState>): RequestContextState | undefined {
    const current = this.get();

    if (!current) {
      return undefined;
    }

    Object.assign(current, patch);
    return current;
  }
}
