"use client";

import {
  Flag,
  Laptop,
  MonitorSmartphone,
  Plus,
  Share,
  ShieldCheck,
  Smartphone,
  UserX,
  Check,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { PhoneFrame } from "@/components/mock/phone";
import { PersonAvatar } from "@/components/mock/screens";
import { mockLabels as L } from "@/content/marketing";

export {
  AlertsMock,
  AudioCallMock,
  CallMock,
  ChatMock,
  DataMock,
  RoomMock,
} from "@/components/mock/screens";

export function DevicesMock() {
  const rows = [
    { icon: Laptop, name: "Chrome on Windows", note: L.thisDevice },
    { icon: Smartphone, name: "Safari on iPhone", note: "Yesterday" },
    { icon: MonitorSmartphone, name: "Edge on Windows", note: "Last week" },
  ];
  return (
    <PhoneFrame label={L.sampleDevices}>
      <div className="flex flex-1 flex-col gap-3 px-3 py-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck aria-hidden className="size-4 text-green-600" />
          Signed in devices
        </p>
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <r.icon aria-hidden className="size-6 shrink-0 text-green-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.name}</span>
              <span className="block text-xs text-text-muted">{r.note}</span>
            </span>
            {i > 0 ? (
              <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold">
                {L.signOut}
              </span>
            ) : (
              <Check aria-hidden className="size-4 text-green-600" />
            )}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

export function SafetyMock() {
  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col justify-center gap-3 px-3 py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <PersonAvatar name="Obinna" size={40} />
          <div>
            <p className="text-sm font-semibold">Obinna</p>
            <p className="text-xs text-text-muted">Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <UserX aria-hidden className="size-5 text-danger-600" />
          {L.block}
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <Flag aria-hidden className="size-5 text-danger-600" />
          {L.report}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-yellow-400 p-3 text-sm font-semibold text-ink-950">
          <ShieldCheck aria-hidden className="size-5" />
          {L.mod}: mute, remove, ban
        </div>
      </div>
    </PhoneFrame>
  );
}

export function InstallMock() {
  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col justify-between bg-green-100 px-4 py-6 text-ink-950">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} aria-hidden className="aspect-square rounded-2xl bg-white/70" />
          ))}
          <span className="flex aspect-square items-center justify-center rounded-2xl bg-green-600 text-white shadow-soft">
            <LogoMark size={30} bubble="currentColor" className="text-white" />
          </span>
        </div>
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-3 text-sm font-semibold">
          <Share aria-hidden className="size-5 text-green-600" />
          <Plus aria-hidden className="size-4" />
          Add to Home Screen
        </div>
      </div>
    </PhoneFrame>
  );
}
