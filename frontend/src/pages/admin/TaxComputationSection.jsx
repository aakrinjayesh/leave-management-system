import { useEffect, useState } from "react";
import FormSelect from "../../components/common/FormSelect";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// India's Income Tax financial year is always April-March, fixed by law -
// independent of this company's own configurable fiscal year setting used
// for leave/payroll YTD (see incomeTax.service.js on the backend).
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
// one, newest first - so admin can go back to their very first year on file
// instead of only ever seeing the last 3 years.
const getFinancialYearOptions = (joiningDate) => {
  const current = getCurrentFinancialYear();
  const earliest = joiningDate ? Math.min(getFinancialYear(joiningDate), current) : current - 2;
  const options = [];
  for (let year = current; year >= earliest; year--) options.push(year);
  return options;
};

const BLANK_DECLARATION = {
  rentPaidAnnual: "0",
  isMetroCity: false,
  section80C: "0",
  section80D: "0",
  homeLoanInterest: "0",
  otherIncomeSavingsInterest: "0",
  otherIncomeFDInterest: "0",
};

const toDeclarationForm = (declaration) =>
  declaration
    ? {
        rentPaidAnnual: String(declaration.rentPaidAnnual),
        isMetroCity: declaration.isMetroCity,
        section80C: String(declaration.section80C),
        section80D: String(declaration.section80D),
        homeLoanInterest: String(declaration.homeLoanInterest),
        otherIncomeSavingsInterest: String(declaration.otherIncomeSavingsInterest),
        otherIncomeFDInterest: String(declaration.otherIncomeFDInterest),
      }
    : BLANK_DECLARATION;

// Shows the annual Income Tax Computation Statement for one employee, one
// financial year - Projected (fewer than 12 months of payslips exist yet) or
// Final (all 12 do), matching the layout of the standard document this
// feature was modelled on. Old Regime employees also get a declaration form
// (rent/80C/80D/home loan interest/other income) admin fills in once per year.
export default function TaxComputationSection({ userId, taxRegime, joiningDate }) {
  const financialYearOptions = getFinancialYearOptions(joiningDate);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [statement, setStatement] = useState(null);
  const [declarationForm, setDeclarationForm] = useState(BLANK_DECLARATION);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSavingDeclaration, setIsSavingDeclaration] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveRegime = taxRegime || "NEW";
  const isOldRegime = effectiveRegime === "OLD";
  const isLoading = statement === null;

  useEffect(() => {
    const requests = [adminApi.getIncomeTaxComputation(userId, financialYear)];
    if (isOldRegime) requests.push(adminApi.getTaxDeclaration(userId, financialYear));

    Promise.all(requests)
      .then(([computationData, declarationData]) => {
        setStatement(computationData.statement);
        setError("");
        if (isOldRegime) setDeclarationForm(toDeclarationForm(declarationData.declaration));
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the tax computation for this year.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, financialYear, effectiveRegime, reloadKey]);

  const handleDeclarationChange = (field) => (e) => {
    setSuccess("");
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setDeclarationForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDeclaration = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingDeclaration(true);
    try {
      await adminApi.upsertTaxDeclaration(userId, {
        financialYear,
        rentPaidAnnual: Number(declarationForm.rentPaidAnnual) || 0,
        isMetroCity: declarationForm.isMetroCity,
        section80C: Number(declarationForm.section80C) || 0,
        section80D: Number(declarationForm.section80D) || 0,
        homeLoanInterest: Number(declarationForm.homeLoanInterest) || 0,
        otherIncomeSavingsInterest: Number(declarationForm.otherIncomeSavingsInterest) || 0,
        otherIncomeFDInterest: Number(declarationForm.otherIncomeFDInterest) || 0,
      });
      setSuccess("Tax declaration saved.");
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this tax declaration. Please try again."));
    } finally {
      setIsSavingDeclaration(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Income Tax Computation</span>
        <p className="card-section-subtitle">
          Annual tax computation based on this employee's payslips - {effectiveRegime === "NEW" ? "New" : "Old"} Tax
          Regime.
        </p>

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
        <Alert type="success">{success}</Alert>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <Spinner size={24} />
          </div>
        ) : (
          <>
            {isOldRegime && (
              <form onSubmit={handleSaveDeclaration} style={{ marginBottom: 24 }}>
                <span className="card-section-title" style={{ fontSize: "0.95rem" }}>
                  Tax Declaration - {fyLabel(financialYear)}
                </span>
                <p className="card-section-subtitle">
                  Needed to compute HRA exemption and deductions under the Old Regime.
                </p>

                <div className="form-two-col">
                  <TextInput
                    label="Rent paid (annual)"
                    type="number"
                    min="0"
                    value={declarationForm.rentPaidAnnual}
                    onChange={handleDeclarationChange("rentPaidAnnual")}
                  />
                  <TextInput
                    label="Section 80C investments"
                    type="number"
                    min="0"
                    value={declarationForm.section80C}
                    onChange={handleDeclarationChange("section80C")}
                  />
                </div>

                <div className="form-two-col">
                  <TextInput
                    label="Section 80D (health insurance)"
                    type="number"
                    min="0"
                    value={declarationForm.section80D}
                    onChange={handleDeclarationChange("section80D")}
                  />
                  <TextInput
                    label="Home loan interest"
                    type="number"
                    min="0"
                    value={declarationForm.homeLoanInterest}
                    onChange={handleDeclarationChange("homeLoanInterest")}
                  />
                </div>

                <div className="form-two-col">
                  <TextInput
                    label="Other income - savings bank interest"
                    type="number"
                    min="0"
                    value={declarationForm.otherIncomeSavingsInterest}
                    onChange={handleDeclarationChange("otherIncomeSavingsInterest")}
                  />
                  <TextInput
                    label="Other income - FD interest"
                    type="number"
                    min="0"
                    value={declarationForm.otherIncomeFDInterest}
                    onChange={handleDeclarationChange("otherIncomeFDInterest")}
                  />
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={declarationForm.isMetroCity}
                    onChange={handleDeclarationChange("isMetroCity")}
                  />
                  Lives in a metro city (Delhi, Mumbai, Kolkata, or Chennai)
                </label>

                <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                  <Button type="submit" variant="secondary" isLoading={isSavingDeclaration}>
                    Save declaration
                  </Button>
                </div>
              </form>
            )}

            {statement && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span
                    className={`status-badge ${statement.mode === "FINAL" ? "status-badge-active" : "status-badge-pending"}`}
                  >
                    {statement.mode === "FINAL" ? "Final" : "Projected"}
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

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-color, #e5e7eb)",
                  }}
                >
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
