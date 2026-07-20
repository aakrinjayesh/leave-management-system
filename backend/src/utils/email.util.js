const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;

const isRealMailConfigured = () => !env.MAIL_STUB && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;

const getTransporter = () => {
  if (!isRealMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
};

const otpEmailTemplates = {
  REGISTER: {
    subject: "Activate your Aakrin Leave Management account",
    heading: "Activate your account",
    intro: "Use the code below to verify your email and set up your password.",
  },
  LOGIN: {
    subject: "Your Aakrin Leave Management login code",
    heading: "Confirm your login",
    intro: "Use the code below to finish signing in.",
  },
  FORGOT_PASSWORD: {
    subject: "Reset your Aakrin Leave Management password",
    heading: "Reset your password",
    intro: "Use the code below to verify it's you and set a new password.",
  },
};

const buildOtpEmailHtml = ({ heading, intro, otp, firstName, minutes }) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">${heading}</h2>
    <p>Hi ${firstName || "there"},</p>
    <p>${intro}</p>
    <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
      ${otp}
    </div>
    <p>This code expires in ${minutes} minutes. If you didn't request this, you can safely ignore this email.</p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Aakrin Leave Management</p>
  </div>
`;

const sendOtpEmail = async ({ to, firstName, purpose, otp, minutes }) => {
  const template = otpEmailTemplates[purpose] || otpEmailTemplates.LOGIN;
  const html = buildOtpEmailHtml({ ...template, otp, firstName, minutes });
  const activeTransporter = getTransporter();

  // Always echo the OTP to the terminal outside production - handy for testing
  // even when real email is configured, so you don't have to check an inbox.
  if (env.NODE_ENV !== "production") {
    console.log(`\n[OTP] To: ${to} | Purpose: ${purpose} | OTP: ${otp} (expires in ${minutes}m)\n`);
  }

  if (!activeTransporter) {
    return { stubbed: true };
  }

  await activeTransporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: template.subject,
    html,
  });

  return { stubbed: false };
};

// ---------- Leave-request notifications ----------

const formatDateShort = (date) =>
  new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const buildLeaveEmailHtml = ({ heading, intro, detailsRows, footerNote }) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">${heading}</h2>
    <p>${intro}</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      ${detailsRows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 140px; vertical-align: top;">${label}</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${value}</td>
        </tr>`
        )
        .join("")}
    </table>
    ${footerNote ? `<p style="color: #6b7280; font-size: 13px;">${footerNote}</p>` : ""}
    <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Aakrin Leave Management</p>
  </div>
`;

// Generic sender shared by all leave-notification emails - same stub-mode /
// real-transport behavior as sendOtpEmail, just without an OTP payload.
const sendMail = async ({ to, subject, html, logLabel }) => {
  const activeTransporter = getTransporter();

  if (env.NODE_ENV !== "production") {
    console.log(`\n[MAIL] To: ${to} | ${logLabel || subject}\n`);
  }

  if (!activeTransporter) {
    return { stubbed: true };
  }

  await activeTransporter.sendMail({ from: env.MAIL_FROM, to, subject, html });

  return { stubbed: false };
};

const sendLeaveSubmittedEmail = async ({
  to,
  managerFirstName,
  employeeName,
  leaveName,
  startDate,
  endDate,
  totalDays,
  reason,
}) => {
  const html = buildLeaveEmailHtml({
    heading: "New leave request",
    intro: `Hi ${managerFirstName || "there"}, ${employeeName} has submitted a leave request for your review.`,
    detailsRows: [
      ["Leave type", leaveName],
      ["Dates", `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`],
      ["Days", String(totalDays)],
      ["Reason", reason],
    ],
    footerNote: "Log in to Aakrin Leave Management to approve or decline this request.",
  });

  return sendMail({
    to,
    subject: `Leave request from ${employeeName}`,
    html,
    logLabel: `Leave request submitted by ${employeeName}`,
  });
};

// Sent as a backup/FYI notice to the recipient's own manager when the
// recipient currently has an approved leave covering today - the recipient
// stays the approver on record, this is just so the request doesn't sit
// unseen while they're away.
const sendManagerOnLeaveNoticeEmail = async ({
  to,
  escalationManagerFirstName,
  employeeName,
  recipientName,
  leaveName,
  startDate,
  endDate,
  totalDays,
  reason,
}) => {
  const html = buildLeaveEmailHtml({
    heading: "Leave request - manager currently on leave",
    intro: `Hi ${escalationManagerFirstName || "there"}, ${employeeName} submitted a leave request to ${recipientName}, who is currently on approved leave. You're being notified as a backup in case this needs attention.`,
    detailsRows: [
      ["Leave type", leaveName],
      ["Dates", `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`],
      ["Days", String(totalDays)],
      ["Reason", reason],
      ["Sent to", recipientName],
    ],
    footerNote: `${recipientName} is still the approver on record for this request.`,
  });

  return sendMail({
    to,
    subject: `${employeeName}'s leave request - ${recipientName} is on leave`,
    html,
    logLabel: `Backup notice: ${recipientName} on leave, request from ${employeeName}`,
  });
};

const sendLeaveDecisionEmail = async ({
  to,
  employeeFirstName,
  leaveName,
  startDate,
  endDate,
  totalDays,
  status,
  managerName,
  remarks,
}) => {
  const isApproved = status === "APPROVED";
  const html = buildLeaveEmailHtml({
    heading: isApproved ? "Leave request approved" : "Leave request declined",
    intro: `Hi ${employeeFirstName || "there"}, your leave request has been ${
      isApproved ? "approved" : "declined"
    } by ${managerName}.`,
    detailsRows: [
      ["Leave type", leaveName],
      ["Dates", `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`],
      ["Days", String(totalDays)],
      ...(remarks ? [["Remarks", remarks]] : []),
    ],
  });

  return sendMail({
    to,
    subject: `Your leave request was ${isApproved ? "approved" : "declined"}`,
    html,
    logLabel: `Leave ${status} for ${employeeFirstName}`,
  });
};

const sendLeaveCancelledEmail = async ({ to, managerFirstName, employeeName, leaveName, startDate, endDate }) => {
  const html = buildLeaveEmailHtml({
    heading: "Leave request cancelled",
    intro: `Hi ${managerFirstName || "there"}, ${employeeName} has cancelled their pending leave request.`,
    detailsRows: [
      ["Leave type", leaveName],
      ["Dates", `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`],
    ],
  });

  return sendMail({
    to,
    subject: `${employeeName} cancelled a leave request`,
    html,
    logLabel: `Leave cancelled by ${employeeName}`,
  });
};

// ---------- Birthday notifications ----------

const buildSimpleEmailHtml = ({ heading, intro, footerNote }) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="margin-bottom: 8px;">${heading}</h2>
    <p>${intro}</p>
    ${footerNote ? `<p style="color: #6b7280; font-size: 13px;">${footerNote}</p>` : ""}
    <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Aakrin Leave Management</p>
  </div>
`;

const sendBirthdayEmployeeEmail = async ({ to, firstName }) => {
  const html = buildSimpleEmailHtml({
    heading: "🎉 Happy Birthday!",
    intro: `Hi ${firstName}, wishing you a very happy birthday! Have a great day.`,
  });

  return sendMail({
    to,
    subject: `Happy Birthday, ${firstName}!`,
    html,
    logLabel: `Birthday wishes for ${firstName}`,
  });
};

const sendBirthdayManagerNoticeEmail = async ({ to, managerFirstName, employeeName }) => {
  const html = buildSimpleEmailHtml({
    heading: "🎂 Team birthday today",
    intro: `Hi ${managerFirstName || "there"}, today is ${employeeName}'s birthday - might be a nice moment to wish them well.`,
  });

  return sendMail({
    to,
    subject: `Today is ${employeeName}'s birthday`,
    html,
    logLabel: `Birthday notice: ${employeeName} to manager`,
  });
};

// Broadcast version of the birthday notice, sent to every active account
// instead of just a manager - used when the birthday person is an Admin,
// since Admins typically have no manager to notify.
const sendAdminBirthdayBroadcastEmail = async ({ to, recipientFirstName, adminName }) => {
  const html = buildSimpleEmailHtml({
    heading: "🎂 It's your admin's birthday!",
    intro: `Hi ${recipientFirstName || "there"}, today is ${adminName}'s birthday - your admin! Might be a nice moment to wish them well.`,
  });

  return sendMail({
    to,
    subject: `Today is ${adminName}'s birthday`,
    html,
    logLabel: `Admin birthday broadcast: ${adminName} to ${to}`,
  });
};

// ---------- Timesheet notifications ----------

const sendTimesheetSubmittedEmail = async ({ to, recipientFirstName, employeeName, weekStartDate, weekEndDate, totalHours }) => {
  const html = buildLeaveEmailHtml({
    heading: "Timesheet submitted",
    intro: `Hi ${recipientFirstName || "there"}, ${employeeName} submitted their timesheet for the week of ${formatDateShort(weekStartDate)} – ${formatDateShort(weekEndDate)}.`,
    detailsRows: [
      ["Week", `${formatDateShort(weekStartDate)} – ${formatDateShort(weekEndDate)}`],
      ["Total hours", String(totalHours)],
    ],
    footerNote: "Log in to Aakrin Leave Management to review it.",
  });

  return sendMail({
    to,
    subject: `${employeeName}'s timesheet for the week of ${formatDateShort(weekStartDate)}`,
    html,
    logLabel: `Timesheet submitted by ${employeeName} to ${to}`,
  });
};

const sendTimesheetDecisionEmail = async ({
  to,
  employeeFirstName,
  weekStartDate,
  weekEndDate,
  totalHours,
  status,
  managerName,
  remarks,
}) => {
  const isApproved = status === "APPROVED";
  const html = buildLeaveEmailHtml({
    heading: isApproved ? "Timesheet approved" : "Timesheet declined",
    intro: `Hi ${employeeFirstName || "there"}, your timesheet for the week of ${formatDateShort(weekStartDate)} – ${formatDateShort(weekEndDate)} has been ${
      isApproved ? "approved" : "declined"
    } by ${managerName}.`,
    detailsRows: [
      ["Week", `${formatDateShort(weekStartDate)} – ${formatDateShort(weekEndDate)}`],
      ["Total hours", String(totalHours)],
      ...(remarks ? [["Remarks", remarks]] : []),
    ],
  });

  return sendMail({
    to,
    subject: `Your timesheet was ${isApproved ? "approved" : "declined"}`,
    html,
    logLabel: `Timesheet ${status} for ${employeeFirstName}`,
  });
};

module.exports = {
  sendOtpEmail,
  isRealMailConfigured,
  sendLeaveSubmittedEmail,
  sendManagerOnLeaveNoticeEmail,
  sendLeaveDecisionEmail,
  sendLeaveCancelledEmail,
  sendBirthdayEmployeeEmail,
  sendBirthdayManagerNoticeEmail,
  sendAdminBirthdayBroadcastEmail,
  sendTimesheetSubmittedEmail,
  sendTimesheetDecisionEmail,
};
