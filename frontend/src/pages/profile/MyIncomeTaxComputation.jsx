import { useEffect, useState } from "react";
import FormSelect from "../../components/common/FormSelect";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useAuth } from "../../context/AuthContext";

const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same fixed April-March financial year as the backend uses for this
// computation - independent of the company's own configurable fiscal year.
const getCurrentFinancialYear = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const fyLabel = (year) => `FY ${year}-${String(year + 1).slice(-2)}`;

const getFinancialYear = (date) => {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  return month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
};

// Every financial year from when this employee joined through the current
// one, newest first - so they can go back to their very first year on file.
const getFinancialYearOptions = (joiningDate) => {
  const current = getCurrentFinancialYear();
  const earliest = joiningDate ? Math.min(getFinancialYear(joiningDate), current) : current - 2;
  const options = [];
  for (let year = current; year >= earliest; year--) options.push(year);
  return options;
};

// Read-only version of the admin's Income Tax Computation view, scoped to
// the logged-in employee's own numbers only.
export default function MyIncomeTaxComputation() {
  const { user } = useAuth();
  const financialYearOptions = getFinancialYearOptions(user?.joiningDate);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState("");
  const isLoading = statement === null;

  useEffect(() => {
    profileApi
      .getMyIncomeTaxComputation(financialYear)
      .then((data) => {
        setStatement(data.statement);
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your tax computation for this year.")));
  }, [financialYear]);

  const isOldRegime = statement?.regime === "OLD";

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Income Tax Computation</span>
        <p className="card-section-subtitle">Your annual tax computation, based on your generated payslips.</p>

        <FormSelect
          label="Financial year"
          value={financialYear}
          onChange={(e) => setFinancialYear(Number(e.target.value))}
        >
          {financialYearOptions.map((year) => (
            <option key={year} value={year}>
              {fyLabel(year)}
            </option>
          ))}
        </FormSelect>

        <Alert type="error">{error}</Alert>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <Spinner size={24} />
          </div>
        ) : (
          statement && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span
                  className={`status-badge ${statement.mode === "FINAL" ? "status-badge-active" : "status-badge-pending"}`}
                >
                  {statement.mode === "FINAL" ? "Final" : "Projected"}
                </span>
                <span className="card-section-subtitle" style={{ margin: 0 }}>
                  Based on {statement.monthsElapsed} of 12 months' payslips generated this financial year.
                </span>
              </div>

              <div className="profile-detail-grid">
                <div>
                  <div className="profile-detail-label">Gross Salary</div>
                  <div className="profile-detail-value">{money(statement.grossSalary)}</div>
                </div>
                <div>
                  <div className="profile-detail-label">Standard Deduction</div>
                  <div className="profile-detail-value">{money(statement.deductions.standardDeduction)}</div>
                </div>
                {isOldRegime && (
                  <>
                    <div>
                      <div className="profile-detail-label">HRA Exemption</div>
                      <div className="profile-detail-value">{money(statement.deductions.hraExemption)}</div>
                    </div>
                    <div>
                      <div className="profile-detail-label">Section 80C</div>
                      <div className="profile-detail-value">{money(statement.deductions.section80C)}</div>
                    </div>
                    <div>
                      <div className="profile-detail-label">Section 80D</div>
                      <div className="profile-detail-value">{money(statement.deductions.section80D)}</div>
                    </div>
                    <div>
                      <div className="profile-detail-label">Home Loan Interest</div>
                      <div className="profile-detail-value">{money(statement.deductions.homeLoanInterest)}</div>
                    </div>
                  </>
                )}
                <div>
                  <div className="profile-detail-label">Taxable Salary</div>
                  <div className="profile-detail-value">{money(statement.taxableSalary)}</div>
                </div>
                <div>
                  <div className="profile-detail-label">Other Income (interest)</div>
                  <div className="profile-detail-value">
                    {money(statement.otherIncome.savingsInterest + statement.otherIncome.fdInterest)}
                  </div>
                </div>
                <div>
                  <div className="profile-detail-label">Total Income (rounded)</div>
                  <div className="profile-detail-value">{money(statement.totalIncomeRounded)}</div>
                </div>
                <div>
                  <div className="profile-detail-label">Tax on Total Income</div>
                  <div className="profile-detail-value">{money(statement.slabTax)}</div>
                </div>
                {statement.rebate87A > 0 && (
                  <div>
                    <div className="profile-detail-label">Rebate u/s 87A</div>
                    <div className="profile-detail-value">-{money(statement.rebate87A)}</div>
                  </div>
                )}
                <div>
                  <div className="profile-detail-label">Health &amp; Education Cess (4%)</div>
                  <div className="profile-detail-value">{money(statement.cess)}</div>
                </div>
                <div>
                  <div className="profile-detail-label">Total Tax Liability</div>
                  <div className="profile-detail-value">{money(statement.totalTaxLiability)}</div>
                </div>
                <div>
                  <div className="profile-detail-label">TDS Deducted So Far</div>
                  <div className="profile-detail-value">{money(statement.tdsDeductedSoFar)}</div>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color, #e5e7eb)" }}>
                {statement.taxPayable > 0 ? (
                  <p className="card-section-subtitle" style={{ margin: 0 }}>
                    {statement.mode === "FINAL" ? "Tax Payable" : "Projected Tax Payable if no further TDS is deducted"}:{" "}
                    <strong>{money(statement.taxPayable)}</strong>
                  </p>
                ) : statement.taxRefundable > 0 ? (
                  <p className="card-section-subtitle" style={{ margin: 0 }}>
                    {statement.mode === "FINAL" ? "Tax Refundable" : "Projected Tax Refundable so far"}:{" "}
                    <strong>{money(statement.taxRefundable)}</strong>
                  </p>
                ) : (
                  <p className="card-section-subtitle" style={{ margin: 0 }}>
                    No tax payable or refundable.
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
