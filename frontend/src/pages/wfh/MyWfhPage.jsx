import { useEffect, useState } from "react";
import { Home, ListChecks, Send } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import StatusBadge from "../../components/common/StatusBadge";
import * as wfhApi from "../../api/employeeWfh.api";
import * as timesheetApi from "../../api/employeeTimesheet.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import "../../styles/dashboardShared.css";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);
const todayValue = () => toDateInputValue(new Date());

const DEFAULT_FORM = { startDate: "", endDate: "", reason: "" };

export default function MyWfhPage() {
  const [projects, setProjects] = useState(null);
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    timesheetApi.listMyProjects().then((res) => setProjects(res.projects));
  }, []);

  const loadRequests = () =>
    wfhApi
      .getMyWfhRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadRequests();
  }, []);

  const hasPending = requests?.some((r) => r.status === "PENDING");

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.startDate || !form.endDate) {
      setError("Please choose both a start and end date.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("End date can't be before the start date.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Please provide a short reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      await wfhApi.submitWfhRequest({
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      });
      setSuccessMessage("WFH request submitted for approval.");
      setForm(DEFAULT_FORM);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit this WFH request."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (request) => {
    setError("");
    setActioningId(request.id);
    try {
      await wfhApi.withdrawWfhRequest(request.id);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't withdraw this WFH request."));
    } finally {
      setActioningId(null);
    }
  };

  return (
    <DashboardLayout title="WFH">
      <div className="page-header">
        <div>
          <h1>Work From Home</h1>
          <p>Request to work from home for a date range - sent to admin for approval.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{successMessage}</Alert>

      {!projects || !requests ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="card-section empty-state">
            <span className="empty-state-icon">
              <Home size={22} />
            </span>
            <p>You haven't been assigned a project yet - contact your admin.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-section">
              <span className="card-section-title">
                <Home size={15} className="profile-title-icon" />
                New WFH request
              </span>

              {/* Read-only, automatic - already set by admin, employee doesn't
                  pick anything here. */}
              <div className="info-panel" style={{ marginBottom: 20 }}>
                <p className="info-panel-title">Currently working on</p>
                <p className="info-panel-subtext">{projects.map((p) => p.name).join(", ")}</p>
              </div>

              {hasPending ? (
                <p className="card-section-subtitle">
                  You already have a pending WFH request - withdraw it below before submitting a new one.
                </p>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-two-col">
                    <TextInput
                      label="Start date"
                      type="date"
                      min={todayValue()}
                      value={form.startDate}
                      onChange={handleChange("startDate")}
                    />
                    <TextInput
                      label="End date"
                      type="date"
                      min={form.startDate || todayValue()}
                      value={form.endDate}
                      onChange={handleChange("endDate")}
                    />
                  </div>

                  <TextArea
                    label="Reason"
                    placeholder="Let admin know why you need to work from home"
                    rows={3}
                    value={form.reason}
                    onChange={handleChange("reason")}
                  />

                  <div style={{ marginTop: 8 }}>
                    <Button type="submit" isLoading={isSubmitting}>
                      <Send size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                      Submit request
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-section">
              <span className="card-section-title">My WFH requests</span>

              {requests.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <ListChecks size={22} />
                  </span>
                  <p>No WFH requests submitted yet.</p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dates</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Remarks</th>
                        <th>Submitted on</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => (
                        <tr key={request.id}>
                          <td className="table-cell-primary">{formatDateRange(request.startDate, request.endDate)}</td>
                          <td className="table-cell-secondary">{request.reason}</td>
                          <td>
                            <StatusBadge status={request.status} />
                          </td>
                          <td className="table-cell-secondary">{request.adminRemarks || "—"}</td>
                          <td className="table-cell-secondary">{formatDate(request.createdAt)}</td>
                          <td>
                            {request.status === "PENDING" && (
                              <button
                                type="button"
                                className="row-action-btn reject"
                                disabled={actioningId === request.id}
                                onClick={() => handleWithdraw(request)}
                              >
                                Withdraw
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
