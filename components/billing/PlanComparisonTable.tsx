import { getPlanComparisonRows } from "@/lib/billing/founder-billing-copy";
import type { BillingInterval } from "@/lib/billing-types";

interface PlanComparisonTableProps {
  interval: BillingInterval;
}

export default function PlanComparisonTable({ interval }: PlanComparisonTableProps) {
  const rows = getPlanComparisonRows(interval);

  return (
    <div className="bill-comparison-panel ds-panel overflow-hidden">
      <div className="bill-comparison-head">
        <h3 className="bill-section-title">Compare plans</h3>
        <p className="bill-section-desc">
          Side-by-side view of agents, actions, approval channels, and support at each tier.
        </p>
      </div>

      <div className="bill-comparison-wrap overflow-x-auto">
        <table className="bill-comparison-table w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              <th scope="col" className="bill-comparison-feature">
                Feature
              </th>
              <th scope="col">FREE</th>
              <th scope="col">STARTER</th>
              <th scope="col">GROWTH</th>
              <th scope="col">PRO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <th scope="row" className="bill-comparison-feature">
                  {row.feature}
                </th>
                <td>{row.free}</td>
                <td>{row.starter}</td>
                <td>{row.growth}</td>
                <td>{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
