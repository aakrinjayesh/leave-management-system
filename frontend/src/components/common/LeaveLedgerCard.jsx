import { useState } from "react";
import { formatLeaveDays } from "../../utils/formatLeaveDays";

// Month-by-month Opening/Accrued/Availed/Adjustment/Closing balance history
// for each accrual leave type (Sick/Casual/Earned Leave), tabbed by leave
// type. Shared across the employee, manager, and admin leave-detail views.
export default function LeaveLedgerCard({ ledgers }) {
  const [activeId, setActiveId] = useState(ledgers?.[0]?.leavePolicyId);

  if (!ledgers || ledgers.length === 0) return null;

  const active = ledgers.find((l) => l.leavePolicyId === activeId) || ledgers[0];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Monthly leave balance history</span>
        <p className="card-section-subtitle">
          How each leave type accrued and was used, month by month, this financial year.
        </p>

        <div className="filter-tabs">
          {ledgers.map((ledger) => (
            <button
              key={ledger.leavePolicyId}
              type="button"
              className={`filter-tab ${active.leavePolicyId === ledger.leavePolicyId ? "active" : ""}`}
              onClick={() => setActiveId(ledger.leavePolicyId)}
            >
              {ledger.leaveName}
            </button>
          ))}
        </div>

        {active.months.length === 0 ? (
          <p className="helper-text">No accrual history yet for this financial year.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Opening balance</th>
                  <th>Accrued</th>
                  <th>Availed</th>
                  <th>Adjustment</th>
                  <th>Closing balance</th>
                </tr>
              </thead>
              <tbody>
                {active.months.map((m) => (
                  <tr key={`${m.year}-${m.month}`}>
                    <td className="table-cell-primary">
                      {m.monthLabel} {m.year}
                    </td>
                    <td>{formatLeaveDays(m.opening)}</td>
                    <td>{formatLeaveDays(m.accrued)}</td>
                    <td>{formatLeaveDays(m.availed)}</td>
                    <td>{formatLeaveDays(m.adjustment)}</td>
                    <td className="table-cell-primary">{formatLeaveDays(m.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
