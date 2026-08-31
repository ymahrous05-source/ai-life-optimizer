"use client";

// =====================================================================
// WeeklyReportCard
// Renders the WeeklyPerformanceReport computed server-side: a headline
// sentence ("Your energy is best between 10 AM and 1 PM"), a 24-hour
// energy bar chart with the best window highlighted, and focus/task
// stats with a week-over-week trend arrow.
// =====================================================================
import type { WeeklyPerformanceReport } from "../../lib/reports/weeklyPerformanceReport";
import InfoTooltip from "../ui/InfoTooltip";

interface WeeklyReportCardProps {
  report: WeeklyPerformanceReport;
}

const TREND_ICON: Record<"up" | "down" | "flat", string> = {
  up: "↗",
  down: "↘",
  flat: "→",
};

const TREND_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "text-signal-success",
  down: "text-signal-cost",
  flat: "text-ink-faint",
};

export default function WeeklyReportCard({ report }: WeeklyReportCardProps) {
  const {
    headline,
    bestEnergyWindow,
    hourlyBreakdown,
    totalFocusedMinutes,
    completedFocusSessions,
    interruptedFocusSessions,
    focusCompletionRate,
    tasksCompleted,
    focusedMinutesTrend,
    tasksCompletedTrend,
  } = report;

  const maxScore = Math.max(1, ...hourlyBreakdown.map((b) => b.averageScore));

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Weekly Report
          <InfoTooltip
            text="ملخص أسبوعي لأوقات طاقتك وجلسات التركيز والمهام المنجزة، مبني على تسجيلاتك الفعلية."
            align="left"
          />
        </p>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          Last 7 days
        </span>
      </div>

      <p className="mb-5 font-body text-sm leading-relaxed text-ink-primary">{headline}</p>

      <div className="mb-5 flex h-16 items-end gap-[2px]" role="img" aria-label="Hourly energy levels for the past week">
        {hourlyBreakdown.map((bucket) => {
          const isInBestWindow =
            bestEnergyWindow !== null &&
            bucket.hour >= bestEnergyWindow.startHour &&
            bucket.hour < bestEnergyWindow.endHour;
          const heightPct = Math.max(4, (bucket.averageScore / maxScore) * 100);

          return (
            <div
              key={bucket.hour}
              className="group relative flex-1"
              title={`${formatHourLabel(bucket.hour)} — ${bucket.sampleCount} check-in${
                bucket.sampleCount === 1 ? "" : "s"
              }`}
            >
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isInBestWindow ? "bg-energy-peak" : "bg-energy-medium/40"
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mb-5 flex justify-between font-mono text-[9px] text-ink-faint">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>11 PM</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Focused minutes"
          value={totalFocusedMinutes.toLocaleString()}
          trend={focusedMinutesTrend}
        />
        <Stat
          label="Tasks completed"
          value={String(tasksCompleted)}
          trend={tasksCompletedTrend}
        />
        <Stat
          label="Sessions completed"
          value={`${completedFocusSessions} / ${completedFocusSessions + interruptedFocusSessions}`}
        />
        <Stat label="Focus completion rate" value={`${Math.round(focusCompletionRate * 100)}%`} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="flex items-baseline gap-1.5 font-mono text-lg font-semibold text-ink-primary">
        {value}
        {trend && <span className={`text-xs ${TREND_COLOR[trend]}`}>{TREND_ICON[trend]}</span>}
      </p>
    </div>
  );
}

function formatHourLabel(hour24: number): string {
  const period = hour24 < 12 ? "AM" : "PM";
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h12} ${period}`;
}
