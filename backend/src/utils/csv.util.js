// Minimal RFC 4180 CSV building - no external dependency needed for
// something this small (a handful of columns, no nested structures).

const CSV_BOM = "﻿";

const escapeCsvField = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

// rows: array of arrays. Prepends a UTF-8 BOM so Excel opens special
// characters (e.g. accented names) correctly.
const buildCsv = (headers, rows) => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
};

const slugify = (text) =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

module.exports = { buildCsv, slugify };
