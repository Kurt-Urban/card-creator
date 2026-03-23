"use client";

import { useState } from "react";

type IconManagerSectionProps = {
  icon: string;
  iconSuggestions: string[];
  defaultIcon: string;
  newIconValue: string;
  onIconSelect: (icon: string) => void;
  onNewIconValueChange: (value: string) => void;
  onAddIcon: () => void;
  onRemoveIcon: (icon: string) => void;
  onReorderIcons: (fromIndex: number, toIndex: number) => void;
};

export function IconManagerSection({
  icon,
  iconSuggestions,
  defaultIcon,
  newIconValue,
  onIconSelect,
  onNewIconValueChange,
  onAddIcon,
  onRemoveIcon,
  onReorderIcons,
}: IconManagerSectionProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  return (
    <div className="min-w-[220px]">
      <p className="mb-3 text-sm font-medium text-slate-200">Icon</p>

      <div className="flex flex-wrap gap-2">
        {iconSuggestions.map((value, index) => {
          const isDropTarget = dropIndex === index;
          const isDefault = defaultIcon === value;
          const isSelected = icon === value;

          return (
            <div
              key={`${value}-${index}`}
              className={`group relative inline-flex h-12 w-12 items-center justify-center rounded-lg border bg-slate-950 transition ${
                isSelected
                  ? "border-cyan-300 ring-2 ring-cyan-500/60"
                  : isDropTarget
                    ? "border-cyan-400 ring-2 ring-cyan-500/70"
                    : "border-slate-700"
              }`}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    setDropIndex(index);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    onReorderIcons(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onClick={() => onIconSelect(value)}
                className="flex h-full w-full items-center justify-center rounded-lg text-2xl transition hover:bg-slate-800 active:scale-95"
                title={isDefault ? "Default icon" : "Select icon"}
              >
                {value}
              </button>

              <button
                type="button"
                onClick={() => onRemoveIcon(value)}
                title="Remove icon"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-rose-500/70 bg-slate-900 text-[10px] text-rose-300 opacity-0 transition group-hover:opacity-100"
              >
                🗑
              </button>

              {isDefault && (
                <span className="pointer-events-none absolute -bottom-1 rounded-full bg-cyan-500 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-slate-950">
                  default
                </span>
              )}
            </div>
          );
        })}

        <div className="group relative inline-flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
          <input
            value={newIconValue}
            onChange={(event) => {
              onNewIconValueChange(event.target.value);
            }}
            placeholder="+"
            maxLength={2}
            className="h-full w-full rounded-lg bg-transparent text-center text-xl text-slate-100 outline-none"
          />
          <button
            type="button"
            onClick={onAddIcon}
            title="Add icon"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/70 bg-slate-900 text-xs font-semibold text-cyan-200 opacity-0 transition group-hover:opacity-100"
          >
            +
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Drag icons to reorder. The first icon is used as the folder default.
      </p>
    </div>
  );
}
