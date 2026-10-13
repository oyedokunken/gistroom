"use client";

/** Small choices kept on this device. Private windows can refuse storage, so each has a default and never throws. */

const NOTICES = "gr_room_notices";
const PREJOIN = "gr_prejoin_v1";

export function showRoomNotices(): boolean {
  try {
    return window.localStorage.getItem(NOTICES) !== "off";
  } catch {
    return true;
  }
}

export function setShowRoomNotices(on: boolean): void {
  try {
    window.localStorage.setItem(NOTICES, on ? "on" : "off");
  } catch {
    // The choice then lasts for this visit only.
  }
}

export interface PrejoinPrefs {
  /** Arrive with the microphone off. */
  muted: boolean;
  /** Arrive with the camera off. On by default, so nobody is on camera by surprise. */
  cameraOff: boolean;
  /** Skip the check screen when the browser already allows the microphone. */
  skip: boolean;
  micId: string | null;
  camId: string | null;
}

const DEFAULT_PREJOIN: PrejoinPrefs = {
  muted: false,
  cameraOff: true,
  skip: false,
  micId: null,
  camId: null,
};

export function loadPrejoin(): PrejoinPrefs {
  try {
    const raw = window.localStorage.getItem(PREJOIN);
    if (!raw) return { ...DEFAULT_PREJOIN };
    const v = JSON.parse(raw) as Partial<PrejoinPrefs>;
    return {
      muted: typeof v.muted === "boolean" ? v.muted : DEFAULT_PREJOIN.muted,
      cameraOff: typeof v.cameraOff === "boolean" ? v.cameraOff : DEFAULT_PREJOIN.cameraOff,
      skip: typeof v.skip === "boolean" ? v.skip : DEFAULT_PREJOIN.skip,
      micId: typeof v.micId === "string" ? v.micId : null,
      camId: typeof v.camId === "string" ? v.camId : null,
    };
  } catch {
    return { ...DEFAULT_PREJOIN };
  }
}

export function savePrejoin(prefs: PrejoinPrefs): void {
  try {
    window.localStorage.setItem(PREJOIN, JSON.stringify(prefs));
  } catch {
    // The choice then lasts for this visit only.
  }
}
