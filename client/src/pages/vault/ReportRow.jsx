import React from 'react';
import { Link } from 'react-router-dom';
import { dayParts, fileKind, formatBytes } from './vaultUtils';

export const FileBadge = ({ report }) => (
  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
    {fileKind(report)}
  </span>
);

/** One report. With `showDate` it sits on the timeline gutter (day + month). */
export default function ReportRow({ report, showDate = false, accent = '#94a3b8', meta }) {
  const { day, mon } = dayParts(report.reportDate);
  const card = (
    <Link
      to={`/medical-vault/reports/${report.id}`}
      className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition"
    >
      <FileBadge report={report} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#14212b] truncate">{report.title}</p>
        <p className="text-[11px] text-slate-400 font-medium">
          {meta || `${fileKind(report)} · ${formatBytes(report.file.sizeBytes)}`}
        </p>
      </div>
    </Link>
  );

  if (!showDate) return card;
  return (
    <div className="flex items-stretch gap-3">
      <div className="w-10 shrink-0 text-center pt-3">
        <p className="text-sm font-black text-[#14212b] leading-none">{day}</p>
        <p className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">{mon}</p>
      </div>
      <div className="relative w-3 shrink-0 flex justify-center">
        <span className="absolute inset-y-0 w-px bg-slate-200" />
        <span className="relative mt-[18px] w-2.5 h-2.5 rounded-full border-2 bg-white" style={{ borderColor: accent }} />
      </div>
      {card}
    </div>
  );
}
