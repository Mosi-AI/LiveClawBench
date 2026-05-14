import type { Draft, Activity, Attachment, User } from "../types.js";

export function rowToDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as number,
    draft_code: row.draft_code as string,
    user_id: row.user_id as number,
    vendor_name: row.vendor_name as string,
    category: row.category as string | null,
    amount: row.amount as number,
    currency: row.currency as string,
    invoice_date: row.invoice_date as string,
    expense_date: row.expense_date as string | null,
    notes: row.notes as string | null,
    source_type: row.source_type as string,
    status: row.status as string,
    attachment_ref: row.attachment_ref as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submitted_at: row.submitted_at as string | null,
  };
}

export function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as number,
    draft_id: row.draft_id as number,
    actor_user_id: row.actor_user_id as number | null,
    actor_name: row.actor_name as string | null,
    action_type: row.action_type as string,
    field_name: row.field_name as string | null,
    old_value: row.old_value as string | null,
    new_value: row.new_value as string | null,
    created_at: row.created_at as string,
  };
}

export function rowToAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as number,
    draft_id: row.draft_id as number,
    attachment_ref: row.attachment_ref as string,
    original_filename: row.original_filename as string,
    mime_type: row.mime_type as string,
    file_size_bytes: row.file_size_bytes as number,
    page_count: row.page_count as number | null,
    preview_text: row.preview_text as string | null,
    extracted_vendor_name: row.extracted_vendor_name as string | null,
    extracted_amount: row.extracted_amount as number | null,
    extracted_currency: row.extracted_currency as string | null,
    extracted_invoice_date: row.extracted_invoice_date as string | null,
    created_at: row.created_at as string,
  };
}

export function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    full_name: row.full_name as string,
    email: row.email as string,
    department: row.department as string,
    role: row.role as string,
    preferred_currency: row.preferred_currency as string,
    avatar_url: row.avatar_url as string | null,
    is_active: row.is_active as number,
    created_at: row.created_at as string,
    last_login_at: row.last_login_at as string | null,
  };
}
