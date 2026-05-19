/**
 * Cost factor for bcrypt password hashing.
 *
 * 10 is the historical default and represents a balance between security and
 * latency on modern hardware. Mocks are not security-critical, so the value
 * mirrors what real applications typically use rather than being maximized.
 *
 * Centralized here so a future security review can change the policy in one
 * place instead of grepping every mock's seed.
 */
export const BCRYPT_SALT_ROUNDS = 10;
