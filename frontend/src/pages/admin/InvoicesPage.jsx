import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileCheck2,
  ReceiptIndianRupee,
  Trash2,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import DocumentUploadField from "./DocumentUploadField";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import {
  downloadBlobAsFile,
  getFilenameFromResponse,
  openBlobInNewTab,
} from "../../utils/openBlob";
import { COMPANY_HOME_STATE } from "../../utils/indianStates";
import { amountInWordsInr } from "../../utils/numberToWords";
import "../../styles/dashboardShared.css";

const todayValue = () => new Date().toISOString().slice(0, 10);
const money = (value) =>
  (value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const DEFAULT_PAYMENT_ADVICE =
  "Payment is due within 15 days from the date of this invoice.";
// A filled-in starting value (not a placeholder) so this field shows real,
// editable text from the start - same as Payment Advice above - instead of
// grey hint text that vanishes the moment admin clicks in. Admin overwrites
// the service/month/day count per invoice, same as they'd edit the payment
// advice sentence if it ever needed to change.
const DEFAULT_DESCRIPTION = "Salesforce Consulting charges for (Aug 2026)\nNo of Working Days : 19 Days";
// AAKRIN's own account, same on every invoice - unlike the description/
// amount these don't change per invoice, so they're pre-filled as real,
// editable text rather than left blank. Admin can still clear/edit any of
// them; the Bank Details box only prints on the PDF at all if at least one
// stays filled in.
const DEFAULT_BANK_ACCOUNT_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const DEFAULT_BANK_NAME = "HDFC Bank";
const DEFAULT_BANK_ACCOUNT_NUMBER = "50200075582652";
const DEFAULT_BANK_IFSC_CODE = "HDFC0000133";
const DEFAULT_DECLARATION =
  "We declare that Invoice shows the actual price of the goods/ Services, described and that all particulars are true and correct. If you have any questions or concerns regarding this invoice, please contact krishna@aakrin.com or Accounts@aakrin.com";

const EMPTY_FORM = {
  invoiceNo: "",
  invoiceDate: todayValue(),
  projectId: "",
  clientFullName: "",
  clientAddress: "",
  clientState: "",
  clientGstNumber: "",
  hsnCode: "998313",
  description: DEFAULT_DESCRIPTION,
  paymentAdviceText: DEFAULT_PAYMENT_ADVICE,
  totalTaxableValue: "",
  bankAccountName: DEFAULT_BANK_ACCOUNT_NAME,
  bankName: DEFAULT_BANK_NAME,
  bankAccountNumber: DEFAULT_BANK_ACCOUNT_NUMBER,
  bankIfscCode: DEFAULT_BANK_IFSC_CODE,
  declarationText: DEFAULT_DECLARATION,
  // Chosen at Save time - Preview always renders a PDF regardless, since a
  // browser tab can't show an inline .docx the way it shows a PDF.
  format: "PDF",
};

export default function InvoicesPage() {
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState(null);
  // Authorized-signature image - company-wide (see CompanySettings.signatureUrl),
  // not per-invoice, so it lives here rather than in `form`.
  const [companySettings, setCompanySettings] = useState(null);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // "form" = the initial entry screen, "review" = the full editable preview
  // shown after clicking Generate - nothing is saved until Save is clicked
  // from there.
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadInvoices = () =>
    adminApi.listInvoices().then((data) => setInvoices(data.invoices));

  useEffect(() => {
    adminApi.listProjects().then((data) => setProjects(data.projects));
    adminApi.getCompanySettings().then((data) => setCompanySettings(data.settings));
    loadInvoices();
  }, []);

  const handleSignatureUpload = async (file) => {
    setError("");
    setSignatureBusy(true);
    try {
      const { signatureUrl } = await adminApi.uploadInvoiceSignature(file);
      setCompanySettings((prev) => ({ ...prev, signatureUrl }));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload the signature."));
    } finally {
      setSignatureBusy(false);
    }
  };

  const handleSignatureRemove = async () => {
    setError("");
    setSignatureBusy(true);
    try {
      await adminApi.removeInvoiceSignature();
      setCompanySettings((prev) => ({ ...prev, signatureUrl: null }));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove the signature."));
    } finally {
      setSignatureBusy(false);
    }
  };

  // Only client projects that actually have a company name on file are
  // useful here - the dropdown exists to auto-fill the Bill To block from
  // what admin already entered while creating the project.
  const clientProjectOptions = useMemo(
    () =>
      projects.filter((p) => p.projectType === "ASSIGNED" && p.clientFullName),
    [projects],
  );

  const onFieldChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleProjectSelect = (projectId) => {
    const project = clientProjectOptions.find(
      (p) => String(p.id) === String(projectId),
    );
    setForm((prev) => ({
      ...prev,
      projectId,
      clientFullName: project?.clientFullName || prev.clientFullName,
      clientAddress: project?.clientAddress || prev.clientAddress,
      clientState: project?.clientState || prev.clientState,
      clientGstNumber: project?.gstNumber || prev.clientGstNumber,
    }));
  };

  // Live preview only - the backend independently recomputes these figures
  // (and the Amount in Words line) from clientState/totalTaxableValue at
  // save time, so this is purely so admin can see the breakdown - here and
  // in the review step below - before actually saving.
  const taxPreview = useMemo(() => {
    const taxableValue = Number(form.totalTaxableValue) || 0;
    if (taxableValue <= 0) return null;
    const isIntraState =
      (form.clientState || "").trim().toLowerCase() ===
      COMPANY_HOME_STATE.toLowerCase();
    if (isIntraState) {
      const cgst = Math.round(taxableValue * 0.09 * 100) / 100;
      const sgst = Math.round(taxableValue * 0.09 * 100) / 100;
      const total = taxableValue + cgst + sgst;
      return {
        taxType: "CGST + SGST",
        rows: [
          ["CGST @ 9%", cgst],
          ["SGST @ 9%", sgst],
        ],
        total,
      };
    }
    const igst = Math.round(taxableValue * 0.18 * 100) / 100;
    const total = taxableValue + igst;
    return { taxType: "IGST", rows: [["IGST @ 18%", igst]], total };
  }, [form.totalTaxableValue, form.clientState]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setStep("form");
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    setError("");
    if (
      !form.invoiceNo.trim() ||
      !form.clientFullName.trim() ||
      !form.description.trim() ||
      !form.totalTaxableValue
    ) {
      setError(
        "Please fill in invoice number, client name, description, and the total taxable value.",
      );
      return;
    }
    setStep("review");
  };

  const buildPayload = () => ({
    ...form,
    projectId: form.projectId ? Number(form.projectId) : null,
    totalTaxableValue: Number(form.totalTaxableValue),
  });

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await adminApi.createInvoice(buildPayload());
      setSuccess(`Invoice ${form.invoiceNo} generated.`);
      resetForm();
      loadInvoices();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Couldn't generate this invoice. Please try again.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Renders the PDF from whatever's currently in the review form (watermark,
  // signature, and all) without saving anything - admin can preview as many
  // times as they like while still editing, then Save when it looks right.
  const handlePreviewPdf = async () => {
    setError("");
    setIsPreviewingPdf(true);
    try {
      const response = await adminApi.previewInvoicePdf(buildPayload());
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this invoice."));
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  const fileExtension = (invoice) => (invoice.format === "WORD" ? "docx" : "pdf");

  const handleDownload = async (invoice) => {
    setDownloadingId(invoice.id);
    try {
      const response = await adminApi.downloadInvoiceDocument(invoice.id);
      downloadBlobAsFile(
        response.data,
        getFilenameFromResponse(response, `invoice-${invoice.invoiceNo}.${fileExtension(invoice)}`),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this invoice."));
    } finally {
      setDownloadingId(null);
    }
  };

  // Word documents can't be shown inline in a browser tab the way a PDF can
  // - "Preview" is only offered for PDF-format invoices (see the row-action
  // buttons below); Word ones only ever get Download.
  const handlePreview = async (invoice) => {
    setPreviewingId(invoice.id);
    try {
      const response = await adminApi.downloadInvoiceDocument(invoice.id);
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this invoice."));
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDelete = async (invoice) => {
    if (
      !window.confirm(
        `Delete invoice ${invoice.invoiceNo}? This can't be undone.`,
      )
    )
      return;
    setDeletingId(invoice.id);
    try {
      await adminApi.deleteInvoice(invoice.id);
      loadInvoices();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this invoice."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout title="Invoice">
      <div className="page-header">
        <div>
          <h1>Invoice</h1>
          <p>
            Generate a Tax Invoice PDF for a client and keep a saved history of
            every invoice issued.
          </p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Authorized signature</span>
          <p className="card-section-subtitle">
            Uploaded once, reused on every invoice PDF from here on - replacing it only affects invoices generated
            after the change, not ones already saved.
          </p>
          {companySettings?.signatureUrl && (
            <img
              src={companySettings.signatureUrl}
              alt="Authorized signature"
              style={{ maxHeight: 50, display: "block", marginBottom: 10 }}
            />
          )}
          <DocumentUploadField
            label="Signature image (JPG or PNG)"
            hasDocument={Boolean(companySettings?.signatureUrl)}
            isBusy={signatureBusy}
            onUpload={handleSignatureUpload}
            onView={() =>
              window.open(companySettings.signatureUrl, "_blank", "noopener,noreferrer")
            }
            onRemove={handleSignatureRemove}
            accept=".jpg,.jpeg,.png"
          />
        </div>
      </div>

      {step === "form" ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Generate invoice</span>
            <p className="card-section-subtitle">
              Fill in the details below, then click Generate to review the full
              invoice - nothing is saved until you confirm on the next screen.
            </p>

            <form onSubmit={handleGenerate} noValidate>
              <div className="form-two-col">
                <TextInput
                  label="Invoice No"
                  placeholder="e.g. AAKRIN/2026-27/001"
                  value={form.invoiceNo}
                  onChange={(e) => onFieldChange("invoiceNo", e.target.value)}
                />
                <TextInput
                  label="Invoice Date"
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => onFieldChange("invoiceDate", e.target.value)}
                />
              </div>

              {clientProjectOptions.length > 0 && (
                <div className="form-two-col">
                  <FormSelect
                    label="Company name (from a saved project, optional)"
                    value={form.projectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                  >
                    <option value="">Type client details manually…</option>
                    {clientProjectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.clientFullName} ({p.name})
                      </option>
                    ))}
                  </FormSelect>
                </div>
              )}

              <hr className="modal-section-divider" />
              <p className="modal-section-title">Bill to</p>

              <div className="form-two-col">
                <TextInput
                  label="Full name of the client"
                  value={form.clientFullName}
                  onChange={(e) =>
                    onFieldChange("clientFullName", e.target.value)
                  }
                />
                <TextInput
                  label="GST number"
                  value={form.clientGstNumber}
                  onChange={(e) =>
                    onFieldChange("clientGstNumber", e.target.value)
                  }
                />
              </div>
              <TextArea
                label="Address"
                rows={2}
                value={form.clientAddress}
                onChange={(e) => onFieldChange("clientAddress", e.target.value)}
              />
              <div className="form-two-col">
                <TextInput
                  label="State (drives IGST vs CGST+SGST)"
                  placeholder="e.g. Karnataka"
                  value={form.clientState}
                  onChange={(e) => onFieldChange("clientState", e.target.value)}
                />
                <TextInput
                  label="HSN / SAC code"
                  value={form.hsnCode}
                  onChange={(e) => onFieldChange("hsnCode", e.target.value)}
                />
              </div>

              <hr className="modal-section-divider" />
              <p className="modal-section-title">Service &amp; amount</p>

              <TextArea
                label="Description of service"
                rows={2}
                value={form.description}
                onChange={(e) => onFieldChange("description", e.target.value)}
              />
              <TextInput
                label="Payment advice"
                value={form.paymentAdviceText}
                onChange={(e) =>
                  onFieldChange("paymentAdviceText", e.target.value)
                }
              />
              <div className="form-two-col">
                <TextInput
                  label="Total Taxable Value (INR)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalTaxableValue}
                  onChange={(e) =>
                    onFieldChange("totalTaxableValue", e.target.value)
                  }
                />
              </div>

              <InvoiceLineTable
                description={form.description}
                hsnCode={form.hsnCode}
                totalTaxableValue={form.totalTaxableValue}
                taxPreview={taxPreview}
              />

              <hr className="modal-section-divider" />
              <p className="modal-section-title">
                Bank details (optional - shown on the PDF only if filled in)
              </p>

              <TextInput
                label="Account name"
                value={form.bankAccountName}
                onChange={(e) =>
                  onFieldChange("bankAccountName", e.target.value)
                }
              />
              <div className="form-three-col">
                <TextInput
                  label="Bank name"
                  value={form.bankName}
                  onChange={(e) => onFieldChange("bankName", e.target.value)}
                />
                <TextInput
                  label="Account No"
                  value={form.bankAccountNumber}
                  onChange={(e) =>
                    onFieldChange("bankAccountNumber", e.target.value)
                  }
                />
                <TextInput
                  label="IFSC code"
                  value={form.bankIfscCode}
                  onChange={(e) =>
                    onFieldChange("bankIfscCode", e.target.value)
                  }
                />
              </div>

              <TextArea
                label="Declaration"
                rows={3}
                value={form.declarationText}
                onChange={(e) =>
                  onFieldChange("declarationText", e.target.value)
                }
              />

              <div
                className="modal-actions"
                style={{ justifyContent: "flex-start" }}
              >
                <Button type="submit">
                  <FileCheck2 size={16} />
                  Generate
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <InvoiceReview
          form={form}
          onFieldChange={onFieldChange}
          taxPreview={taxPreview}
          onBack={() => setStep("form")}
          onSave={handleSave}
          isSaving={isSaving}
          onPreviewPdf={handlePreviewPdf}
          isPreviewingPdf={isPreviewingPdf}
        />
      )}

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Invoice history</span>

          {!invoices ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "24px 0",
              }}
            >
              <Spinner size={24} />
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ReceiptIndianRupee size={22} />
              </span>
              <p>No invoices generated yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Tax</th>
                    <th>Format</th>
                    <th>Total Value</th>
                    <th>Generated by</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="table-cell-primary">
                        {invoice.invoiceNo}
                      </td>
                      <td className="table-cell-secondary">
                        {new Date(invoice.invoiceDate).toLocaleDateString(
                          "en-IN",
                        )}
                      </td>
                      <td className="table-cell-secondary">
                        {invoice.clientFullName}
                      </td>
                      <td className="table-cell-secondary">
                        {invoice.taxType === "IGST" ? "IGST" : "CGST + SGST"}
                      </td>
                      <td className="table-cell-secondary">
                        {invoice.format === "WORD" ? "Word" : "PDF"}
                      </td>
                      <td className="table-cell-secondary">
                        ₹{money(invoice.totalInvoiceValue)}
                      </td>
                      <td className="table-cell-secondary">
                        {invoice.generatedBy
                          ? `${invoice.generatedBy.firstName} ${invoice.generatedBy.lastName}`
                          : "-"}
                      </td>
                      <td>
                        <div className="row-actions">
                          {invoice.format !== "WORD" && (
                            <button
                              type="button"
                              className="row-action-btn"
                              disabled={previewingId === invoice.id}
                              onClick={() => handlePreview(invoice)}
                            >
                              <Eye size={14} />
                              Preview
                            </button>
                          )}
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={downloadingId === invoice.id}
                            onClick={() => handleDownload(invoice)}
                          >
                            <Download size={14} />
                            Download
                          </button>
                          <button
                            type="button"
                            className="row-action-btn reject"
                            disabled={deletingId === invoice.id}
                            onClick={() => handleDelete(invoice)}
                          >
                            <Trash2 size={14} />
                            {deletingId === invoice.id ? "Deleting…" : "Delete"}
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

// The full editable preview shown after "Generate" - laid out to mirror the
// actual PDF (letterhead / Bill To / services table / totals / bank /
// declaration) so admin can see "the overall view" before saving, but every
// field that's realistically worth a last-minute tweak (date, bank details,
// service description, amount) is a live input bound to the same form state,
// not read-only text - editing here IS editing the invoice that gets saved.
function InvoiceReview({
  form,
  onFieldChange,
  taxPreview,
  onBack,
  onSave,
  isSaving,
  onPreviewPdf,
  isPreviewingPdf,
}) {
  const amountInWords = taxPreview ? amountInWordsInr(taxPreview.total) : "";

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Review invoice</span>
        <p className="card-section-subtitle">
          This is how the invoice will be generated. Change anything below, then
          save.
        </p>

        <div className="client-doc-group">
          <span className="client-doc-group-title">Invoice</span>
          <div className="form-two-col" style={{ margin: 0 }}>
            <div className="field">
              <label className="field-label">Invoice No</label>
              <div className="field-input-wrap">
                <div
                  className="field-input"
                  style={{ background: "var(--color-surface-muted, #f5f5f7)" }}
                >
                  {form.invoiceNo}
                </div>
              </div>
            </div>
            <TextInput
              label="Invoice Date"
              type="date"
              value={form.invoiceDate}
              onChange={(e) => onFieldChange("invoiceDate", e.target.value)}
            />
          </div>
        </div>

        <div className="client-doc-group">
          <span className="client-doc-group-title">Bill To</span>
          <div className="form-two-col" style={{ margin: 0 }}>
            <TextInput
              label="Client name"
              value={form.clientFullName}
              onChange={(e) => onFieldChange("clientFullName", e.target.value)}
            />
            <TextInput
              label="GST number"
              value={form.clientGstNumber}
              onChange={(e) => onFieldChange("clientGstNumber", e.target.value)}
            />
          </div>
          <TextArea
            label="Address"
            rows={2}
            value={form.clientAddress}
            onChange={(e) => onFieldChange("clientAddress", e.target.value)}
          />
          <div className="form-two-col" style={{ margin: 0 }}>
            <TextInput
              label="State (Place of Supply)"
              value={form.clientState}
              onChange={(e) => onFieldChange("clientState", e.target.value)}
            />
            <TextInput
              label="HSN / SAC code"
              value={form.hsnCode}
              onChange={(e) => onFieldChange("hsnCode", e.target.value)}
            />
          </div>
        </div>

        <div className="client-doc-group">
          <span className="client-doc-group-title">Payment advice</span>
          <TextInput
            value={form.paymentAdviceText}
            onChange={(e) => onFieldChange("paymentAdviceText", e.target.value)}
          />
        </div>

        <div className="client-doc-group">
          <span className="client-doc-group-title">
            Description of services
          </span>
          <TextArea
            rows={3}
            value={form.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
          />
          <TextInput
            label="Total Taxable Value (INR)"
            type="number"
            min="0"
            step="0.01"
            value={form.totalTaxableValue}
            onChange={(e) => onFieldChange("totalTaxableValue", e.target.value)}
          />
        </div>

        <InvoiceLineTable
          description={form.description}
          hsnCode={form.hsnCode}
          totalTaxableValue={form.totalTaxableValue}
          taxPreview={taxPreview}
        />
        {taxPreview && (
          <p className="helper-text" style={{ marginTop: -8 }}>
            Amount in Words: {amountInWords}
          </p>
        )}

        <div className="client-doc-group">
          <span className="client-doc-group-title">
            Kindly make the payment to
          </span>
          <p className="helper-text" style={{ marginTop: -4 }}>
            Only shown on the PDF if at least one field below is filled in.
          </p>
          <TextInput
            label="Account name"
            value={form.bankAccountName}
            onChange={(e) => onFieldChange("bankAccountName", e.target.value)}
          />
          <div className="form-three-col" style={{ margin: 0 }}>
            <TextInput
              label="Bank name"
              value={form.bankName}
              onChange={(e) => onFieldChange("bankName", e.target.value)}
            />
            <TextInput
              label="Account No"
              value={form.bankAccountNumber}
              onChange={(e) =>
                onFieldChange("bankAccountNumber", e.target.value)
              }
            />
            <TextInput
              label="IFSC code"
              value={form.bankIfscCode}
              onChange={(e) => onFieldChange("bankIfscCode", e.target.value)}
            />
          </div>
        </div>

        <div className="client-doc-group">
          <span className="client-doc-group-title">Declaration</span>
          <TextArea
            rows={3}
            value={form.declarationText}
            onChange={(e) => onFieldChange("declarationText", e.target.value)}
          />
        </div>

        <div className="client-doc-group">
          <span className="client-doc-group-title">Save as</span>
          <p className="helper-text" style={{ marginTop: -4 }}>
            Preview PDF below always shows a PDF regardless of this choice - a browser tab can't display a Word
            document inline the way it can a PDF.
          </p>
          <div className="form-two-col" style={{ margin: 0, maxWidth: 320 }}>
            <FormSelect
              value={form.format}
              onChange={(e) => onFieldChange("format", e.target.value)}
            >
              <option value="PDF">PDF</option>
              <option value="WORD">Word (.docx)</option>
            </FormSelect>
          </div>
        </div>

        <div
          className="modal-actions"
          style={{ justifyContent: "flex-start", gap: 10 }}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={isSaving}
          >
            <ArrowLeft size={16} />
            Edit details
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onPreviewPdf}
            isLoading={isPreviewingPdf}
            disabled={isSaving}
          >
            <Eye size={16} />
            Preview PDF
          </Button>
          <Button type="button" onClick={onSave} isLoading={isSaving} disabled={isPreviewingPdf}>
            <FileCheck2 size={16} />
            Save invoice
          </Button>
        </div>
      </div>
    </div>
  );
}

// Live preview of the invoice's services table, laid out exactly like the
// PDF's own S No / Description / Amount table (HSN appended inside the
// description cell, same as the PDF, and the Total Taxable Value / tax /
// Total Invoice Value rows folded into the same table once an amount is
// entered) - so what admin sees here is what actually prints. Nothing here
// is a separate control: the description/HSN/amount stay editable via the
// fields above it, this is purely a read-only reflection of them.
function InvoiceLineTable({
  description,
  hsnCode,
  totalTaxableValue,
  taxPreview,
}) {
  if (!description.trim()) return null;

  const taxableValue = Number(totalTaxableValue) || 0;
  const descText = hsnCode.trim()
    ? `${description}\n\nHSN: ${hsnCode}`
    : description;

  return (
    <div className="data-table-wrap" style={{ marginBottom: 16 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 50 }}>S No</th>
            <th>Description of Services</th>
            <th style={{ textAlign: "right" }}>Total Amount INR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              className="table-cell-secondary"
              style={{ textAlign: "center" }}
            >
              1
            </td>
            <td
              className="table-cell-primary"
              style={{ whiteSpace: "pre-line" }}
            >
              {descText}
            </td>
            <td className="table-cell-secondary" style={{ textAlign: "right" }}>
              ₹{money(taxableValue)}/-
            </td>
          </tr>
          {taxPreview && (
            <>
              <tr>
                <td
                  colSpan={2}
                  className="table-cell-primary"
                  style={{ textAlign: "right" }}
                >
                  Total Taxable Value
                </td>
                <td
                  className="table-cell-secondary"
                  style={{ textAlign: "right" }}
                >
                  ₹{money(taxableValue)}/-
                </td>
              </tr>
              {taxPreview.rows.map(([label, amount]) => (
                <tr key={label}>
                  <td
                    colSpan={2}
                    className="table-cell-secondary"
                    style={{ textAlign: "right" }}
                  >
                    {label} of Total Taxable Value
                  </td>
                  <td
                    className="table-cell-secondary"
                    style={{ textAlign: "right" }}
                  >
                    ₹{money(amount)}/-
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={2}
                  className="table-cell-primary"
                  style={{ textAlign: "right" }}
                >
                  <strong>Total Invoice Value ({taxPreview.taxType})</strong>
                </td>
                <td
                  className="table-cell-secondary"
                  style={{ textAlign: "right" }}
                >
                  <strong>₹{money(taxPreview.total)}/-</strong>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
