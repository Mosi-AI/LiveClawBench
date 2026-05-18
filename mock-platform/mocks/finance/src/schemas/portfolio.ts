import { z } from "zod";

export const AssetClassCodeSchema = z.enum(["eq", "fi", "ca", "al"]);

export const OrderDirectionSchema = z.enum(["buy", "sell"]);

export const CreateOrderSchema = z.object({
  asset_class_code: AssetClassCodeSchema,
  direction: OrderDirectionSchema,
  amount: z.number().positive(),
});
