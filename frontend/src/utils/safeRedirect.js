// Validates a `?redirect=` value from an external link (an email button,
// specifically) before ever handing it to navigate() - only a same-origin
// relative path is accepted. Rejects anything that could turn this into an
// open redirect (a full URL, a scheme-relative "//evil.com", etc).
export const getSafeRedirectPath = (value) => {
  if (typeof value !== "string" || !value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
};
