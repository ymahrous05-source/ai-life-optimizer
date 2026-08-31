"use client";

// =====================================================================
// VirtualCoworkingRoom
// Silent focus hub: shows avatars of peers currently co-working, each
// with what they're working on (title only — no video/audio). Pure
// ambient accountability.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCoworkingPresence } from "../../lib/realtime/useCoworkingPresence";

interface VirtualCoworkingRoomProps {
  supabase: SupabaseClient;
  roomId: string;
  self: { userId: string; displayName: string; currentTaskTitle: string | null };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function VirtualCoworkingRoom({ supabase, roomId, self }: VirtualCoworkingRoomProps) {
  const peers = useCoworkingPresence(supabase, roomId, self);

  return (
    <div className="rounded-deck border border-deck-line bg-deck-surface p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-xs uppercase tracking-wider text-ink-muted">
          Silent Focus Room
        </p>
        <span className="font-mono text-[10px] text-ink-faint">
          {peers.length + 1} present
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-energy-peak bg-energy-peak/10 font-mono text-xs text-energy-peak">
            {initials(self.displayName)}
          </div>
          <p className="max-w-[64px] truncate text-center font-body text-[10px] text-ink-muted">
            You
          </p>
        </div>

        {peers.map((peer) => (
          <div key={peer.userId} className="flex flex-col items-center gap-1">
            <div
              title={peer.currentTaskTitle ?? "Focusing"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-deck-line bg-deck-surfaceRaised font-mono text-xs text-ink-primary"
            >
              {initials(peer.displayName)}
            </div>
            <p className="max-w-[64px] truncate text-center font-body text-[10px] text-ink-muted">
              {peer.displayName.split(" ")[0]}
            </p>
          </div>
        ))}
      </div>

      {peers.length === 0 && (
        <p className="mt-3 font-body text-xs text-ink-faint">
          No one else here yet — invite an accountability partner.
        </p>
      )}
    </div>
  );
}
