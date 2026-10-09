"use client";

import type { ApprovalHistoryItem } from "@/lib/approvals/founder-history";

interface ApprovalDecisionHistoryProps {
  items: ApprovalHistoryItem[];
  loading?: boolean;
}

function decisionClass(decision: ApprovalHistoryItem["decision"]): string {
  switch (decision) {
    case "Approved":
      return "ap-history-approved";
    case "Rejected":
      return "ap-history-rejected";
    case "Expired":
      return "ap-history-expired";
  }
}

export default function ApprovalDecisionHistory({
  items,
  loading = false,
}: ApprovalDecisionHistoryProps) {
  if (loading) {
    return <p className="ap-history-empty">Loading previous decisions…</p>;
  }

  if (items.length === 0) {
    return <p className="ap-history-empty">No approval history yet.</p>;
  }

  return (
    <div className="ap-history-table-wrap">
      <table className="ap-history-table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Agent</th>
            <th scope="col">Decision</th>
            <th scope="col">Reviewer</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.action}</td>
              <td>{item.agent}</td>
              <td>
                <span className={`ap-history-decision ${decisionClass(item.decision)}`}>
                  {item.decision}
                </span>
              </td>
              <td>{item.reviewer}</td>
              <td title={new Date(item.date).toLocaleString()}>{item.dateLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
