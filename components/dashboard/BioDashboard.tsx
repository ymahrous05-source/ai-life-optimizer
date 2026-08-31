"use client";

// =====================================================================
// BioDashboard
// Top-level page component composing:
//   - TimeBoxTimeline   (draggable schedule, energy color-coded)
//   - MentalBatteryGauge (cognitive load remaining)
//   - CostOfDelayTicker  (financial opportunity cost, live)
//   - ActionBar          (Smart Reschedule / NSDR / Focus Lockdown)
//   - FocusLockdownOverlay (shown conditionally)
// This is the primary client component rendered by app/dashboard/page.tsx.
// =====================================================================
import { useState } from "react";
import TimeBoxTimeline, { TimelineTask } from "./TimeBoxTimeline";
import MentalBatteryGauge from "./MentalBatteryGauge";
import CostOfDelayTicker from "./CostOfDelayTicker";
import ActionBar from "./ActionBar";
import FocusLockdownOverlay from "./FocusLockdownOverlay";
import VoiceCapture from "./VoiceCapture";
import EnergyCheckIn from "../energy/EnergyCheckIn";
import HabitStackList from "../habits/HabitStackList";
import LifeScoreOrb from "../life/LifeScoreOrb";
import type { LifeScoreResult } from "../../lib/life/computeLifeScore";
import type { EnergyLevel } from "../../lib/types";

interface HabitListItem {
  id: string;
  title: string;
  triggerTaskTitle: string | null;
  durationMinutes: number;
  currentStreak: number;
  longestStreak: number;
  loggedToday: boolean;
}

interface BioDashboardProps {
  userName: string;
  hourlyRate: number;
  energyCurve: Record<number, EnergyLevel>;
  initialTasks: TimelineTask[];
  mentalBatteryPercent: number;
  delayedMinutesToday: number;
  burnoutRiskScore: number;
  habits: HabitListItem[];
  lifeScore: LifeScoreResult;
  // Server actions passed down from the page component — keeps this
  // file free of direct fetch/Supabase calls.
  runSmartReschedule: () => Promise<TimelineTask[]>;
  logTaskMove: (taskId: string, newStartHour: number) => Promise<void>;
  startNsdrSession: () => Promise<void>;
  onVoiceTranscript: (transcript: string) => Promise<void>;
  onLogEnergy: (level: EnergyLevel, cognitiveLoadRemaining: number) => Promise<void>;
  onLogHabit: (habitId: string) => Promise<void>;
}

export default function BioDashboard({
  userName,
  hourlyRate,
  energyCurve,
  initialTasks,
  mentalBatteryPercent,
  delayedMinutesToday,
  burnoutRiskScore,
  habits,
  lifeScore,
  runSmartReschedule,
  logTaskMove,
  startNsdrSession,
  onVoiceTranscript,
  onLogEnergy,
  onLogHabit,
}: BioDashboardProps) {
  const [tasks, setTasks] = useState<TimelineTask[]>(initialTasks);
  const [lockdownTask, setLockdownTask] = useState<TimelineTask | null>(null);

  async function handleSmartReschedule() {
    const rescheduled = await runSmartReschedule();
    setTasks(rescheduled);
  }

  async function handleTaskMove(taskId: string, newStartHour: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, startHour: newStartHour } : t))
    );
    await logTaskMove(taskId, newStartHour);
  }

  function handleEnterLockdown() {
    const active = tasks.find((t) => t.status === "in_progress") ?? tasks[0];
    if (active) setLockdownTask(active);
  }

  return (
    <div className="min-h-screen bg-deck-bg p-6 font-body">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.25em] text-ink-faint">
            Bio-Dashboard
          </p>
          <h1 className="font-display text-xl font-semibold text-ink-primary">
            Welcome back, {userName}
          </h1>
        </div>
        <p className="font-mono text-xs text-ink-faint">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>
      </header>

      <div className="mb-6">
        <ActionBar
          onSmartReschedule={handleSmartReschedule}
          onStartNsdr={startNsdrSession}
          onEnterLockdown={handleEnterLockdown}
          burnoutRiskScore={burnoutRiskScore}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <TimeBoxTimeline
          energyCurve={energyCurve}
          tasks={tasks}
          onTaskMove={handleTaskMove}
        />

        <div className="flex flex-col gap-4">
          <LifeScoreOrb result={lifeScore} />
          <MentalBatteryGauge remainingPercent={mentalBatteryPercent} />
          <CostOfDelayTicker
            hourlyRate={hourlyRate}
            delayedMinutesToday={delayedMinutesToday}
            isAccumulatingLive={delayedMinutesToday > 0}
          />
          <VoiceCapture onTranscriptReady={onVoiceTranscript} />
          <EnergyCheckIn onLogEnergy={onLogEnergy} />
        </div>
      </div>

      <div className="mt-6">
        <HabitStackList habits={habits} onLogHabit={onLogHabit} />
      </div>

      {lockdownTask && (
        <FocusLockdownOverlay
          taskTitle={lockdownTask.title}
          plannedMinutes={lockdownTask.durationMinutes}
          onExit={() => setLockdownTask(null)}
        />
      )}
    </div>
  );
}
