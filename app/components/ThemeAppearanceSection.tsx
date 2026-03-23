"use client";

import { ChangeEvent } from "react";

import { CardState, cardThemes, ThemeColorField } from "../card-builder";

type ThemeAppearanceSectionProps = {
  card: CardState;
  selectedThemeId: string;
  isColorControlsOpen: boolean;
  onThemeChange: (themeId: string) => void;
  onToggleColorControls: () => void;
  onColorFieldChange: (
    key: ThemeColorField,
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ThemeAppearanceSection({
  card,
  selectedThemeId,
  isColorControlsOpen,
  onThemeChange,
  onToggleColorControls,
  onColorFieldChange,
}: ThemeAppearanceSectionProps) {
  return (
    <>
      <div className="space-y-3 xl:col-span-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="theme">
          Theme preset
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-55">
            <select
              id="theme"
              value={selectedThemeId}
              onChange={(event) => {
                onThemeChange(event.target.value);
              }}
              className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pe-10 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
            >
              {selectedThemeId === "" && <option value="">Custom</option>}
              {cardThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-slate-300"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleColorControls}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-base text-slate-300 transition hover:border-cyan-300 hover:text-slate-100"
            aria-label="Toggle theme color controls"
            aria-expanded={isColorControlsOpen}
            aria-controls="theme-color-controls"
          >
            {isColorControlsOpen ? "▾" : "▸"}
          </button>
        </div>
      </div>

      <div className="space-y-3 xl:col-span-2">
        {isColorControlsOpen && (
          <div id="theme-color-controls" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Card color
                <input
                  type="color"
                  value={card.cardBackground}
                  onChange={onColorFieldChange("cardBackground")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Art background
                <input
                  type="color"
                  value={card.artBackground}
                  onChange={onColorFieldChange("artBackground")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Panel color
                <input
                  type="color"
                  value={card.panelBackground}
                  onChange={onColorFieldChange("panelBackground")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Frame accent
                <input
                  type="color"
                  value={card.frameAccent}
                  onChange={onColorFieldChange("frameAccent")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Title text
                <input
                  type="color"
                  value={card.titleColor}
                  onChange={onColorFieldChange("titleColor")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-200">
                Body text
                <input
                  type="color"
                  value={card.bodyTextColor}
                  onChange={onColorFieldChange("bodyTextColor")}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
