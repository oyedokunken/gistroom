"use client";

import { create } from "zustand";

export interface SessionPerson {
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface AuthState {
  /**
   * `unknown` until this browser has been asked. `hint` means the sign in cookie hint is there and the server
   * has not answered yet, which is treated as signed in for labels so nothing jumps.
   */
  status: "unknown" | "hint" | "in" | "out";
  person: SessionPerson | null;
  set: (state: Pick<AuthState, "status" | "person">) => void;
}

export const useAuthState = create<AuthState>((set) => ({
  status: "unknown",
  person: null,
  set: (next) => set(next),
}));

/** True when labels should say the person is signed in. */
export const selectSignedIn = (s: AuthState): boolean => s.status === "in" || s.status === "hint";
