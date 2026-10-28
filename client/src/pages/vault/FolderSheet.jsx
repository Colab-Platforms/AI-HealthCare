import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BedDouble } from 'lucide-react';
import { vaultService, errorMessage } from '../../services/vaultService';
import { BottomSheet, Field, GhostButton, PrimaryButton, inputClass } from './ui';
import { PRESET_CATEGORIES, NAVY } from './vaultUtils';

/** New folder (screen 03) and Edit folder (screen 03b). Pass `folder` to edit. */
export default function FolderSheet({ open, onClose, folder, onSaved }) {
  const editing = !!folder;
  const [name, setName] = useState('');
  const [presetKey, setPresetKey] = useState('illness');
  const [custom, setCustom] = useState('');
  const [admitted, setAdmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(folder?.name || '');
    setAdmitted(!!folder?.isAdmitted);
    if (folder?.category?.type === 'custom') {
      setPresetKey('');
      setCustom(folder.category.label);
    } else {
      setPresetKey(folder?.category?.key || 'illness');
      setCustom('');
    }
  }, [open, folder]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Give the folder a name');
    const customLabel = custom.trim();
    const category = customLabel ? { label: customLabel } : presetKey ? { key: presetKey } : null;
    if (!category) return toast.error('Choose a category or type your own');

    setSaving(true);
    try {
      const body = { name: name.trim(), category, isAdmitted: admitted };
      const { folder: saved } = editing
        ? await vaultService.updateFolder(folder.id, body)
        : await vaultService.createFolder(body);
      toast.success(editing ? 'Folder updated' : 'Folder created');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save folder'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit folder' : 'New folder'}>
      <form onSubmit={submit}>
        <Field label="Folder name" hint="Name it after the illness, checkup or person">
          <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Dengue 2026" autoFocus />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_CATEGORIES.map((c) => {
              const active = !custom.trim() && presetKey === c.key;
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => { setPresetKey(c.key); setCustom(''); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${active ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                  style={active ? { background: NAVY } : undefined}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <input
            className={inputClass}
            value={custom}
            maxLength={40}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Or type your own category"
          />
        </Field>

        <label
          className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition mb-5 ${admitted ? 'border-[#2B3F86] bg-indigo-50/60' : 'border-slate-200 bg-slate-50'}`}
        >
          <input type="checkbox" checked={admitted} onChange={(e) => setAdmitted(e.target.checked)} className="mt-1 w-4 h-4 accent-[#2B3F86]" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-[#14212b]"><BedDouble size={15} /> Patient was admitted to hospital</span>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              The folder will show an “Admitted” tag so you can spot these reports at a glance.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create folder'}</PrimaryButton>
        </div>
      </form>
    </BottomSheet>
  );
}
