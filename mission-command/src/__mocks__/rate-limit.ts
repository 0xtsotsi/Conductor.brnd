/**
 * Mock for rate-limit module
 */

export function createGitHubWebhookRateLimit() {
  // Return a middleware function that passes through
  return async (c: any, next: any) => {
    return await next();
  };
}

export function rateLimit(config: any) {
  return async (c: any, next: any) => {
    return await next();
  };
}
