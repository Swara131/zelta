import { Download, FileText } from "lucide-react";
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
    <section className="bill-panel ds-panel overflow-hidden" aria-labelledby="bill-history-heading">
      <div className="bill-history-head">
        <div>
          <h3 id="bill-history-heading" className="bill-section-title">
            Billing history
          </h3>
          <p className="bill-section-desc">
            Download receipts for every charge. Invoices are retained for your records.
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bill-history-empty">
          <FileText className="h-8 w-8 text-[var(--ds-text-tertiary)]" strokeWidth={1.75} />
          <p className="bill-history-empty-title">No invoices yet</p>
          <p className="bill-history-empty-desc">
            Your billing history will appear here after your first paid subscription charge.
            Receipts can be downloaded anytime once available.
          </p>
        </div>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Plan</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Receipt</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = STATUS_STYLES[inv.status];
                return (
                  <tr key={inv.id} className="stripe-invoice-row">
                    <td>
                      {new Date(inv.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{inv.plan}</td>
                    <td className="font-medium text-[var(--ds-text-primary)]">
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
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ds-btn ds-btn-ghost ds-btn-sm"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          Receipt
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--ds-text-tertiary)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
