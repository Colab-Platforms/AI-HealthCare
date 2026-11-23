/**
 * Permission matrix (source: the three Take Health admin PDFs, section 9.3).
 * Levels: VIEW, CREATE, EDIT, REQUEST, APPROVE, DELETE. A missing entry means RESTRICTED.
 * Roles: admin (daily ops), takeadmin (growth/analytics), superadmin (control).
 */
const MATRIX = {
  dashboard:        { admin: ['VIEW'], takeadmin: ['VIEW'], superadmin: ['VIEW'] },
  users:            { admin: ['VIEW', 'REQUEST'], takeadmin: ['VIEW', 'REQUEST'], superadmin: ['VIEW', 'EDIT', 'DELETE'] },
  health_profiles:  { admin: ['VIEW', 'REQUEST'], takeadmin: ['VIEW'], superadmin: ['VIEW', 'APPROVE'] },
  medical_records:  { admin: ['VIEW', 'REQUEST'], takeadmin: ['VIEW'], superadmin: ['VIEW', 'APPROVE'] },
  user_analytics:   { admin: ['VIEW'], takeadmin: ['VIEW'], superadmin: ['VIEW'] },
  marketing:        { takeadmin: ['VIEW', 'CREATE', 'REQUEST'], superadmin: ['VIEW', 'APPROVE'] },
  regional:         { admin: ['VIEW'], takeadmin: ['VIEW', 'CREATE'], superadmin: ['VIEW', 'EDIT', 'APPROVE'] },
  food_database:    { admin: ['VIEW', 'REQUEST'], takeadmin: ['VIEW', 'CREATE', 'REQUEST'], superadmin: ['VIEW', 'EDIT', 'DELETE', 'APPROVE'] },
  diet_plans:       { admin: ['VIEW'], takeadmin: ['VIEW', 'REQUEST'], superadmin: ['VIEW', 'APPROVE'] },
  notifications:    { admin: ['CREATE', 'REQUEST'], takeadmin: ['CREATE', 'REQUEST'], superadmin: ['CREATE', 'APPROVE'] },
  support_tickets:  { admin: ['VIEW', 'EDIT'], takeadmin: ['VIEW', 'EDIT'], superadmin: ['VIEW', 'EDIT'] },
  admin_management: { superadmin: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  role_management:  { superadmin: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  ai_configuration: { admin: ['VIEW'], takeadmin: ['VIEW', 'REQUEST'], superadmin: ['VIEW', 'EDIT', 'APPROVE'] },
  data_export:      { admin: ['REQUEST'], takeadmin: ['REQUEST'], superadmin: ['VIEW', 'APPROVE'] },
  audit_logs:       { admin: ['VIEW'], takeadmin: ['VIEW'], superadmin: ['VIEW'] },
  approvals:        { admin: ['CREATE', 'VIEW'], takeadmin: ['CREATE', 'VIEW'], superadmin: ['VIEW', 'APPROVE'] },
  system_config:    { superadmin: ['VIEW', 'EDIT'] },
};

// Actions that are always high risk (need a second, different superadmin to confirm).
const HIGH_RISK_ACTIONS = [
  { module: 'users', action: 'delete' },
  { module: 'admin_management', action: '*' },
  { module: 'role_management', action: '*' },
  { module: 'system_config', action: '*' },
  { module: 'food_database', action: 'delete' },
  { module: 'ai_configuration', action: '*' },
];

const can = (role, module, level) => !!MATRIX[module]?.[role]?.includes(level);
const isHighRisk = (module, action) =>
  HIGH_RISK_ACTIONS.some((r) => r.module === module && (r.action === '*' || r.action === action));

module.exports = { MATRIX, can, isHighRisk };
