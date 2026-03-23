"use client";

import { ChangeEvent } from "react";

import { CardState, iconSuggestions } from "../card-builder";

type FieldChangeHandler = (
  key: keyof CardState,
) => (
  event: ChangeEvent<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >,
) => void;

type TextAndStatsSectionProps = {
  card: CardState;
  onFieldChange: FieldChangeHandler;
  onIconSuggestion: (icon: string) => void;
  onDescriptionAlignChange: (align: CardState["descriptionAlign"]) => void;
  onDescriptionPositionChange: (
    position: CardState["descriptionPosition"],
  ) => void;
};

export function TextAndStatsSection({
  card,
  onFieldChange,
  onIconSuggestion,
  onDescriptionAlignChange,
  onDescriptionPositionChange,
}: TextAndStatsSectionProps) {
  return (
    <>
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-200" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={card.title}
          onChange={onFieldChange("title")}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-200" htmlFor="icon">
          Icon
        </label>
        <div className="flex gap-3">
          <input
            id="icon"
            value={card.icon}
            onChange={onFieldChange("icon")}
            maxLength={2}
            className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-xl text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          />
          <div className="flex flex-wrap gap-2">
            {iconSuggestions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onIconSuggestion(value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xl transition hover:border-cyan-300"
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 xl:col-span-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Align
            </p>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 p-1">
              <button
                type="button"
                aria-label="Align description left"
                onClick={() => onDescriptionAlignChange("left")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionAlign === "left"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↤
              </button>
              <button
                type="button"
                aria-label="Align description center"
                onClick={() => onDescriptionAlignChange("center")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionAlign === "center"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↔
              </button>
              <button
                type="button"
                aria-label="Align description right"
                onClick={() => onDescriptionAlignChange("right")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionAlign === "right"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↦
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Position
            </p>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 p-1">
              <button
                type="button"
                aria-label="Position description top"
                onClick={() => onDescriptionPositionChange("top")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionPosition === "top"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Position description center"
                onClick={() => onDescriptionPositionChange("center")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionPosition === "center"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↕
              </button>
              <button
                type="button"
                aria-label="Position description bottom"
                onClick={() => onDescriptionPositionChange("bottom")}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  card.descriptionPosition === "bottom"
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <label
          className="text-sm font-medium text-slate-200"
          htmlFor="description"
        >
          Description
        </label>
        <textarea
          id="description"
          value={card.description}
          onChange={onFieldChange("description")}
          rows={5}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 xl:col-span-2">
        <label className="space-y-2 text-sm font-medium text-slate-200">
          Left stat
          <input
            value={card.footerLeft}
            onChange={onFieldChange("footerLeft")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          Center stat
          <input
            value={card.footerCenter}
            onChange={onFieldChange("footerCenter")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          Right stat
          <input
            value={card.footerRight}
            onChange={onFieldChange("footerRight")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          />
        </label>
      </div>
    </>
  );
}
