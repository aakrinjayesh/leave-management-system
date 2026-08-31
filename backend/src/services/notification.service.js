const prisma = require("../config/prisma");

// Plain strings, not a Prisma enum (matches how the Notification model
// itself stores `type` as a String) - keeps this the single source of truth
// for the type values used across every notification call site.
const NOTIFICATION_TYPES = {
  LEAVE_SUBMITTED: "LEAVE_SUBMITTED",
  LEAVE_DECIDED: "LEAVE_DECIDED",
  LEAVE_CANCELLED: "LEAVE_CANCELLED",
  TIMESHEET_SUBMITTED: "TIMESHEET_SUBMITTED",
  TIMESHEET_DECIDED: "TIMESHEET_DECIDED",
  BIRTHDAY: "BIRTHDAY",
  ANNIVERSARY: "ANNIVERSARY",
  RESIGNATION_SUBMITTED: "RESIGNATION_SUBMITTED",
  RESIGNATION_DECIDED: "RESIGNATION_DECIDED",
  RESIGNATION_WITHDRAWN: "RESIGNATION_WITHDRAWN",
  ADMIN_GRANTED: "ADMIN_GRANTED",
  ADMIN_REMOVED: "ADMIN_REMOVED",
  LEAVE_POLICY_CHANGED: "LEAVE_POLICY_CHANGED",
  SALARY_STRUCTURE_UPDATED: "SALARY_STRUCTURE_UPDATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  ACCOUNT_APPROVAL_REQUESTED: "ACCOUNT_APPROVAL_REQUESTED",
  ACCOUNT_APPROVAL_DECIDED: "ACCOUNT_APPROVAL_DECIDED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  TIMESHEET_MONTH_END_REMINDER: "TIMESHEET_MONTH_END_REMINDER",
  WFH_SUBMITTED: "WFH_SUBMITTED",
  WFH_DECIDED: "WFH_DECIDED",
  PROFILE_CHANGE_REQUESTED: "PROFILE_CHANGE_REQUESTED",
  PROFILE_CHANGE_DECIDED: "PROFILE_CHANGE_DECIDED",
};

const notify = ({ userId, type, title, message, link = null }) =>
  prisma.notification.create({ data: { userId, type, title, message, link } });

// Fans the same notification out to many recipients at once (e.g. a
// company-wide broadcast) - skips the query entirely for an empty list.
const notifyMany = (userIds, { type, title, message, link = null }) => {
  if (!userIds.length) return Promise.resolve();
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, message, link })),
  });
};

const listForUser = (userId, limit = 30) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });

const countUnread = (userId) => prisma.notification.count({ where: { userId, isRead: false } });

const markAsRead = (userId, id) =>
  prisma.notification.updateMany({ where: { id, userId, isRead: false }, data: { isRead: true, readAt: new Date() } });

const markAllAsRead = (userId) =>
  prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });

module.exports = { NOTIFICATION_TYPES, notify, notifyMany, listForUser, countUnread, markAsRead, markAllAsRead };
