import { describe, expect, test } from "bun:test";
import { validateMedicationInput } from "../src/services/medication-validator";

describe("validateMedicationInput", () => {
  test("passes for daily with slots", () => {
    expect(() =>
      validateMedicationInput({
        name: "Aspirin",
        frequency: "daily",
        start_date: "2025-01-01",
        slots: [{ time_hhmm: "08:00", dose_amount: 100, dose_unit: "mg" }],
      })
    ).not.toThrow();
  });

  test("passes for daily without slots", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "daily",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for daily with empty slots", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "daily",
        start_date: "2025-01-01",
        slots: [],
      })
    ).not.toThrow();
  });

  test("passes for weekly frequency", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "weekly",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for every_two_days frequency", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "every_two_days",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for monthly frequency", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "monthly",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for other frequency", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "other",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for as_needed without slots", () => {
    expect(() =>
      validateMedicationInput({
        name: "Ibuprofen",
        frequency: "as_needed",
        start_date: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("passes for as_needed with slots", () => {
    expect(() =>
      validateMedicationInput({
        name: "Test",
        frequency: "as_needed",
        start_date: "2025-01-01",
        slots: [{ time_hhmm: "08:00", dose_amount: 100, dose_unit: "mg" }],
      })
    ).not.toThrow();
  });
});
