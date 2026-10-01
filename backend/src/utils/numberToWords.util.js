const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

const threeDigitsToWords = (num) => {
  let words = "";
  if (num >= 100) {
    words += `${ONES[Math.floor(num / 100)]} Hundred`;
    num %= 100;
    if (num > 0) words += " ";
  }
  if (num >= 20) {
    words += TENS[Math.floor(num / 10)];
    if (num % 10 > 0) words += ` ${ONES[num % 10]}`;
  } else if (num > 0) {
    words += ONES[num];
  }
  return words;
};

// Indian numbering system (Crore/Lakh/Thousand), matching how Indian invoices
// conventionally spell out amounts.
const integerToIndianWords = (num) => {
  if (num === 0) return "Zero";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;

  const parts = [];
  if (crore > 0) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigitsToWords(rest));

  return parts.join(" ");
};

// e.g. 118000.50 -> "Rupees One Lakh Eighteen Thousand and Fifty Paise Only"
const amountInWordsInr = (value) => {
  const rounded = Math.round((value || 0) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let words = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise > 0) {
    words += ` and ${threeDigitsToWords(paise)} Paise`;
  }
  return `${words} Only`;
};

module.exports = { amountInWordsInr };
