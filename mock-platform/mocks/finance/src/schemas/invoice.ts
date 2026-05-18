import { z } from "zod";

export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  category_code: z.string(),
  amount: z.number(),
});

export const InvoiceCreateSchema = z.object({
  vendor_id: z.number(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  items: z.array(InvoiceLineItemSchema),
});

export const InvoiceResponseSchema = z.object({
  id: z.number(),
  vendor_id: z.number(),
  vendor_name: z.string().nullable(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  status: z.string(),
});
