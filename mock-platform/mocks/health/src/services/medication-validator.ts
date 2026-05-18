import { ValidationError } from "../utils/errors";
import type { z } from "zod";
import type { CreateMedicationBodySchema } from "../schemas";

type CreateMedicationInput = z.infer<typeof CreateMedicationBodySchema>;

export function validateMedicationInput(input: CreateMedicationInput): void {
  // All frequencies are now supported - no restrictions

  // Slots are optional for all frequencies
  // No validation needed - empty slots array is allowed
}
