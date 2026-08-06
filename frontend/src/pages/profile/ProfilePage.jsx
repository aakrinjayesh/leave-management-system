import { useEffect, useState } from "react";
import { UserCog, PartyPopper } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import StatCard from "../../components/common/StatCard";
import AnniversaryCelebration from "../../components/common/AnniversaryCelebration";
// Hidden for employees - admin-only feature for now. Uncomment to re-enable.
// import MyIncomeTaxComputation from "./MyIncomeTaxComputation";
// import MyIncomeTaxComputationHistory from "./MyIncomeTaxComputationHistory";
import { useAuth } from "../../context/AuthContext";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";
import "../../styles/dashboardShared.css";

const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
const MARITAL_STATUS_LABELS = { SINGLE: "Single", MARRIED: "Married", OTHER: "Other" };
const TAX_REGIME_LABELS = { OLD: "Old Tax Regime", NEW: "New Tax Regime" };

const formatCtc = (value) =>
  value == null ? "Not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const formatMonth = (date) => new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

// Calendar-aware years/months/days completed since joining.
const getTenureParts = (joiningDateValue) => {
  const start = new Date(joiningDateValue);
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
};

// e.g. "1 year, 4 months, 20 days" - matches how tenure is normally described.
const formatTenure = (joiningDateValue) => {
  const { years, months, days } = getTenureParts(joiningDateValue);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);

  return parts.join(", ");
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [options, setOptions] = useState(null);
  const [managerId, setManagerId] = useState(user?.managerId ? String(user.managerId) : "");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationYears, setCelebrationYears] = useState(null);

  const isAdmin = user?.userType === "ADMIN";

  useEffect(() => {
    if (isAdmin) return;
    profileApi
      .getManagerOptions()
      .then((data) => setOptions(data.options))
      .catch(() => setError("Couldn't load the list of people to choose from. Please try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plays once per new anniversary - the first profile visit after crossing
  // 1 year, then again after crossing 2 years, and so on. Refreshes the local
  // user data as soon as "seen" is saved (not after the 10s animation ends),
  // so navigating away and back mid-celebration can't retrigger it.
  useEffect(() => {
    if (!user?.joiningDate) return;
    const { years } = getTenureParts(user.joiningDate);
    if (years < 1) return;
    if (user.lastAnniversaryCelebratedYears != null && years <= user.lastAnniversaryCelebratedYears) return;

    setCelebrationYears(years);
    setShowCelebration(true);
    profileApi
      .markAnniversaryCelebrationSeen()
      .then(() => refreshUser())
      .catch(() => {});
  }, [user?.joiningDate, user?.lastAnniversaryCelebratedYears]);

  const handleCelebrationDone = () => {
    setShowCelebration(false);
  };

  // getManagerOptions only lists active users - if the current manager was
  // deactivated since being picked, they won't be in that list. Surface them
  // anyway (clearly marked) so the dropdown doesn't just look unselected.
  const currentManagerIsInactive =
    user?.managerId && user?.manager && options && !options.some((o) => o.id === user.managerId);
  const displayOptions =
    currentManagerIsInactive && options ? [{ ...user.manager, inactive: true }, ...options] : options;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!managerId) {
      setError("Please choose your manager.");
      return;
    }

    setIsSubmitting(true);
    try {
      await profileApi.updateMyManager(Number(managerId));
      await refreshUser();
      setSuccessMessage("Your manager has been updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update your manager. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Profile">
      {showCelebration && (
        <AnniversaryCelebration firstName={user?.firstName} years={celebrationYears} onDone={handleCelebrationDone} />
      )}

      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p>Your account details and reporting line.</p>
        </div>
        {user?.joiningDate && (
          <StatCard icon={<PartyPopper size={20} />} label="With Aakrin for" value={formatTenure(user.joiningDate)} />
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Personal information</span>
          <p className="card-section-subtitle">
            These fields are managed by your admin - contact them to update any of these.
          </p>

          <div className="profile-detail-grid">
            <div>
              <div className="profile-detail-label">Name</div>
              <div className="profile-detail-value">
                {user?.firstName} {user?.lastName}
              </div>
            </div>
            <div>
              <div className="profile-detail-label">Email</div>
              <div className="profile-detail-value">{user?.email}</div>
            </div>
            {user?.isManager && (
              <div>
                <div className="profile-detail-label">Manager status</div>
                <div className="profile-detail-value">You currently have direct reports</div>
              </div>
            )}
            <div>
              <div className="profile-detail-label">Employee code</div>
              <div className="profile-detail-value">{user?.employeeCode || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Mobile number</div>
              <div className="profile-detail-value">{user?.phone || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Date of birth</div>
              <div className="profile-detail-value">{user?.birthDate ? formatDate(user.birthDate) : "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Date of joining</div>
              <div className="profile-detail-value">{user?.joiningDate ? formatDate(user.joiningDate) : "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Gender</div>
              <div className="profile-detail-value">{GENDER_LABELS[user?.gender] || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Marital status</div>
              <div className="profile-detail-value">{MARITAL_STATUS_LABELS[user?.maritalStatus] || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Father's name</div>
              <div className="profile-detail-value">{user?.fatherName || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Spouse name</div>
              <div className="profile-detail-value">{user?.spouseName || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Nationality</div>
              <div className="profile-detail-value">{user?.nationality || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Qualification</div>
              <div className="profile-detail-value">{user?.qualification || "Not set"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Employment details</span>

          <div className="profile-detail-grid">
            <div>
              <div className="profile-detail-label">Designation</div>
              <div className="profile-detail-value">{user?.designation || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Location</div>
              <div className="profile-detail-value">{user?.location || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Tax regime</div>
              <div className="profile-detail-value">{TAX_REGIME_LABELS[user?.taxRegime] || "Not set"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">PAN &amp; Aadhaar</span>
          <p className="card-section-subtitle">
            Sensitive numbers are shown masked. Uploaded documents are visible to admin only.
          </p>

          <div className="profile-detail-grid">
            <div>
              <div className="profile-detail-label">PAN number</div>
              <div className="profile-detail-value">{user?.pan || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Name as per PAN</div>
              <div className="profile-detail-value">{user?.panHolderName || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">UAN</div>
              <div className="profile-detail-value">{user?.uan || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Aadhaar number</div>
              <div className="profile-detail-value">{user?.aadharNumber || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Name as per Aadhaar</div>
              <div className="profile-detail-value">{user?.aadharHolderName || "Not set"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Bank &amp; salary</span>

          <div className="profile-detail-grid">
            <div>
              <div className="profile-detail-label">Bank account number</div>
              <div className="profile-detail-value">{user?.bankAccountNumber || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Bank name</div>
              <div className="profile-detail-value">{user?.bankName || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">IFSC code</div>
              <div className="profile-detail-value">{user?.ifscCode || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">PF number</div>
              <div className="profile-detail-value">{user?.pfNumber || "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Salary / CTC (annual)</div>
              <div className="profile-detail-value">{formatCtc(user?.salaryCtc)}</div>
            </div>
          </div>
        </div>
      </div>

      {user?.salaryStructure && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Salary structure</span>
            <p className="card-section-subtitle">
              How your CTC breaks down, as fixed by admin - effective from{" "}
              <strong>{formatMonth(user.salaryStructure.effectiveFrom)}</strong> onward.
            </p>

            <div className="profile-detail-grid">
              <div>
                <div className="profile-detail-label">Basic</div>
                <div className="profile-detail-value">{user.salaryStructure.basicPercentOfCtc}% of monthly CTC</div>
              </div>
              <div>
                <div className="profile-detail-label">HRA</div>
                <div className="profile-detail-value">{user.salaryStructure.hraPercentOfBasic}% of Basic</div>
              </div>
              <div>
                <div className="profile-detail-label">LTA</div>
                <div className="profile-detail-value">{user.salaryStructure.ltaPercentOfBasic}% of Basic</div>
              </div>
              <div>
                <div className="profile-detail-label">Guaranteed Allowance</div>
                <div className="profile-detail-value">
                  {user.salaryStructure.guaranteedAllowancePercentOfBasic}% of Basic
                </div>
              </div>
              <div>
                <div className="profile-detail-label">Conveyance</div>
                <div className="profile-detail-value">{formatCtc(user.salaryStructure.conveyanceMonthly)}/month</div>
              </div>
              <div>
                <div className="profile-detail-label">Provident Fund</div>
                <div className="profile-detail-value">{formatCtc(user.salaryStructure.pfMonthlyAmount)}/month</div>
              </div>
              <div>
                <div className="profile-detail-label">Professional Tax</div>
                <div className="profile-detail-value">{formatCtc(user.salaryStructure.professionalTax)}/month</div>
              </div>
              <div>
                <div className="profile-detail-label">PT applies once gross pay reaches</div>
                <div className="profile-detail-value">{formatCtc(user.salaryStructure.professionalTaxThreshold)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.pastSalaryStructures?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Past salary structures</span>
            <p className="card-section-subtitle">Earlier entries, most recent first - each was effective until the next one started.</p>

            {user.pastSalaryStructures.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  marginTop: index === 0 ? 0 : 24,
                  paddingTop: index === 0 ? 0 : 24,
                  borderTop: index === 0 ? "none" : "1px solid var(--border-color, #e5e7eb)",
                }}
              >
                <p className="card-section-subtitle">
                  Effective from <strong>{formatMonth(entry.effectiveFrom)}</strong> · CTC (annual):{" "}
                  <strong>{formatCtc(entry.ctc)}</strong>
                </p>

                <div className="profile-detail-grid">
                  <div>
                    <div className="profile-detail-label">Basic</div>
                    <div className="profile-detail-value">{entry.basicPercentOfCtc}% of monthly CTC</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">HRA</div>
                    <div className="profile-detail-value">{entry.hraPercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">LTA</div>
                    <div className="profile-detail-value">{entry.ltaPercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Guaranteed Allowance</div>
                    <div className="profile-detail-value">{entry.guaranteedAllowancePercentOfBasic}% of Basic</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Conveyance</div>
                    <div className="profile-detail-value">{formatCtc(entry.conveyanceMonthly)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Provident Fund</div>
                    <div className="profile-detail-value">{formatCtc(entry.pfMonthlyAmount)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Professional Tax</div>
                    <div className="profile-detail-value">{formatCtc(entry.professionalTax)}/month</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">PT applies once gross pay reaches</div>
                    <div className="profile-detail-value">{formatCtc(entry.professionalTaxThreshold)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden for employees - admin-only feature for now. Uncomment to re-enable.
      <MyIncomeTaxComputation />
      <MyIncomeTaxComputationHistory /> */}

      {user?.customFields?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Other details</span>

            <div className="profile-detail-grid">
              {user.customFields.map((field) => (
                <div key={field.id}>
                  <div className="profile-detail-label">{field.label}</div>
                  <div className="profile-detail-value">{field.value || "Not set"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="card">
          <div className="card-section">
            <span className="card-section-title">My manager</span>

            {!user?.managerId && (
              <Alert type="error">
                You need to set your manager before you can apply for leave.
              </Alert>
            )}
            {currentManagerIsInactive && (
              <Alert type="error">
                Your manager's account is no longer active. Please choose a new one.
              </Alert>
            )}
            {error && <Alert type="error">{error}</Alert>}
            {successMessage && <Alert type="success">{successMessage}</Alert>}

            {!options ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <Spinner size={24} />
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <FormSelect label="Manager" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                  <option value="">Select your manager</option>
                  {displayOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.firstName} {option.lastName} — {option.email}
                      {option.inactive ? " — inactive, please pick someone else" : ""}
                    </option>
                  ))}
                </FormSelect>

                <p className="helper-text">
                  <UserCog size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Every leave request you submit will be sent to this person for approval.
                </p>

                <Button type="submit" isLoading={isSubmitting}>
                  Save
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
