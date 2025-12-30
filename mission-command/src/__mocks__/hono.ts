/**
 * Mock for Hono framework for testing
 */

export class Hono {
  routes: Map<string, any> = new Map();

  get(path: string, ...handlers: any[]) {
    const handler = handlers[handlers.length - 1];
    const middleware = handlers.slice(0, -1);
    this.routes.set(`GET:${path}`, { middleware, handler });
    // Return a function that can be called with context
    const fn = async (context: any) => {
      // Apply middleware first
      let ctx = context;
      for (const mw of middleware) {
        const result = await mw(ctx, async () => {});
        if (result) return result;
      }
      if (typeof handler === 'function') {
        return await handler(ctx);
      }
      throw new Error(`Handler is not a function for GET ${path}: ${typeof handler}`);
    };
    // Attach the routes to the function so it can be accessed like router.get
    (fn as any).routes = this.routes;
    return fn;
  }

  post(path: string, ...handlers: any[]) {
    const handler = handlers[handlers.length - 1];
    const middleware = handlers.slice(0, -1);
    this.routes.set(`POST:${path}`, { middleware, handler });
    // Return a function that can be called with context
    const fn = async (context: any) => {
      // Apply middleware first
      let ctx = context;
      for (const mw of middleware) {
        const result = await mw(ctx, async () => {});
        if (result) return result;
      }
      if (typeof handler === 'function') {
        return await handler(ctx);
      }
      console.error(`Handler for POST ${path} is not a function:`, typeof handler, handlers);
      throw new Error(`Handler is not a function for POST ${path}: ${typeof handler}`);
    };
    // Attach the routes to the function so it can be accessed like router.post
    (fn as any).routes = this.routes;
    return fn;
  }

  put(path: string, ...handlers: any[]) {
    const handler = handlers[handlers.length - 1];
    const middleware = handlers.slice(0, -1);
    this.routes.set(`PUT:${path}`, { middleware, handler });
    const fn = async (context: any) => {
      let ctx = context;
      for (const mw of middleware) {
        const result = await mw(ctx, async () => {});
        if (result) return result;
      }
      if (typeof handler === 'function') {
        return await handler(ctx);
      }
      throw new Error(`Handler is not a function for PUT ${path}: ${typeof handler}`);
    };
    (fn as any).routes = this.routes;
    return fn;
  }

  delete(path: string, ...handlers: any[]) {
    const handler = handlers[handlers.length - 1];
    const middleware = handlers.slice(0, -1);
    this.routes.set(`DELETE:${path}`, { middleware, handler });
    const fn = async (context: any) => {
      let ctx = context;
      for (const mw of middleware) {
        const result = await mw(ctx, async () => {});
        if (result) return result;
      }
      if (typeof handler === 'function') {
        return await handler(ctx);
      }
      throw new Error(`Handler is not a function for DELETE ${path}: ${typeof handler}`);
    };
    (fn as any).routes = this.routes;
    return fn;
  }
}

export default Hono;
