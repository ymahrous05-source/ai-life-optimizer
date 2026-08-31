"use client";

// =====================================================================
// TimeBoxTimeline
// Vertical hour-by-hour timeline. Draggable task blocks (@dnd-kit) can
// be reordered/moved between hour slots. The background is washed with
// the user's circadian energy curve, so the instrument itself shows
// *why* a slot is good or bad for a given task at a glance.
// =====================================================================
import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { EnergyLevel } from "../../lib/types";

export interface TimelineTask {
  id: string;
  title: string;
  requiredEnergy: EnergyLevel;
  startHour: number; // 0-23, fractional allowed (e.g. 9.5 = 9:30)
  durationMinutes: number;
  status: "scheduled" | "in_progress" | "completed" | "missed";
}

interface TimeBoxTimelineProps {
  energyCurve: Record<number, EnergyLevel>; // hour -> level, from buildEnergyCurve()
  tasks: TimelineTask[];
  dayStartHour?: number;
  dayEndHour?: number;
  onTaskMove?: (taskId: string, newStartHour: number) => void;
}

const ENERGY_BG: Record<EnergyLevel, string> = {
  peak: "bg-energy-peak/20",
  high: "bg-energy-high/15",
  medium: "bg-energy-medium/10",
  low: "bg-energy-low/15",
  trough: "bg-energy-trough/20",
};

const ENERGY_DOT: Record<EnergyLevel, string> = {
  peak: "bg-energy-peak",
  high: "bg-energy-high",
  medium: "bg-energy-medium",
  low: "bg-energy-low",
  trough: "bg-energy-trough",
};

const HOUR_HEIGHT_PX = 64;

function HourSlot({
  hour,
  energyLevel,
  children,
}: {
  hour: number;
  energyLevel: EnergyLevel;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}` });

  return (
    <div
      ref={setNodeRef}
      className={`relative flex border-b border-deck-line ${ENERGY_BG[energyLevel]} ${
        isOver ? "ring-1 ring-inset ring-energy-peak/60" : ""
      }`}
      style={{ height: HOUR_HEIGHT_PX }}
    >
      <div className="w-16 shrink-0 border-r border-deck-line px-2 py-1 font-mono text-xs text-ink-faint">
        {String(hour).padStart(2, "0")}:00
        <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${ENERGY_DOT[energyLevel]}`} />
      </div>
      <div className="relative flex-1 px-2">{children}</div>
    </div>
  );
}

function TaskBlock({ task }: { task: TimelineTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const heightPx = Math.max(20, (task.durationMinutes / 60) * HOUR_HEIGHT_PX - 4);
  const topPx = ((task.startHour % 1) * HOUR_HEIGHT_PX);

  const style: React.CSSProperties = {
    height: heightPx,
    top: topPx,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusRing =
    task.status === "completed"
      ? "border-signal-success"
      : task.status === "missed"
      ? "border-signal-cost"
      : task.status === "in_progress"
      ? "border-energy-peak"
      : "border-deck-line";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`absolute left-2 right-2 cursor-grab rounded-deck border-l-2 ${statusRing} bg-deck-surfaceRaised/90 px-2 py-1 shadow-panel active:cursor-grabbing`}
    >
      <p className="truncate font-body text-xs font-medium text-ink-primary">{task.title}</p>
      <p className="font-mono text-[10px] text-ink-muted">{task.durationMinutes}m</p>
    </div>
  );
}

export default function TimeBoxTimeline({
  energyCurve,
  tasks,
  dayStartHour = 6,
  dayEndHour = 22,
  onTaskMove,
}: TimeBoxTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const hours = useMemo(
    () => Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i),
    [dayStartHour, dayEndHour]
  );

  const tasksByHour = useMemo(() => {
    const map = new Map<number, TimelineTask[]>();
    for (const task of tasks) {
      const hourBucket = Math.floor(task.startHour);
      if (!map.has(hourBucket)) map.set(hourBucket, []);
      map.get(hourBucket)!.push(task);
    }
    return map;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newHour = Number(String(over.id).replace("hour-", ""));
    if (!Number.isNaN(newHour)) {
      onTaskMove?.(String(active.id), newHour);
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <div className="overflow-hidden rounded-deck border border-deck-line bg-deck-surface shadow-panel">
      <div className="border-b border-deck-line px-4 py-3">
        <h3 className="font-display text-sm font-semibold tracking-wide text-ink-primary">
          Today&apos;s Timeline
        </h3>
        <p className="font-body text-xs text-ink-muted">Drag blocks to reschedule</p>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="max-h-[560px] overflow-y-auto">
          {hours.map((hour) => (
            <HourSlot key={hour} hour={hour} energyLevel={energyCurve[hour] ?? "medium"}>
              {(tasksByHour.get(hour) ?? []).map((task) => (
                <TaskBlock key={task.id} task={task} />
              ))}
            </HourSlot>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rounded-deck border-l-2 border-energy-peak bg-deck-surfaceRaised px-2 py-1 shadow-panel">
              <p className="font-body text-xs font-medium text-ink-primary">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
