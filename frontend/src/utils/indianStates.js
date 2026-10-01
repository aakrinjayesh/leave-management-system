// Indian states + union territories - used for the client "State" dropdown
// on Project client details, and drives the invoice's GST place-of-supply
// (same state as the company, Karnataka = CGST+SGST, otherwise IGST).
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// The company's own registered state - matched (case-insensitively) against
// a client's state to decide CGST+SGST vs IGST on generated invoices. Kept
// here too so the frontend can show a live "Place of Supply" hint without a
// round trip - the backend independently recomputes the real tax figures.
export const COMPANY_HOME_STATE = "Karnataka";
