"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type FabPlace = "chats" | "calls" | "friends" | "rooms" | "discover";

/** What an action does: go to an address, or open one of the small windows the button owns. */
export type FabActionKind =
  | { type: "href"; href: string }
  | { type: "modal"; modal: "call-audio" | "call-video" | "add-friend" | "join-room" };

export interface FabAction {
  id: string;
  label: string;
  icon: "chat" | "search" | "phone" | "video" | "user-plus" | "compass" | "mic" | "link";
  kind: FabActionKind;
}

export interface FabConfig {
  place: FabPlace;
  actions: FabAction[];
}

interface FabState {
  place: FabPlace | null;
  set: (place: FabPlace | null) => void;
}

export const useFabStore = create<FabState>((set) => ({
  place: null,
  set: (place) => set({ place }),
}));

/**
 * A screen says which place it is. The button changes to that place's icon and actions, and goes back to the
 * Discover button when the screen leaves. A screen that says nothing keeps the Discover button.
 */
export function useFab(place: FabPlace): void {
  useEffect(() => {
    useFabStore.getState().set(place);
    return () => useFabStore.getState().set(null);
  }, [place]);
}

/** Pure, so the rule is tested without a browser: the fallback is Discover. */
export function resolvePlace(registered: FabPlace | null): FabPlace {
  return registered ?? "discover";
}
