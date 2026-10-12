"use client";

import { useEffect } from "react";
import { clearAuthedHint, readAuthedHint } from "@/lib/authed-hint";
import { useAuthState, type SessionPerson } from "@/lib/auth-state";
import { apiFetch } from "@/lib/api";

/**
 * Learns once per page load whether this browser is signed in. The hint cookie answers first, so the button already
 * says "Open Gistroom" for a returning person, and the server then confirms and supplies the avatar.
 */
export function AuthStateProvider() {
  useEffect(() => {
    const set = useAuthState.getState().set;
    if (readAuthedHint()) set({ status: "hint", person: null });
    let live = true;
    apiFetch<{ authed: boolean; person: SessionPerson | null; unknown?: boolean }>(
      "/api/auth/session",
    )
      .then((res) => {
        if (!live || res.unknown) return;
        if (res.authed) set({ status: "in", person: res.person });
        else {
          clearAuthedHint();
          set({ status: "out", person: null });
        }
      })
      .catch(() => {
        if (live && useAuthState.getState().status === "unknown")
          set({ status: "out", person: null });
      });
    return () => {
      live = false;
    };
  }, []);
  return null;
}
