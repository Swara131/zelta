import { Download } from "lucide-react";
import type { Invoice } from "@/lib/billing-types";

interface InvoiceTableProps {
  invoices: Invoice[];
}

const STATUS_STYLES = {
  paid: { label: "Paid", bg: "rgba(52, 211, 153, 0.12)", color: "#34d399" },
  pending: { label: "Pending", bg: "rgba(251, 191, 36, 0.12)", color: "#fbbf24" },
  failed: { label: "Failed", bg: "rgba(248, 113, 113, 0.12)", color: "#f87171" },
};

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  return (
    <div className="ds-panel">
      <div className="ds-card-header">
        <p className="ds-section-title">Billing history</p>
        <p className="ds-section-description">Invoices and payment receipts</p>
      </div>

      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Date</th>
              <th scope="col">Plan</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const status = STATUS_STYLES[inv.status];
              return (
                <tr key={inv.id} className="stripe-invoice-row">
                  <td className="font-mono text-[var(--ds-text-primary)]">{inv.id}</td>
                  <td>
                    {new Date(inv.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>{inv.plan}</td>
                  <td className="font-mono font-medium text-[var(--ds-text-primary)]">
                    {inv.amount === 0 ? "$0.00" : `$${inv.amount.toFixed(2)}`}
                  </td>
                  <td>
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ds-btn ds-btn-ghost ds-btn-sm"
                      aria-label={`Download ${inv.id}`}
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
