"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  CHAT_MODES,
  LANGUAGES,
  LANGUAGE_LABELS,
  LIMITS,
  SLOW_MODE_OPTIONS,
  TOPICS,
  type RoomChatMode,
  type RoomDto,
  type RoomSettingsInput,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { roomCopy as copy } from "@/content/rooms";
import { roomApi, type RoomView } from "@/lib/rooms/api";
import { fail } from "./shared";

// ---------- Settings ----------

const CHAT_LABELS: Record<RoomChatMode, string> = {
  EVERYONE: copy.settings.chatEveryone,
  MODERATORS: copy.settings.chatModerators,
  OFF: copy.settings.chatOff,
};

/** The host and moderators change these live. Switches save as soon as they are touched. */
export function SettingsPanel({ room }: { room: RoomDto }) {
  const { showError } = useFeedback();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (input: RoomSettingsInput) => roomApi.settings(room.slug, input),
    // The switch moves the moment it is pressed. The server answer then confirms it, or puts it back.
    onMutate: async (input) => {
      const key = ["room", room.slug];
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<RoomView>(key);
      if (before?.state === "OK") {
        const next = { ...before.room.settings };
        for (const k of Object.keys(next) as (keyof typeof next)[]) {
          const v = (input as Record<string, unknown>)[k];
          if (v !== undefined) (next as Record<string, unknown>)[k] = v;
        }
        const updated: RoomView = { state: "OK", room: { ...before.room, settings: next } };
        queryClient.setQueryData<RoomView>(key, updated);
      }
      return { before };
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["room", room.slug] });
      void queryClient.invalidateQueries({ queryKey: ["room-log", room.slug] });
    },
    onError: (e, _input, ctx) => {
      if (ctx?.before) queryClient.setQueryData(["room", room.slug], ctx.before);
      showError(fail(e));
    },
  });
  const s = room.settings;
  const change = (input: RoomSettingsInput) => {
    setSaved(false);
    save.mutate(input);
  };

  async function lock() {
    try {
      await roomApi.session(room.slug, room.locked ? "unlock" : "lock");
      void queryClient.invalidateQueries({ queryKey: ["room", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  function saveAbout() {
    const t = title.trim();
    if (!t) return setTitleError(copy.settings.titleRequired);
    if (t.length > LIMITS.ROOM_TITLE_MAX) {
      return setTitleError(copy.settings.titleTooLong(LIMITS.ROOM_TITLE_MAX));
    }
    if (description.trim().length > 500) return;
    setTitleError(null);
    change({ title: t, description: description.trim() || null });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <p className="text-sm text-text-muted">{copy.settings.help}</p>

      <section className="flex flex-col gap-3" aria-labelledby="set-about">
        <h3 id="set-about" className="text-base font-bold text-text">
          {copy.settings.groups.about}
        </h3>
        <Field label={copy.settings.titleLabel} error={titleError ?? undefined}>
          {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field
          label={copy.settings.descriptionLabel}
          error={description.length > 500 ? copy.settings.descriptionTooLong : undefined}
        >
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="flex items-center gap-3">
          <Button variant="secondary" loading={save.isPending} onClick={saveAbout}>
            {save.isPending ? copy.settings.saving : copy.settings.save}
          </Button>
          {saved ? (
            <span role="status" className="flex items-center gap-1 text-sm text-green-700">
              <Check aria-hidden className="size-4" />
              {copy.settings.saved}
            </span>
          ) : null}
        </div>
        <Field label={copy.settings.topicLabel}>
          {(props) => (
            <Combobox
              id={props.id}
              value={room.topicSlug ?? undefined}
              onValueChange={(v) => change({ topicSlug: v })}
              placeholder={copy.create.topicPlaceholder}
              searchLabel={copy.create.topicPlaceholder}
              emptyText={copy.create.topicEmpty}
              options={TOPICS.map((t) => ({ value: t.slug, label: t.name }))}
            />
          )}
        </Field>
        <Field label={copy.settings.languageLabel}>
          {(props) => (
            <Select
              id={props.id}
              value={room.language}
              onValueChange={(v) => change({ language: v as RoomDto["language"] })}
              options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.visibilityLabel}</span>
          <SegmentedTabs
            label={copy.settings.visibilityLabel}
            value={room.visibility}
            onChange={(v) => change({ visibility: v as "PUBLIC" | "PRIVATE" })}
            options={[
              { value: "PUBLIC", label: copy.settings.public },
              { value: "PRIVATE", label: copy.settings.private },
            ]}
          />
          <p className="text-sm text-text-muted">
            {room.visibility === "PUBLIC" ? copy.settings.publicHelp : copy.settings.privateHelp}
          </p>
        </div>
      </section>

      <section className="flex flex-col divide-y divide-border" aria-labelledby="set-who">
        <h3 id="set-who" className="pb-2 text-base font-bold text-text">
          {copy.settings.groups.who}
        </h3>
        <Switch
          label={copy.settings.cameraAllowed}
          help={copy.settings.cameraAllowedHelp}
          checked={s.cameraAllowed}
          onChange={(v) => change({ cameraAllowed: v })}
        />
        <Switch
          label={copy.settings.joinMuted}
          help={copy.settings.joinMutedHelp}
          checked={s.joinMuted}
          onChange={(v) => change({ joinMuted: v })}
        />
        <Switch
          label={copy.settings.unmuteLocked}
          help={copy.settings.unmuteLockedHelp}
          checked={s.unmuteLocked}
          onChange={(v) => change({ unmuteLocked: v })}
        />
        {room.visibility === "PUBLIC" ? (
          <Switch
            label={copy.settings.membersCanShare}
            help={copy.settings.membersCanShareHelp}
            checked={s.membersCanShare}
            onChange={(v) => change({ membersCanShare: v })}
          />
        ) : null}
        <Switch
          label={copy.settings.lock}
          help={copy.settings.lockHelp}
          checked={room.locked}
          onChange={() => void lock()}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="set-chat">
        <h3 id="set-chat" className="text-base font-bold text-text">
          {copy.settings.groups.chat}
        </h3>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.chatLabel}</span>
          <SegmentedTabs
            label={copy.settings.chatLabel}
            value={s.chatMode}
            onChange={(v) => change({ chatMode: v as RoomChatMode })}
            options={CHAT_MODES.map((m) => ({ value: m, label: CHAT_LABELS[m] }))}
          />
        </div>
        <Switch
          label={copy.settings.reactionsOn}
          help={copy.settings.reactionsOnHelp}
          checked={s.reactionsOn}
          onChange={(v) => change({ reactionsOn: v })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.slowLabel}</span>
          <SegmentedTabs
            label={copy.settings.slowLabel}
            value={String(s.slowModeSec)}
            onChange={(v) => change({ slowModeSec: Number(v) })}
            options={SLOW_MODE_OPTIONS.map((n) => ({
              value: String(n),
              label: n === 0 ? copy.settings.slowOff : copy.settings.slowSeconds(n),
            }))}
          />
          <p className="text-sm text-text-muted">{copy.settings.slowHelp}</p>
        </div>
      </section>
    </div>
  );
}
