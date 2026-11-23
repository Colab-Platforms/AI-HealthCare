const maskEmail = (e) => {
  if (!e || !e.includes('@')) return e;
  const [u, d] = e.split('@');
  return u.slice(0, 2) + '*'.repeat(Math.max(u.length - 2, 1)) + '@' + d;
};
const maskPhone = (p) => (p ? String(p).replace(/\d(?=\d{2})/g, '*') : p);

/** Mask contact details unless the viewer is a superadmin (the caller must log that reveal). */
const maskUser = (u, role) => {
  if (!u) return u;
  const o = typeof u.toObject === 'function' ? u.toObject() : { ...u };
  delete o.password;
  if (role === 'superadmin') return o;
  if (o.email) o.email = maskEmail(o.email);
  if (o.phone) o.phone = maskPhone(o.phone);
  if (o.phoneNumber) o.phoneNumber = maskPhone(o.phoneNumber);
  return o;
};

module.exports = { maskUser, maskEmail, maskPhone };
