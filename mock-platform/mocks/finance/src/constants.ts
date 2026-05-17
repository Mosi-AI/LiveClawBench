export const INVOICE_CATEGORY_CODES = [
  { code: "5000", name: "Office Supplies" },
  { code: "5100", name: "Travel" },
  { code: "5200", name: "Meals & Entertainment" },
  { code: "5300", name: "Software & Subscriptions" },
  { code: "5400", name: "Professional Services" },
  { code: "5500", name: "Utilities" },
  { code: "5600", name: "Marketing" },
  { code: "5700", name: "Equipment" },
  { code: "5800", name: "Maintenance" },
  { code: "5900", name: "Other" },
] as const;

export type InvoiceCategoryCode = (typeof INVOICE_CATEGORY_CODES)[number]["code"];
