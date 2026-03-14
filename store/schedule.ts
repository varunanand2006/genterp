import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Section } from "@/types/course";

export interface PinnedSection {
  section: Section;
  course_id: string;
  course_title: string;
  semester: string;
}

export type WeekDay = "M" | "Tu" | "W" | "Th" | "F";

export interface TimeBlock {
  id: string;
  label: string;
  day: WeekDay;
  start: number; // military, e.g. 1000
  end: number;   // military, e.g. 1150
  color: string; // hex
}

interface ScheduleStore {
  pinned: Record<string, PinnedSection>; // key: `${section_id}::${semester}`
  pin: (item: PinnedSection) => void;
  unpin: (sectionId: string, semester: string) => void;
  isPinned: (sectionId: string, semester: string) => boolean;

  blocks: Record<string, TimeBlock>; // key: id
  addBlock: (block: Omit<TimeBlock, "id">) => void;
  removeBlock: (id: string) => void;
}

function pinKey(sectionId: string, semester: string) {
  return `${sectionId}::${semester}`;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      pinned: {},

      pin: (item) =>
        set((state) => ({
          pinned: {
            ...state.pinned,
            [pinKey(item.section.section_id, item.semester)]: item,
          },
        })),

      unpin: (sectionId, semester) =>
        set((state) => {
          const next = { ...state.pinned };
          delete next[pinKey(sectionId, semester)];
          return { pinned: next };
        }),

      isPinned: (sectionId, semester) =>
        pinKey(sectionId, semester) in get().pinned,

      blocks: {},

      addBlock: (block) =>
        set((state) => {
          const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return { blocks: { ...state.blocks, [id]: { ...block, id } } };
        }),

      removeBlock: (id) =>
        set((state) => {
          const next = { ...state.blocks };
          delete next[id];
          return { blocks: next };
        }),
    }),
    { name: "genterp-schedule" }
  )
);
