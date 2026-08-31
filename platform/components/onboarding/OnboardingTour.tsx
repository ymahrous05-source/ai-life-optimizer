"use client";

// =====================================================================
// OnboardingTour
// A 4-step spotlight walkthrough of the Bio-Dashboard. Finds each
// target by its `data-tour="..."` attribute, scrolls it into view,
// then cuts a glowing hole through a dark backdrop around it with a
// tooltip card explaining what it is and how to use it.
//
// Shown automatically on first visit (persisted in localStorage) and
// re-openable any time via the "؟" button in the dashboard header.
// =====================================================================
import { useEffect, useState } from "react";

export const ONBOARDING_STORAGE_KEY = "lifeOptimizer.onboardingSeen";

interface TourStep {
  target: string; // matches a data-tour="" attribute on the page
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: "life-score",
    title: "الخطوة ١ من ٤ — Life Score",
    body: "الدائرة دي هي نبض يومك في رقم واحد من ١٠٠. بتلخّص كل حاجة: طاقتك، إنجازك، واستراحاتك، عشان تعرف من نظرة واحدة إنت ماشي كويس ولا محتاج تهدّي شوية.",
  },
  {
    target: "mental-battery",
    title: "الخطوة ٢ من ٤ — Mental Battery و Cost of Delay",
    body: "Mental Battery بيوريك طاقتك الذهنية المتبقية، والـ AI بيستخدمها عشان يحط المهام الصعبة في وقت ذروة نشاطك. وجنبها Cost of Delay بيوريك التكلفة التقديرية لو أجّلت مهامك — عشان تفضل متحفّز.",
  },
  {
    target: "timeline",
    title: "الخطوة ٣ من ٤ — Timeline",
    body: "هنا جدولك اليومي ساعة بساعة، ولونه بيتغيّر حسب مستوى طاقتك في كل وقت. تقدر تسحب أي مهمة (Drag) وتحطها في وقت تاني بكل سهولة.",
  },
  {
    target: "action-bar",
    title: "الخطوة ٤ من ٤ — الأدوات السريعة",
    body: "من هنا تقدر تخلّي الـ AI يعيد ترتيب يومك (Smart Reschedule)، تاخد استراحة NSDR، أو تدخل وضع التركيز الكامل (Focus Lockdown) لما تحتاج تشتغل من غير أي تشتيت.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

const PADDING = 8;

export default function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    function measure() {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (!cancelled) {
        setRect({
          top: r.top - PADDING,
          left: r.left - PADDING,
          width: r.width + PADDING * 2,
          height: r.height + PADDING * 2,
        });
      }
    }

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeout = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  if (!open) return null;

  function finish() {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
    onClose();
  }

  function goNext() {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  // Position the tooltip card below the spotlight, or above it if there
  // isn't room, and clamp it horizontally within the viewport.
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;
  const cardWidth = Math.min(320, viewportW - 32);

  let cardTop = 0;
  let cardLeft = 16;
  let placeAbove = false;

  if (rect) {
    const spaceBelow = viewportH - (rect.top + rect.height);
    placeAbove = spaceBelow < 220 && rect.top > 220;
    cardTop = placeAbove ? rect.top - 12 : rect.top + rect.height + 12;
    cardLeft = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), viewportW - cardWidth - 16);
  } else {
    cardTop = viewportH / 2 - 80;
    cardLeft = viewportW / 2 - cardWidth / 2;
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight cutout: a transparent box whose giant box-shadow darkens everything else */}
      <div
        className="pointer-events-none fixed rounded-deck border-2 border-energy-peak/80 transition-all duration-300 ease-out"
        style={
          rect
            ? {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                boxShadow: "0 0 0 9999px rgba(6, 9, 12, 0.8)",
              }
            : { inset: 0, boxShadow: "0 0 0 9999px rgba(6, 9, 12, 0.8)" }
        }
      />

      <div
        dir="rtl"
        className="fixed z-[101] rounded-deck border border-deck-line bg-deck-surfaceRaised p-4 shadow-panel transition-all duration-300 ease-out"
        style={{ top: placeAbove ? undefined : cardTop, bottom: placeAbove ? viewportH - cardTop : undefined, left: cardLeft, width: cardWidth }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink-faint">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="font-body text-[11px] text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
          >
            تخطي الجولة
          </button>
        </div>

        <h4 className="mb-1.5 font-display text-sm font-semibold text-ink-primary">{step.title}</h4>
        <p className="font-body text-xs leading-relaxed text-ink-muted">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === stepIndex ? "bg-energy-peak" : "bg-deck-line"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="rounded-deck border border-deck-line px-3 py-1.5 font-body text-xs text-ink-muted transition hover:border-ink-faint"
              >
                السابق
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-deck border border-energy-peak/50 bg-energy-peak/10 px-3 py-1.5 font-body text-xs font-medium text-energy-peak transition hover:bg-energy-peak/20"
            >
              {isLast ? "يلا نبدأ" : "التالي"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
