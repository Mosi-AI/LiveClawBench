import { z } from "zod";

export const AssetEditSchema = z.object({
  cost_basis: z.number(),
  residual_value: z.number(),
  useful_life_years: z.number(),
  depreciation_method: z.enum(["straight_line", "declining_balance"]),
  annual_depreciation: z.number(),
  correction_reason: z.string(),
});

export const AssetResponseSchema = z.object({
  id: z.number(),
  asset_name: z.string(),
  cost_basis: z.number(),
  residual_value: z.number(),
  useful_life_years: z.number(),
  depreciation_method: z.string(),
  annual_depreciation: z.number(),
  correction_reason: z.string(),
});
