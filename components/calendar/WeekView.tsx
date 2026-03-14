"use client";

import { useState } from "react";
import { useScheduleStore, type WeekDay, type TimeBlock } from "@/store/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS: { key: WeekDay; label: string }[] = [
  { key: "M",  label: "Mon" },
  { key: "Tu", label: "Tue" },
  { key: "W",  label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "F",  label: "Fri" },
];

const START_HOUR = 8;   // 8 AM
const END_HOUR   = 22;  // 10 PM
const SLOT_MINS  = 30;
const SLOT_PX    = 40;

const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINS;
const TOTAL_PX    = TOTAL_SLOTS * SLOT_PX;

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Convert military int (e.g. 1030) → minutes since START_HOUR */
function militaryToOffset(mil: number): number {
  const h = Math.floor(mil / 100);
  const m = mil % 100;
  return (h - START_HOUR) * 60 + m;
}

function offsetToPx(offsetMins: number): number {
  return (offsetMins / SLOT_MINS) * SLOT_PX;
}

function militaryToLabel(mil: number): string {
  const h = Math.floor(mil / 100);
  const m = mil % 100;
  const period = h >= 12 ? "pm" : "am";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${String(m).padStart(2, "0")}${period}`;
}

/** Snap a clientY click within a column element to the nearest 30-min military slot */
function yToMilitary(offsetY: number): number {
  const slotIndex = Math.floor(offsetY / SLOT_PX);
  const clampedSlot = Math.max(0, Math.min(slotIndex, TOTAL_SLOTS - 1));
  const totalMins = START_HOUR * 60 + clampedSlot * SLOT_MINS;
  return Math.floor(totalMins / 100) * 100 + (totalMins % 60);
}

/** Build the list of hour labels (8am … 9pm) */
function hourLabels(): { mil: number; label: string }[] {
  const labels = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const mil = h * 100;
    labels.push({ mil, label: militaryToLabel(mil) });
  }
  return labels;
}

/** Generate selectable time options every 30 min */
function timeOptions(): { value: number; label: string }[] {
  const opts = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    opts.push({ value: h * 100,      label: militaryToLabel(h * 100) });
    opts.push({ value: h * 100 + 30, label: militaryToLabel(h * 100 + 30) });
  }
  return opts;
}

const TIME_OPTIONS = timeOptions();

// ── Block component ───────────────────────────────────────────────────────────

function BlockTile({ block, onRemove }: { block: TimeBlock; onRemove: () => void }) {
  const top    = offsetToPx(militaryToOffset(block.start));
  const height = offsetToPx(militaryToOffset(block.end) - militaryToOffset(block.start));

  return (
    <div
      className="absolute inset-x-0.5 rounded px-1.5 py-0.5 text-white text-[10px] leading-tight cursor-pointer select-none overflow-hidden group"
      style={{ top, height, backgroundColor: block.color, minHeight: SLOT_PX }}
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      title="Click to remove"
    >
      <span className="font-medium block truncate">{block.label}</span>
      <span className="opacity-75">
        {militaryToLabel(block.start)}–{militaryToLabel(block.end)}
      </span>
      <span className="absolute top-0.5 right-1 hidden group-hover:block opacity-75 text-xs">✕</span>
    </div>
  );
}

// ── Creation dialog ───────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  defaultDay: WeekDay;
  defaultStart: number;
  onClose: () => void;
}

function CreateDialog({ open, defaultDay, defaultStart, onClose }: CreateDialogProps) {
  const addBlock = useScheduleStore((s) => s.addBlock);
  const defaultEnd = defaultStart + 100 <= 2200 ? defaultStart + 100 : defaultStart + 30;

  const [label, setLabel] = useState("");
  const [day,   setDay]   = useState<WeekDay>(defaultDay);
  const [start, setStart] = useState(defaultStart);
  const [end,   setEnd]   = useState(defaultEnd);
  const [color, setColor] = useState(COLORS[0]);

  function handleSave() {
    if (!label.trim() || end <= start) return;
    addBlock({ label: label.trim(), day, start, end, color });
    setLabel("");
    onClose();
  }

  // Reset state when dialog opens with new defaults
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      setDay(defaultDay);
      setStart(defaultStart);
      setEnd(defaultEnd);
      setLabel("");
      setColor(COLORS[0]);
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Add time block</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Label */}
          <Input
            placeholder="Label (e.g. Gym, Study)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="h-8 text-sm"
          />

          {/* Day */}
          <div className="flex gap-1">
            {DAYS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDay(d.key)}
                className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                  day === d.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Start / End */}
          <div className="flex items-center gap-2">
            <select
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">to</span>
            <select
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {TIME_OPTIONS.filter((o) => o.value > start).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!label.trim() || end <= start}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── WeekView ──────────────────────────────────────────────────────────────────

export function WeekView() {
  const { blocks, removeBlock } = useScheduleStore();
  const [dialog, setDialog] = useState<{ day: WeekDay; start: number } | null>(null);

  function handleColumnClick(day: WeekDay, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const start = yToMilitary(offsetY);
    setDialog({ day, start });
  }

  const labels = hourLabels();

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Day headers */}
        <div className="flex shrink-0 border-b border-border">
          <div className="w-12 shrink-0" /> {/* time gutter */}
          {DAYS.map((d) => (
            <div key={d.key} className="flex-1 py-2 text-center text-xs font-medium text-muted-foreground">
              {d.label}
            </div>
          ))}
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex" style={{ height: TOTAL_PX }}>
            {/* Hour labels */}
            <div className="w-12 shrink-0 relative">
              {labels.map(({ mil, label }) => (
                <div
                  key={mil}
                  className="absolute right-2 text-[10px] text-muted-foreground -translate-y-2"
                  style={{ top: offsetToPx(militaryToOffset(mil)) }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((d) => {
              const dayBlocks = Object.values(blocks).filter((b) => b.day === d.key);
              return (
                <div
                  key={d.key}
                  className="flex-1 relative border-l border-border cursor-crosshair"
                  style={{ height: TOTAL_PX }}
                  onClick={(e) => handleColumnClick(d.key, e)}
                >
                  {/* Hour grid lines */}
                  {labels.map(({ mil }) => (
                    <div
                      key={mil}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{ top: offsetToPx(militaryToOffset(mil)) }}
                    />
                  ))}
                  {/* Half-hour lines */}
                  {labels.map(({ mil }) => (
                    <div
                      key={`${mil}-half`}
                      className="absolute inset-x-0 border-t border-border/25"
                      style={{ top: offsetToPx(militaryToOffset(mil)) + SLOT_PX }}
                    />
                  ))}

                  {/* Time blocks */}
                  {dayBlocks.map((block) => (
                    <BlockTile
                      key={block.id}
                      block={block}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dialog && (
        <CreateDialog
          open
          defaultDay={dialog.day}
          defaultStart={dialog.start}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
