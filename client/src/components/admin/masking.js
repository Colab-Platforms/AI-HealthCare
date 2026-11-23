// Display-only masking for contact details. The real protection must also happen on the server
// (server/utils/masking.js); this keeps the UI consistent with the permission table in the admin spec.

export const maskEmail = (email) => {
  if (!email || !email.includes("@")) return email || "";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
};

export const maskPhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\d(?=\d{2})/g, "*");
};
