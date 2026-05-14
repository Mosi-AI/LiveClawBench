/** @jsxImportSource hono/jsx */
import { Layout } from "./layout.js";
import type { FC } from "hono/jsx";
import type { Draft } from "../types.js";

interface DashboardPageProps {
  drafts: Draft[];
  total: number;
  page: number;
  totalPages: number;
  currentStatus?: string;
}

const statusColors: Record<string, string> = {
  draft: "badge-draft", submitted: "badge-submitted", approved: "badge-approved",
  rejected: "badge-rejected", reimbursed: "badge-reimbursed",
};

const FILTER_STATUSES = ["draft", "submitted", "approved", "reimbursed"];

function chipClass(status: string | undefined, current: string | undefined): string {
  const active = !status ? !current : current === status;
  return `chip ${active ? "chip-active" : ""}`;
}

function pageUrl(pageNum: number, status?: string): string {
  const params = new URLSearchParams();
  params.set("page", String(pageNum));
  if (status) params.set("status", status);
  return `/dashboard?${params.toString()}`;
}

export const DashboardPage: FC<DashboardPageProps> = ({ drafts, total, page, totalPages, currentStatus }) => {
  return (
    <Layout title="Dashboard">
      <div class="dashboard-header">
        <div class="filter-chips">
          <a href="/dashboard" class={chipClass(undefined, currentStatus)}>All</a>
          {FILTER_STATUSES.map((s) => (
            <a href={`/dashboard?status=${s}`} class={chipClass(s, currentStatus)}>{s.charAt(0).toUpperCase() + s.slice(1)}</a>
          ))}
        </div>
        <a href="/drafts/new" class="btn btn-primary">+ New expense</a>
      </div>
      {drafts.length === 0 ? (
        <div class="empty-state">
          <div class="empty-icon">&#128203;</div>
          <h3>No expense drafts yet</h3>
          <p>Get started by creating your first expense report.</p>
          <a href="/drafts/new" class="btn btn-primary">Create expense</a>
        </div>
      ) : (
        <div class="draft-list">
          {drafts.map((d) => (
            <a href={`/drafts/${d.id}`} class="draft-card">
              <div class="draft-card-main">
                <span class="draft-code">{d.draft_code}</span>
                <span class="draft-vendor">{d.vendor_name}</span>
                <span class="draft-date">{d.invoice_date}</span>
              </div>
              <div class="draft-card-meta">
                <span class="draft-amount">{d.currency} {d.amount.toFixed(2)}</span>
                <span class={`badge ${statusColors[d.status] || ""}`}>{d.status}</span>
                {d.attachment_ref && <span class="attachment-badge" title="Has attachment">&#128206;</span>}
              </div>
            </a>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div class="pagination">
          {page > 1 && <a href={pageUrl(page - 1, currentStatus)} class="btn btn-outline">&laquo; Previous</a>}
          <span class="page-info">Page {page} of {totalPages}</span>
          {page < totalPages && <a href={pageUrl(page + 1, currentStatus)} class="btn btn-outline">Next &raquo;</a>}
        </div>
      )}
    </Layout>
  );
};
