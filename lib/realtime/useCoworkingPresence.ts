"use client";

// =====================================================================
// useCoworkingPresence()
// Uses Supabase Realtime's Presence feature to show who else is
// silently co-working in the same room right now — no video/audio,
// just ambient peer accountability (a "silent focus hub").
// =====================================================================
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PresentPeer {
  userId: string;
  displayName: string;
  currentTaskTitle: string | null;
  joinedAt: string;
}

export function useCoworkingPresence(
  supabase: SupabaseClient,
  roomId: string,
  self: { userId: string; displayName: string; currentTaskTitle: string | null }
) {
  const [peers, setPeers] = useState<PresentPeer[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`coworking-room-${roomId}`, {
      config: { presence: { key: self.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresentPeer>();
        const all = Object.values(state).flat();
        setPeers(all.filter((p) => p.userId !== self.userId));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: self.userId,
            displayName: self.displayName,
            currentTaskTitle: self.currentTaskTitle,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, self.userId, self.currentTaskTitle]);

  return peers;
}
