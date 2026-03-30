"use client";

import {
  PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CardState, defaultCard } from "../card-builder";

type CardPreviewProps = {
  card: CardState;
  artImage: string | null;
  onArtOffsetChange?: (x: number, y: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CardPreview({
  card,
  artImage,
  onArtOffsetChange,
}: CardPreviewProps) {
  const cardBase = card.cardBackground || defaultCard.cardBackground;
  const panelBase = card.panelBackground || defaultCard.panelBackground;
  const artFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDraggingArt, setIsDraggingArt] = useState(false);
  const canDragArt = Boolean(artImage && onArtOffsetChange);
  const descriptionVerticalAlign: Record<
    CardState["descriptionPosition"],
    string
  > = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
  };

  const handleArtPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDragArt || !onArtOffsetChange) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startOffsetX: card.artOffsetX,
      startOffsetY: card.artOffsetY,
    };
    setIsDraggingArt(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleArtPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDragArt || !onArtOffsetChange || !dragStateRef.current) {
      return;
    }

    if (event.pointerId !== dragStateRef.current.pointerId) {
      return;
    }

    const frame = artFrameRef.current;
    if (!frame) {
      return;
    }

    const { width, height } = frame.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    const deltaXPercent =
      ((event.clientX - dragStateRef.current.startPointerX) / width) * 100;
    const deltaYPercent =
      ((event.clientY - dragStateRef.current.startPointerY) / height) * 100;

    onArtOffsetChange(
      clamp(dragStateRef.current.startOffsetX + deltaXPercent, 0, 100),
      clamp(dragStateRef.current.startOffsetY + deltaYPercent, 0, 100),
    );
  };

  const handleArtPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !dragStateRef.current ||
      event.pointerId !== dragStateRef.current.pointerId
    ) {
      return;
    }

    dragStateRef.current = null;
    setIsDraggingArt(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <article
      className="relative h-112 w-[320px] shrink-0 rounded-[28px] border-8 border-black p-2 shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:h-126 sm:w-90 lg:h-136.5 lg:w-97.5"
      style={{
        backgroundColor: cardBase,
        backgroundImage: `linear-gradient(170deg, ${cardBase}, rgba(0,0,0,0.85))`,
      }}
    >
      <div
        className="relative flex h-full flex-col gap-2 overflow-hidden rounded-[20px] border-2 p-3"
        style={{
          borderColor: card.frameAccent,
          backgroundColor: cardBase,
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25))",
        }}
      >
        <header
          className="flex h-10 shrink-0 items-center justify-between rounded-xl border-2 px-3 py-1 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.06)]"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: panelBase,
          }}
        >
          <h1
            className="min-w-0 truncate text-lg font-semibold tracking-wide"
            style={{ color: card.titleColor }}
          >
            {card.title || "Untitled"}
          </h1>
          <span
            className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm"
            style={{
              borderColor: card.frameAccent,
              color: card.titleColor,
              backgroundColor: "rgba(0, 0, 0, 0.35)",
            }}
          >
            {card.icon || "★"}
          </span>
        </header>

        <div
          ref={artFrameRef}
          className="relative min-h-0 flex-[0_0_45%] overflow-hidden rounded-xl border-2"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: card.artBackground,
            touchAction: canDragArt ? "none" : "auto",
            cursor: canDragArt ? "pointer" : "default",
          }}
          onPointerDown={handleArtPointerDown}
          onPointerMove={handleArtPointerMove}
          onPointerUp={handleArtPointerUp}
          onPointerCancel={handleArtPointerUp}
          onDragStart={(event) => {
            event.preventDefault();
          }}
        >
          {artImage ? (
            <img
              src={artImage}
              alt="Card art"
              className={
                isDraggingArt
                  ? "pointer-events-none select-none object-cover"
                  : "select-none object-cover"
              }
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectPosition: `${card.artOffsetX}% ${card.artOffsetY}%`,
              }}
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-8xl opacity-70">{card.icon || "★"}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        <div
          className="relative min-h-0 flex-1 rounded-xl border-2 p-4"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: panelBase,
            backgroundImage:
              "linear-gradient(155deg, rgba(255,255,255,0.08), rgba(0,0,0,0.15))",
          }}
        >
          <div
            className="flex h-full flex-col overflow-y-auto"
            style={{
              justifyContent:
                descriptionVerticalAlign[card.descriptionPosition],
            }}
          >
            <p
              className="w-full whitespace-pre-wrap text-lg leading-relaxed"
              style={{
                color: card.bodyTextColor,
                textAlign: card.descriptionAlign,
              }}
            >
              {card.description || "Add your card description here."}
            </p>
          </div>
        </div>

        <footer
          className="grid h-10 shrink-0 grid-cols-3 rounded-xl border-2 px-4 py-1 text-2xl font-semibold"
          style={{
            borderColor: card.frameAccent,
            backgroundColor: panelBase,
            color: card.titleColor,
          }}
        >
          <span>{card.footerLeft}</span>
          <span className="text-center">{card.footerCenter}</span>
          <span className="text-right">{card.footerRight}</span>
        </footer>
      </div>
    </article>
  );
}

export function StaticCardPreview({
  card,
  artImage,
}: {
  card: CardState;
  artImage: string | null;
}) {
  const cardBase = card.cardBackground || defaultCard.cardBackground;
  const panelBase = card.panelBackground || defaultCard.panelBackground;
  const descriptionContainerRef = useRef<HTMLDivElement | null>(null);
  const descriptionTextRef = useRef<HTMLParagraphElement | null>(null);
  const [descriptionFontSize, setDescriptionFontSize] = useState(18);
  const descriptionVerticalAlign: Record<
    CardState["descriptionPosition"],
    string
  > = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end",
  };

  useLayoutEffect(() => {
    const container = descriptionContainerRef.current;
    const text = descriptionTextRef.current;

    if (!container || !text) {
      return;
    }

    let nextSize = 18;
    text.style.fontSize = `${nextSize}px`;

    while (
      nextSize > 12 &&
      container.scrollHeight > container.clientHeight + 1
    ) {
      nextSize -= 0.5;
      text.style.fontSize = `${nextSize}px`;
    }

    setDescriptionFontSize(nextSize);
  }, [card.description, card.descriptionAlign, card.descriptionPosition]);

  return (
    <article
      style={{
        position: "relative",
        width: 320,
        height: 448,
        flexShrink: 0,
        border: "8px solid black",
        padding: 8,
        boxSizing: "border-box",
        backgroundColor: cardBase,
        backgroundImage: `linear-gradient(170deg, ${cardBase}, rgba(0,0,0,0.85))`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          flexDirection: "column",
          gap: 8,
          overflow: "hidden",
          borderRadius: 20,
          border: `2px solid ${card.frameAccent}`,
          padding: 12,
          boxSizing: "border-box",
          backgroundColor: cardBase,
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25))",
        }}
      >
        <header
          style={{
            display: "flex",
            height: 40,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 12,
            border: `2px solid ${card.frameAccent}`,
            padding: "4px 12px",
            boxSizing: "border-box",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.06)",
            backgroundColor: panelBase,
          }}
        >
          <h1
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.025em",
              color: card.titleColor,
            }}
          >
            {card.title || "Untitled"}
          </h1>
          <span
            style={{
              marginLeft: 8,
              display: "inline-flex",
              height: 28,
              width: 28,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: `1px solid ${card.frameAccent}`,
              fontSize: 14,
              color: card.titleColor,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            {card.icon || "★"}
          </span>
        </header>

        <div
          style={{
            position: "relative",
            minHeight: 0,
            flex: "0 0 45%",
            overflow: "hidden",
            borderRadius: 12,
            border: `2px solid ${card.frameAccent}`,
            backgroundColor: card.artBackground,
          }}
        >
          {artImage ? (
            <img
              src={artImage}
              alt="Card art"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${card.artOffsetX}% ${card.artOffsetY}%`,
                userSelect: "none",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 96, opacity: 0.7 }}>
                {card.icon || "★"}
              </span>
            </div>
          )}
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            minHeight: 0,
            flex: 1,
            borderRadius: 12,
            border: `2px solid ${card.frameAccent}`,
            padding: 16,
            boxSizing: "border-box",
            backgroundColor: panelBase,
            backgroundImage:
              "linear-gradient(155deg, rgba(255,255,255,0.08), rgba(0,0,0,0.15))",
          }}
        >
          <div
            ref={descriptionContainerRef}
            style={{
              display: "flex",
              height: "100%",
              flexDirection: "column",
              overflow: "hidden",
              justifyContent:
                descriptionVerticalAlign[card.descriptionPosition],
            }}
          >
            <p
              ref={descriptionTextRef}
              style={{
                width: "100%",
                whiteSpace: "pre-wrap",
                fontSize: descriptionFontSize,
                lineHeight: "1.625",
                color: card.bodyTextColor,
                textAlign: card.descriptionAlign,
              }}
            >
              {card.description || "Add your card description here."}
            </p>
          </div>
        </div>

        <footer
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            height: 40,
            flexShrink: 0,
            borderRadius: 12,
            border: `2px solid ${card.frameAccent}`,
            padding: "4px 16px",
            boxSizing: "border-box",
            fontSize: 24,
            fontWeight: 600,
            backgroundColor: panelBase,
            color: card.titleColor,
          }}
        >
          <span>{card.footerLeft}</span>
          <span style={{ textAlign: "center" }}>{card.footerCenter}</span>
          <span style={{ textAlign: "right" }}>{card.footerRight}</span>
        </footer>
      </div>
    </article>
  );
}

export function HiddenCardSlot() {
  return (
    <div
      style={{
        width: 320,
        height: 448,
        flexShrink: 0,
        borderRadius: 28,
        border: "8px solid black",
        padding: 8,
        boxSizing: "border-box",
        backgroundColor: "#0b1020",
        backgroundImage: "linear-gradient(170deg, #0b1020, rgba(0,0,0,0.85))",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          overflow: "hidden",
          borderRadius: 20,
          border: "2px solid #4fa2ff",
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25))",
        }}
      >
        <span style={{ fontSize: 72, opacity: 0.6 }}>🂠</span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#eff6ff",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Hidden Card
        </span>
      </div>
    </div>
  );
}
