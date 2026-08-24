import { useEffect, useState } from "react";
import {
  UserCog,
  PartyPopper,
  Briefcase,
  Wallet,
  History,
  User,
  CreditCard,
  Landmark,
  FileText,
  LogOut,
  Pencil,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import AnniversaryCelebration from "../../components/common/AnniversaryCelebration";
import ResignationModal from "./ResignationModal";
import EditPersonalInfoModal from "./EditPersonalInfoModal";
import EditStatutoryInfoModal from "./EditStatutoryInfoModal";
import EditBankInfoModal from "./EditBankInfoModal";
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationYears, setCelebrationYears] = useState(null);
  const [myResignation, setMyResignation] = useState(undefined);
  const [showResignationModal, setShowResignationModal] = useState(false);
  const [resignationError, setResignationError] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [editingSection, setEditingSection] = useState(null); // "personal" | "statutory" | "bank" | null
  const [profileMessage, setProfileMessage] = useState("");

  const isAdmin = user?.userType === "ADMIN";

  const handleSectionSaved = async (label) => {
    setEditingSection(null);
    await refreshUser();
    setProfileMessage(`${label} updated.`);
  };

  const loadMyResignation = () =>
    profileApi
      .getMyResignation()
      .then((data) => setMyResignation(data.resignation))
      .catch(() => setResignationError("Couldn't load your resignation status. Please try again."));

  useEffect(() => {
    if (isAdmin) return;
    loadMyResignation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWithdrawResignation = async () => {
    setResignationError("");
    setIsWithdrawing(true);
    try {
      await profileApi.withdrawResignation(myResignation.id);
      await loadMyResignation();
    } catch (err) {
      setResignationError(getErrorMessage(err, "Couldn't withdraw your resignation. Please try again."));
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Days left in the 30-day notice period, counted down to lastWorkingDate -
  // 0 once/if that date has passed, never negative.
  const noticeDaysRemaining = (lastWorkingDate) =>
    Math.max(0, Math.ceil((new Date(lastWorkingDate) - new Date()) / (1000 * 60 * 60 * 24)));

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

      <Alert type="success">{profileMessage}</Alert>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">
            <Briefcase size={15} className="profile-title-icon" />
            Employment details
          </span>

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
              <div className="profile-detail-label">Date of joining</div>
              <div className="profile-detail-value">{user?.joiningDate ? formatDate(user.joiningDate) : "Not set"}</div>
            </div>
            <div>
              <div className="profile-detail-label">Tax regime</div>
              <div className="profile-detail-value">{TAX_REGIME_LABELS[user?.taxRegime] || "Not set"}</div>
            </div>
          </div>
        </div>
      </div>

      {user?.salaryStructure && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">
              <Wallet size={15} className="profile-title-icon" />
              Current salary structure
            </span>
            <p className="card-section-subtitle">
              How your CTC breaks down, as fixed by admin - effective from{" "}
              <strong>{formatMonth(user.salaryStructure.effectiveFrom)}</strong> onward.
            </p>

            <div className="profile-detail-grid">
              <div>
                <div className="profile-detail-label">CTC (annual)</div>
                <div className="profile-detail-value">{formatCtc(user.salaryStructure.ctc)}</div>
              </div>
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
            <span className="card-section-title">
              <History size={15} className="profile-title-icon" />
              Past salary structures
            </span>
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

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <div className="card-section-header">
            <span className="card-section-title-text">
              <User size={15} className="profile-title-icon" />
              Personal information
            </span>
            {!isAdmin &&
              (user?.personalInfoEditsRemaining > 0 ? (
                <button type="button" className="link-btn" onClick={() => setEditingSection("personal")}>
                  <Pencil size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Edit
                </button>
              ) : (
                <span className="card-section-header-note">No self-edits left - contact admin</span>
              ))}
          </div>
          <p className="card-section-subtitle">
            {isAdmin
              ? "These fields are managed by your admin - contact them to update any of these."
              : "Name, employee code, and email are managed by your admin - contact them to change those. Everything else you can edit yourself, up to 3 times."}
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
          <div className="card-section-header">
            <span className="card-section-title-text">
              <CreditCard size={15} className="profile-title-icon" />
              Statutory Information
            </span>
            {!isAdmin &&
              (user?.statutoryInfoEditsRemaining > 0 ? (
                <button type="button" className="link-btn" onClick={() => setEditingSection("statutory")}>
                  <Pencil size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Edit
                </button>
              ) : (
                <span className="card-section-header-note">No self-edits left - contact admin</span>
              ))}
          </div>
          <p className="card-section-subtitle">
            Sensitive numbers are shown masked. Uploaded documents are visible to admin only.
            {!isAdmin && " PF number can only be changed by your admin - everything else you can edit yourself, up to 3 times."}
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
            <div>
              <div className="profile-detail-label">PF number</div>
              <div className="profile-detail-value">{user?.pfNumber || "Not set"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <div className="card-section-header">
            <span className="card-section-title-text">
              <Landmark size={15} className="profile-title-icon" />
              Bank &amp; salary
            </span>
            {!isAdmin &&
              (user?.bankInfoEditsRemaining > 0 ? (
                <button type="button" className="link-btn" onClick={() => setEditingSection("bank")}>
                  <Pencil size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Edit
                </button>
              ) : (
                <span className="card-section-header-note">No self-edits left - contact admin</span>
              ))}
          </div>
          {!isAdmin && (
            <p className="card-section-subtitle">
              Salary / CTC can only be changed by your admin - everything else you can edit yourself, up to 3 times.
            </p>
          )}

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
              <div className="profile-detail-label">Salary / CTC (annual)</div>
              <div className="profile-detail-value">{formatCtc(user?.salaryCtc)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden for employees - admin-only feature for now. Uncomment to re-enable.
      <MyIncomeTaxComputation />
      <MyIncomeTaxComputationHistory /> */}

      {user?.customFields?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">
              <FileText size={15} className="profile-title-icon" />
              Other details
            </span>

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
            <span className="card-section-title">
              <UserCog size={15} className="profile-title-icon" />
              My manager
            </span>

            {!user?.managerId && (
              <Alert type="error">
                You don't have a manager assigned yet - contact your admin to get one set before you can apply for
                leave.
              </Alert>
            )}

            {user?.managerId && (
              <div className="profile-detail-grid" style={{ marginBottom: 18 }}>
                <div>
                  <div className="profile-detail-label">Manager</div>
                  <div className="profile-detail-value">
                    {user?.manager?.firstName} {user?.manager?.lastName}
                    {user?.manager?.email ? ` — ${user.manager.email}` : ""}
                  </div>
                </div>
              </div>
            )}

            <p className="helper-text" style={{ marginTop: 0 }}>
              <UserCog size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Only admin can set or change your manager. Every leave request you submit is sent to them for approval.
            </p>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-section">
            <span className="card-section-title">
              <LogOut size={15} className="profile-title-icon" />
              Resignation
            </span>

            {resignationError && <Alert type="error">{resignationError}</Alert>}

            {myResignation === undefined ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <Spinner size={24} />
              </div>
            ) : !myResignation || ["REJECTED", "WITHDRAWN"].includes(myResignation.status) ? (
              <>
                <p className="card-section-subtitle">
                  {myResignation?.status === "REJECTED" &&
                    "Your previous resignation was rejected by admin. "}
                  {myResignation?.status === "WITHDRAWN" && "You previously withdrew your resignation. "}
                  If you wish to resign, submit a request below - it will be sent to your manager (view only) and
                  admin for review.
                </p>
                <Button type="button" onClick={() => setShowResignationModal(true)}>
                  Submit resignation
                </Button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <StatusBadge status={myResignation.status} />
                  <span className="card-section-subtitle" style={{ margin: 0 }}>
                    Submitted on {formatDate(myResignation.createdAt)}
                  </span>
                </div>

                <div className="profile-detail-grid">
                  <div>
                    <div className="profile-detail-label">Reason</div>
                    <div className="profile-detail-value">{myResignation.reason}</div>
                  </div>
                  <div>
                    <div className="profile-detail-label">Proposed last working day</div>
                    <div className="profile-detail-value">{formatDate(myResignation.proposedLastWorkingDate)}</div>
                  </div>
                  {myResignation.status === "ACCEPTED" && (
                    <>
                      <div>
                        <div className="profile-detail-label">Confirmed last working day</div>
                        <div className="profile-detail-value">{formatDate(myResignation.lastWorkingDate)}</div>
                      </div>
                      <div>
                        <div className="profile-detail-label">Notice period</div>
                        <div className="profile-detail-value">
                          {noticeDaysRemaining(myResignation.lastWorkingDate)} day
                          {noticeDaysRemaining(myResignation.lastWorkingDate) !== 1 ? "s" : ""} remaining
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {myResignation.status === "PENDING" && (
                  <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
                    <Button variant="secondary" isLoading={isWithdrawing} onClick={handleWithdrawResignation}>
                      Withdraw resignation
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showResignationModal && (
        <ResignationModal
          user={user}
          onClose={() => setShowResignationModal(false)}
          onSubmitted={() => {
            setShowResignationModal(false);
            loadMyResignation();
          }}
        />
      )}

      {editingSection === "personal" && (
        <EditPersonalInfoModal
          user={user}
          editsRemaining={user?.personalInfoEditsRemaining ?? 0}
          onClose={() => setEditingSection(null)}
          onSaved={() => handleSectionSaved("Personal information")}
        />
      )}

      {editingSection === "statutory" && (
        <EditStatutoryInfoModal
          user={user}
          editsRemaining={user?.statutoryInfoEditsRemaining ?? 0}
          onClose={() => setEditingSection(null)}
          onSaved={() => handleSectionSaved("Statutory information")}
        />
      )}

      {editingSection === "bank" && (
        <EditBankInfoModal
          user={user}
          editsRemaining={user?.bankInfoEditsRemaining ?? 0}
          onClose={() => setEditingSection(null)}
          onSaved={() => handleSectionSaved("Bank information")}
        />
      )}
    </DashboardLayout>
  );
}
