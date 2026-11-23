import AdminLayout, { TAKE_ADMIN_NAV_GROUPS } from "./AdminLayout";

/** Admin shell with the Take Admin navigation. Kept as its own module so it can be lazy-loaded. */
export default function TakeAdminLayout({ children }) {
  return (
    <AdminLayout navGroups={TAKE_ADMIN_NAV_GROUPS} homePath="/take-admin">
      {children}
    </AdminLayout>
  );
}
