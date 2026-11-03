import { Navigate, Route, Routes } from 'react-router-dom';
import VaultHome from './vault/VaultHome';
import FolderDetail from './vault/FolderDetail';
import ReportPreview from './vault/ReportPreview';
import VaultTimeline from './vault/VaultTimeline';

/**
 * Medical Vault (web test UI for /api/v1/vault). Mirrors the mobile app flow:
 * vault home -> folder -> report preview, plus the global timeline.
 * Mounted at /medical-vault/* in PrivateApp.
 */
export default function MedicalVault() {
  return (
    <Routes>
      <Route index element={<VaultHome />} />
      <Route path="timeline" element={<VaultTimeline />} />
      <Route path="folders/:id" element={<FolderDetail />} />
      <Route path="reports/:id" element={<ReportPreview />} />
      <Route path="*" element={<Navigate to="/medical-vault" replace />} />
    </Routes>
  );
}
