import type { DepartmentStat } from "@/lib/analytics-types";

interface DepartmentTableProps {
  departments: DepartmentStat[];
}

export default function DepartmentTable({ departments }: DepartmentTableProps) {
  return (
    <div className="ds-panel p-5">
      <p className="ds-section-title mb-4">Departments</p>

      <div className="ds-table-wrap">
        <table className="ds-table min-w-[400px]">
          <thead>
            <tr>
              <th scope="col">Department</th>
              <th scope="col" className="text-right">Actions</th>
              <th scope="col" className="text-right">Blocked</th>
              <th scope="col" className="text-right">Approval Rate</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.name} className="analytics-table-row">
                <td>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: dept.color }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-[var(--ds-text-primary)]">{dept.name}</span>
                  </div>
                </td>
                <td className="text-right font-mono">{dept.actions.toLocaleString()}</td>
                <td className="text-right font-mono text-red-400/80">{dept.blocked}</td>
                <td className="text-right">
                  <span
                    className={`font-mono font-semibold ${
                      dept.approvalRate >= 96 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {dept.approvalRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
