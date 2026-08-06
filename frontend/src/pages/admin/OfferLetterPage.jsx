import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, ListChecks, Trash2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { buildOfferLetterText } from "../../utils/offerLetterTemplate";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";
import { downloadBlobAsFile, openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

// Offer date is the only figure that needs its own input (it's stored as a
// real date column, for sorting/history). Every other compensation figure
// (Total Fixed Compensation, Annual CTC, the Appendix A breakdown, etc.) is
// left blank by the template and typed directly into the letter text below
// - there's no separate form for them, since the text is fully editable anyway.
const EMPTY_FIGURES = { offerDate: todayDateInputValue() };

export default function OfferLetterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [offerLetters, setOfferLetters] = useState(null);
  const [figures] = useState(EMPTY_FIGURES);
  const [letterText, setLetterText] = useState("");
  const [hasEditedLetter, setHasEditedLetter] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadOfferLetters = () => adminApi.listOfferLetters(id).then((res) => setOfferLetters(res.offerLetters));

  useEffect(() => {
    adminApi.getUserDetails(id).then((res) => setEmployee(res.user));
    loadOfferLetters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refills the letter as the figures form changes, but never
  // overwrites text the admin has already started editing by hand.
  useEffect(() => {
    if (!employee || hasEditedLetter) return;
    setLetterText(buildOfferLetterText(employee, figures));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, figures]);

  const handlePreview = async () => {
    setError("");
    if (!letterText.trim()) {
      setError("The offer letter text can't be empty.");
      return;
    }

    setIsPreviewing(true);
    try {
      const response = await adminApi.previewOfferLetterPdf(id, letterText);
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this offer letter."));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!figures.offerDate) {
      setError("Please choose an offer date.");
      return;
    }
    if (!letterText.trim()) {
      setError("The offer letter text can't be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const { offerLetter } = await adminApi.createOfferLetter(id, { offerDate: figures.offerDate, letterText });
      const response = await adminApi.downloadOfferLetterPdf(offerLetter.id);
      downloadBlobAsFile(response.data, `offer-letter-${employee.firstName}-${employee.lastName}.pdf`);
      setSuccessMessage("Offer letter saved and downloaded.");
      setHasEditedLetter(false);
      await loadOfferLetters();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this offer letter."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (offerLetterId) => {
    setError("");
    setDownloadingId(offerLetterId);
    try {
      const response = await adminApi.downloadOfferLetterPdf(offerLetterId);
      downloadBlobAsFile(response.data, `offer-letter-${employee.firstName}-${employee.lastName}.pdf`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this offer letter."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (offerLetterId) => {
    setError("");
    setDeletingId(offerLetterId);
    try {
      await adminApi.deleteOfferLetter(offerLetterId);
      await loadOfferLetters();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this offer letter."));
    } finally {
      setDeletingId(null);
    }
  };

  if (!employee) {
    return (
      <DashboardLayout title="Offer Letter">
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Offer Letter">
      <button
        type="button"
        className="link-btn"
        style={{ marginBottom: 16 }}
        onClick={() => navigate(`/admin/users/${id}/details`)}
      >
        <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Back to employee
      </button>

      <div className="page-header">
        <div>
          <h1>
            Offer Letter — {employee.firstName} {employee.lastName}
          </h1>
          <p>Name, designation, work location, joining date, and DOB fill in automatically from this employee's record.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{successMessage}</Alert>

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Letter text</span>
            <p className="card-section-subtitle">
              Everything - the offer date included - is left blank or pre-filled below for you to type directly; edit
              anywhere before saving.
            </p>

            <TextArea
              rows={28}
              value={letterText}
              onChange={(e) => {
                setHasEditedLetter(true);
                setLetterText(e.target.value);
              }}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />

            <div className="modal-actions" style={{ marginTop: 16, justifyContent: "flex-start", gap: 10 }}>
              <Button type="button" variant="secondary" onClick={handlePreview} isLoading={isPreviewing}>
                <Eye size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                Preview PDF
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Save &amp; download PDF
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Past offer letters</span>

          {!offerLetters ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Spinner size={24} />
            </div>
          ) : offerLetters.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>No offer letters generated yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Offer date</th>
                    <th>Generated by</th>
                    <th>Generated on</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {offerLetters.map((letter) => (
                    <tr key={letter.id}>
                      <td className="table-cell-primary">{formatDate(letter.offerDate)}</td>
                      <td className="table-cell-secondary">
                        {letter.generatedBy.firstName} {letter.generatedBy.lastName}
                      </td>
                      <td className="table-cell-secondary">{formatDate(letter.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={downloadingId === letter.id}
                            onClick={() => handleDownload(letter.id)}
                          >
                            <Download size={14} />
                            {downloadingId === letter.id ? "Downloading…" : "Download"}
                          </button>
                          <button
                            type="button"
                            className="row-action-btn reject"
                            disabled={deletingId === letter.id}
                            onClick={() => handleDelete(letter.id)}
                          >
                            <Trash2 size={14} />
                            {deletingId === letter.id ? "Deleting…" : "Delete"}
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
    </DashboardLayout>
  );
}
