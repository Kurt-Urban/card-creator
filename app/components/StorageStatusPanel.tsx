"use client";

import { useCardBuilderContext } from "./CardBuilderContext";

export function StorageStatusPanel() {
  const { directoryLabel, exportDirectoryLabel, storageMessage } =
    useCardBuilderContext();

  return (
    <div
      className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 text-sm text-slate-300"
      role="status"
      aria-live="polite"
    >
      <p>Folder: {directoryLabel}</p>
      <p>Export PNG folder: {exportDirectoryLabel}</p>
      <p className="mt-1 text-slate-400">{storageMessage}</p>
    </div>
  );
}
