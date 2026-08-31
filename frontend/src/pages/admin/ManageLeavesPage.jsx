import { useEffect, useState } from "react";
import { Ban, CalendarPlus, Pencil, Plus, RotateCcw, Settings2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import FormSelect from "../../components/common/FormSelect";
import LeavePolicyModal from "./LeavePolicyModal";
import HolidayModal from "./HolidayModal";
import CompanySettingsModal from "./CompanySettingsModal";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

const TABS = [
  { key: "policies", label: "Leave Types" },
  { key: "holidays", label: "Holidays" },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const isPastDate = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getFiscalYearForDate = (date, startMonth) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= startMonth ? year : year - 1;
};

const formatFiscalYearLabel = (year, startMonth) => {
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? year : year + 1;
  return `FY ${year} (${MONTH_LABELS_SHORT[startMonth - 1]} ${year} – ${MONTH_LABELS_SHORT[endMonth - 1]} ${endYear})`;
};

export default function ManageLeavesPage() {
  const [activeTab, setActiveTab] = useState("policies");
  const [policies, setPolicies] = useState(null);
  const [holidays, setHolidays] = useState(null);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(4);
  const [policyYears, setPolicyYears] = useState([]);
  const [selectedPolicyYear, setSelectedPolicyYear] = useState("current");
  const [policyHistory, setPolicyHistory] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHolidayYear, setSelectedHolidayYear] = useState("all");

  const loadPolicies = () => adminApi.listLeavePolicies().then((data) => setPolicies(data.policies));
  const loadHolidays = () => adminApi.listHolidays().then((data) => setHolidays(data.holidays));

  useEffect(() => {
    loadPolicies();
    loadHolidays();
    adminApi.getCompanySettings().then((data) => setFiscalYearStartMonth(data.settings.fiscalYearStartMonth));
    adminApi.getLeavePolicyHistoryYears().then((data) => setPolicyYears(data.years));
  }, []);

  const currentFiscalYear = getFiscalYearForDate(new Date(), fiscalYearStartMonth);
  const pastPolicyYears = policyYears.filter((year) => year !== currentFiscalYear);

  const holidayYears = holidays
    ? Array.from(new Set(holidays.map((h) => new Date(h.holidayDate).getFullYear()))).sort((a, b) => b - a)
    : [];
  const filteredHolidays = !holidays
    ? null
    : selectedHolidayYear === "all"
      ? holidays
      : holidays.filter((h) => new Date(h.holidayDate).getFullYear() === Number(selectedHolidayYear));

  const handlePolicyYearChange = async (e) => {
    const value = e.target.value;
    setSelectedPolicyYear(value);
    setError("");

    if (value === "current") {
      setPolicyHistory(null);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const data = await adminApi.getLeavePolicyHistory(Number(value));
      setPolicyHistory(data.policies);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load leave history for this year."));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePolicySuccess = () => {
    setIsAddingPolicy(false);
    setEditingPolicy(null);
    loadPolicies();
  };

  const handleHolidaySuccess = () => {
    setIsAddingHoliday(false);
    setEditingHoliday(null);
    loadHolidays();
  };

  const handleTogglePolicy = async (policy) => {
    setError("");
    setActioningId(policy.id);
    try {
      if (policy.isActive) {
        await adminApi.deactivateLeavePolicy(policy.id);
      } else {
        await adminApi.reactivateLeavePolicy(policy.id);
      }
      loadPolicies();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this leave type."));
    } finally {
      setActioningId(null);
    }
  };

  const handleToggleHoliday = async (holiday) => {
    setError("");
    setActioningId(holiday.id);
    try {
      if (holiday.isActive) {
        await adminApi.deactivateHoliday(holiday.id);
      } else {
        await adminApi.reactivateHoliday(holiday.id);
      }
      loadHolidays();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this holiday."));
    } finally {
      setActioningId(null);
    }
  };

  return (
    <DashboardLayout title="Manage Leave Policy">
      <div className="page-header">
        <div>
          <h1>Manage Leaves</h1>
          <p>Set how many Casual, Sick, and Earned leave days employees get, and which dates are holidays.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={() => setIsSettingsOpen(true)} className="page-header-btn">
            <Settings2 size={16} />
            Company settings
          </Button>
          <Button
            onClick={() => (activeTab === "policies" ? setIsAddingPolicy(true) : setIsAddingHoliday(true))}
            className="page-header-btn"
          >
            {activeTab === "policies" ? <Plus size={16} /> : <CalendarPlus size={16} />}
            {activeTab === "policies" ? "Add leave type" : "Add holiday"}
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn ${activeTab === tab.key ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Alert type="error">{error}</Alert>

      {activeTab === "policies" && (
        <div className="card">
          <div className="card-section">
            <div style={{ maxWidth: 320, marginBottom: 16 }}>
              <FormSelect label="Viewing" value={selectedPolicyYear} onChange={handlePolicyYearChange}>
                <option value="current">Current (editable)</option>
                {pastPolicyYears.map((year) => (
                  <option key={year} value={year}>
                    {formatFiscalYearLabel(year, fiscalYearStartMonth)}
                  </option>
                ))}
              </FormSelect>
            </div>

            {selectedPolicyYear !== "current" ? (
              isLoadingHistory || !policyHistory ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <Spinner size={26} />
                </div>
              ) : (
                <>
                  <p className="card-section-subtitle" style={{ marginBottom: 12 }}>
                    Read-only - shows what each leave type's allocation actually was during{" "}
                    {formatFiscalYearLabel(Number(selectedPolicyYear), fiscalYearStartMonth)}.
                  </p>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Days/year</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policyHistory.map((policy) => (
                          <tr key={policy.id}>
                            <td className="table-cell-primary">{policy.leaveName}</td>
                            <td className="table-cell-secondary">
                              {policy.isUnlimited
                                ? "Unlimited"
                                : policy.hasData
                                  ? policy.allocatedLeaves
                                  : "No data for this year"}
                            </td>
                            <td className="table-cell-secondary">{policy.isUnpaid ? "Unpaid (LOP)" : "Paid"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : !policies ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <Spinner size={26} />
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Days/year</th>
                      <th>Accrual</th>
                      <th>Max/request</th>
                      <th>Half-day</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id}>
                        <td className="table-cell-primary">{policy.leaveName}</td>
                        <td className="table-cell-secondary">
                          {policy.isUnlimited ? "Unlimited" : policy.allocatedLeaves}
                        </td>
                        <td className="table-cell-secondary">
                          {policy.monthlyAccrualDays
                            ? `${policy.monthlyAccrualDays}/month`
                            : "Up front"}
                        </td>
                        <td className="table-cell-secondary">{policy.maxLeavesPerRequest}</td>
                        <td className="table-cell-secondary">{policy.allowHalfDay ? "Yes" : "No"}</td>
                        <td className="table-cell-secondary">{policy.isUnpaid ? "Unpaid (LOP)" : "Paid"}</td>
                        <td>
                          <StatusBadge status={policy.isActive ? "ACTIVE" : "INACTIVE"} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="row-action-btn" onClick={() => setEditingPolicy(policy)}>
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`row-action-btn ${policy.isActive ? "reject" : "approve"}`}
                              disabled={actioningId === policy.id}
                              onClick={() => handleTogglePolicy(policy)}
                            >
                              {policy.isActive ? <Ban size={14} /> : <RotateCcw size={14} />}
                              {policy.isActive ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "holidays" && (
        <div className="card">
          <div className="card-section">
            <div style={{ maxWidth: 320, marginBottom: 16 }}>
              <FormSelect label="Year" value={selectedHolidayYear} onChange={(e) => setSelectedHolidayYear(e.target.value)}>
                <option value="all">All years</option>
                {holidayYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </FormSelect>
            </div>

            {!filteredHolidays ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <Spinner size={26} />
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHolidays.map((holiday) => {
                      const isPast = isPastDate(holiday.holidayDate);
                      return (
                        <tr key={holiday.id}>
                          <td className="table-cell-primary">{holiday.holidayName}</td>
                          <td className="table-cell-secondary">{formatDate(holiday.holidayDate)}</td>
                          <td className="table-cell-secondary">{holiday.isOptional ? "Optional" : "Mandatory"}</td>
                          <td>
                            <StatusBadge status={holiday.isActive ? "ACTIVE" : "INACTIVE"} />
                          </td>
                          <td>
                            {isPast ? (
                              <span className="table-cell-secondary">Past</span>
                            ) : (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="row-action-btn"
                                  onClick={() => setEditingHoliday(holiday)}
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={`row-action-btn ${holiday.isActive ? "reject" : "approve"}`}
                                  disabled={actioningId === holiday.id}
                                  onClick={() => handleToggleHoliday(holiday)}
                                >
                                  {holiday.isActive ? <Ban size={14} /> : <RotateCcw size={14} />}
                                  {holiday.isActive ? "Remove" : "Restore"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddingPolicy && <LeavePolicyModal onClose={() => setIsAddingPolicy(false)} onSuccess={handlePolicySuccess} />}
      {editingPolicy && (
        <LeavePolicyModal policy={editingPolicy} onClose={() => setEditingPolicy(null)} onSuccess={handlePolicySuccess} />
      )}

      {isAddingHoliday && <HolidayModal onClose={() => setIsAddingHoliday(false)} onSuccess={handleHolidaySuccess} />}
      {editingHoliday && (
        <HolidayModal holiday={editingHoliday} onClose={() => setEditingHoliday(null)} onSuccess={handleHolidaySuccess} />
      )}

      {isSettingsOpen && (
        <CompanySettingsModal onClose={() => setIsSettingsOpen(false)} onSuccess={() => setIsSettingsOpen(false)} />
      )}
    </DashboardLayout>
  );
}
