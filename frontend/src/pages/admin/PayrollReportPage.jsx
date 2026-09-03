import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import MonthPicker from "../../components/common/MonthPicker";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const money = (value) =>
  (value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FIELD_LABELS = {
  basic: "Basic",
  hra: "HRA",
  lta: "LTA",
  conveyance: "Conveyance",
  specialAllowance: "Special Allowance",
  guaranteedAllowance: "Guaranteed Allowance",
  annualBonusPay: "Annual Bonus",
  pfEmployer: "PF Employer",
  grossPay: "Gross Pay",
  pfEmployee: "PF",
  professionalTax: "Professional Tax",
  tds: "TDS",
  lopAmount: "Loss of Pay",
  grossDeductions: "Gross Deductions",
  netPay: "Net Pay",
  grossPayment: "Gross Payment",
  tdsRatePercent: "TDS Rate",
  tdsAmount: "TDS Amount",
  netPayment: "Net Payment",
};

const TABS = [
  { key: "employees", label: "Employees" },
  { key: "contract", label: "Hire to Contract" },
];

const cell = (field, row) => {
  if (!row.hasData && field !== "name" && field !== "employeeCode") return "—";
  if (field === "tdsRatePercent") return row.tdsRatePercent == null ? "—" : `${row.tdsRatePercent}%`;
  return money(row[field]);
};

const buildCsv = ({ fields, rows, totals }, meta) => {
  const header = ["Employee code", "Name", ...fields.map((f) => FIELD_LABELS[f] || f)];
  const line = (values) => values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  const bodyRow = (r) => [
    r.employeeCode || "",
    r.name,
    ...fields.map((f) => {
      if (!r.hasData) return "";
      if (f === "tdsRatePercent") return r.tdsRatePercent == null ? "" : `${r.tdsRatePercent}%`;
      return (r[f] || 0).toFixed(2);
    }),
  ];
  const totalsRow = ["", "Total", ...fields.map((f) => (f === "tdsRatePercent" ? "" : (totals[f] || 0).toFixed(2)))];
  return [
    `Payroll register - ${meta}`,
    line(header),
    ...rows.map((r) => line(bodyRow(r))),
    line(totalsRow),
  ].join("\r\n");
};

export default function PayrollReportPage() {
  const [tab, setTab] = useState("employees");
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [mode, setMode] = useState("monthly");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [year, month] = monthValue.split("-").map(Number);
  const periodLabel =
    mode === "cumulative"
      ? `Cumulative · financial year to ${MONTH_LABELS[month - 1]} ${year}`
      : `${MONTH_LABELS[month - 1]} ${year}`;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await adminApi.getPayrollReport(tab, monthValue, mode);
        if (active) setData(res);
      } catch (err) {
        if (active) {
          setData(null);
          setError(getErrorMessage(err, "Couldn't load the payroll report."));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [tab, monthValue, mode]);

  const nameQuery = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    if (!data) return [];
    if (!nameQuery) return data.rows;
    return data.rows.filter((r) => r.name.toLowerCase().includes(nameQuery));
  }, [data, nameQuery]);

  const handleExport = () => {
    if (!data) return;
    const csv = buildCsv({ ...data, rows: visibleRows }, `${TABS.find((t) => t.key === tab).label} · ${periodLabel}`);
    const stamp = `${monthValue}${mode === "cumulative" ? "-cumulative" : ""}`;
    downloadBlobAsFile(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `payroll-report-${tab}-${stamp}.csv`);
  };

  const fields = data?.fields || [];

  return (
    <DashboardLayout title="Report">
      <div className="page-header">
        <div>
          <h1>Payroll Report</h1>
          <p>Consolidated salary register from generated payslips, ordered by employee code.</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => {
              setTab(t.key);
              setSearch("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Alert type="error">{error}</Alert>

      <div className="card">
        <div className="card-section">
          <div className="report-toolbar">
            <div className="field report-toolbar-field">
              <label className="field-label" htmlFor="report-month">
                Month
              </label>
              <div className="field-input-wrap">
                <MonthPicker id="report-month" value={monthValue} onChange={setMonthValue} />
              </div>
            </div>

            <div className="field report-toolbar-field">
              <label className="field-label" htmlFor="report-mode">
                View
              </label>
              <div className="field-input-wrap">
                <select
                  id="report-mode"
                  className="field-input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="monthly">This month</option>
                  <option value="cumulative">Cumulative (FY to date)</option>
                </select>
              </div>
            </div>

            <div className="field report-toolbar-search">
              <label className="field-label" htmlFor="report-search">
                Search
              </label>
              <TextInput
                id="report-search"
                icon={<Search size={15} />}
                placeholder="Search by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="secondary"
              className="page-header-btn report-toolbar-export"
              onClick={handleExport}
              disabled={!data || visibleRows.length === 0}
            >
              <Download size={16} />
              Export CSV
            </Button>
          </div>

          <p className="card-section-subtitle" style={{ marginTop: 0 }}>
            {periodLabel}
            {nameQuery && data ? ` · ${visibleRows.length} of ${data.rows.length}` : ""}
          </p>

          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : !data ? null : visibleRows.length === 0 ? (
            <div className="empty-state">
              <p>No accounts to show.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table sticky-first-two">
                <thead>
                  <tr>
                    <th className="acct-code-col">Code</th>
                    <th>Name</th>
                    {fields.map((f) => (
                      <th key={f} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {FIELD_LABELS[f] || f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.userId}>
                      <td className="acct-code-col table-cell-secondary" style={{ whiteSpace: "nowrap" }}>
                        {row.employeeCode || "—"}
                      </td>
                      <td className="table-cell-primary" style={{ whiteSpace: "nowrap" }}>
                        {row.name}
                        {mode === "cumulative" && row.hasData ? (
                          <span className="table-cell-secondary"> · {row.monthsCounted} mo</span>
                        ) : null}
                      </td>
                      {fields.map((f) => (
                        <td key={f} className="table-cell-secondary" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {cell(f, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="acct-code-col table-cell-primary" />
                    <td className="table-cell-primary">Total</td>
                    {fields.map((f) => (
                      <td
                        key={f}
                        className="table-cell-primary"
                        style={{ textAlign: "right", whiteSpace: "nowrap" }}
                      >
                        {f === "tdsRatePercent" ? "" : money(data.totals[f])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
