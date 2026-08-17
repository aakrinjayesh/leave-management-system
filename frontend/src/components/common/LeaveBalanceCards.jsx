import { formatLeaveDays } from "../../utils/formatLeaveDays";

// Shared by the employee dashboard and "My leave requests" (the latter is
// also where a manager lands for their own leave, since their "Dashboard"
// nav link goes to the team overview instead, which never shows this).
export default function LeaveBalanceCards({ balances }) {
  return (
    <div className="balance-card-grid">
      {balances.map((balance) => {
        const usedPct = balance.isUnlimited
          ? 0
          : Math.min(100, Math.round((balance.usedLeaves / (balance.allocatedLeaves || 1)) * 100));
        return (
          <div className="balance-card" key={balance.leavePolicyId}>
            <div className="balance-card-name">{balance.leaveName}</div>
            <div className="balance-card-numbers">
              <span className="balance-card-remaining">{balance.isUnlimited ? "∞" : balance.remainingLeaves}</span>
              <span className="balance-card-total">
                {balance.isUnlimited ? "unlimited" : `of ${formatLeaveDays(balance.allocatedLeaves)} remaining`}
              </span>
            </div>
            {!balance.isUnlimited && (
              <div className="balance-progress-track">
                <div className="balance-progress-fill" style={{ width: `${usedPct}%` }} />
              </div>
            )}
            <div className="balance-card-used">{formatLeaveDays(balance.usedLeaves)} used this year</div>
            {!balance.isUnlimited && balance.allocatedLeaves !== balance.annualAllocatedLeaves && (
              <div className="balance-card-used">Accrues up to {formatLeaveDays(balance.annualAllocatedLeaves)}/year</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
