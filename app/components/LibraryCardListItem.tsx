"use client";

import { CardRecord } from "../card-builder";

type LibraryCardListItemProps = {
  entry: CardRecord;
  isExporting: boolean;
  onLoad: (entry: CardRecord) => void;
  onExport: (entry: CardRecord) => void;
  onDelete: (entry: CardRecord) => void;
};

export function LibraryCardListItem({
  entry,
  isExporting,
  onLoad,
  onExport,
  onDelete,
}: LibraryCardListItemProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/90 p-2 transition hover:border-cyan-300">
      <button
        type="button"
        onClick={() => onLoad(entry)}
        className="block w-full text-left"
      >
        <div className="mx-auto h-22 w-16 overflow-hidden rounded-md border border-slate-700 bg-slate-950">
          <div
            className="relative h-full w-full"
            style={{ backgroundColor: entry.card.artBackground }}
          >
            {entry.artImage ? (
              <img
                src={entry.artImage}
                alt={entry.name}
                className="object-cover"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectPosition: `${entry.card.artOffsetX}% ${entry.card.artOffsetY}%`,
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl opacity-70">
                {entry.card.icon || "★"}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-slate-100">
            {entry.name}
          </p>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span>{new Date(entry.updatedAt).toLocaleDateString()}</span>
            <span className="text-slate-600">•</span>
            <span>{entry.card.icon || "★"}</span>
          </div>
        </div>
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onExport(entry)}
          disabled={isExporting}
          className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? "Exporting..." : "PNG"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry)}
          className="rounded-lg border border-rose-500/70 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
