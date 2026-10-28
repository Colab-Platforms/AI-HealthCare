import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { vaultService, errorMessage } from '../../services/vaultService';
import ConfirmSheet from './ConfirmSheet';
import { GhostButton } from './ui';

/**
 * Delete a folder. An empty folder is a plain confirmation; a folder with
 * reports asks whether to move them to Unfiled or delete them too.
 */
export default function DeleteFolderFlow({ folder, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => { setReportCount(folder?.stats?.reportCount || 0); }, [folder]);

  const run = async (mode) => {
    setBusy(true);
    try {
      await vaultService.deleteFolder(folder.id, mode);
      toast.success('Folder deleted');
      onDeleted?.(folder);
      onClose();
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.code === 'FOLDER_NOT_EMPTY') {
        setReportCount(err.response.data.reportCount); // stats were stale; ask the user to choose
      } else {
        toast.error(errorMessage(err, 'Could not delete folder'));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!folder) return null;
  const hasReports = reportCount > 0;

  return (
    <ConfirmSheet
      open
      onClose={onClose}
      busy={busy}
      title={`Delete “${folder.name}”?`}
      message={
        hasReports
          ? `This folder has ${reportCount} report${reportCount === 1 ? '' : 's'}. Move them to Unfiled, or delete them too (their public links will stop working).`
          : 'This empty folder will be removed.'
      }
      onConfirm={() => run(undefined)}
    >
      {hasReports && (
        <div className="space-y-2.5">
          <GhostButton className="w-full" disabled={busy} onClick={() => run('move')}>Move reports to Unfiled</GhostButton>
          <button
            disabled={busy}
            onClick={() => run('delete')}
            className="w-full px-4 py-3 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
          >
            Delete folder and its reports
          </button>
          <GhostButton className="w-full" disabled={busy} onClick={onClose}>Cancel</GhostButton>
        </div>
      )}
    </ConfirmSheet>
  );
}
