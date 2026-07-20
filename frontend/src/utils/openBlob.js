// Opens a downloaded blob (e.g. a leave attachment) in a new tab. Revokes the
// object URL shortly after so we don't leak memory across repeated views.
export const openBlobInNewTab = (blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Triggers an actual "Save As" download (e.g. a CSV export) rather than
// opening inline, via a temporary anchor with the `download` attribute.
export const downloadBlobAsFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Pulls the filename the backend chose out of a Content-Disposition header,
// so the downloaded file matches what the server named it.
export const getFilenameFromResponse = (response, fallback) => {
  const header = response.headers?.["content-disposition"] || "";
  const match = header.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
};
