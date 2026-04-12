// mock-lib: shared framework for LiveClawBench mock services
// Public API surface — implementation follows in subsequent tasks

export interface MockConfig {
  name: string;
  port?: number;
  dev?: boolean;
}

export interface MockApp {
  config: MockConfig;
  // Hono app instance — typed after task2 implementation
  app: unknown;
}

// Placeholder factory — task2 implements the real version
export function createMockApp(_config: MockConfig): MockApp {
  throw new Error("createMockApp not yet implemented (task2)");
}

// Placeholder server — task3 implements the real version
export function startServer(_app: MockApp): void {
  throw new Error("startServer not yet implemented (task3)");
}
