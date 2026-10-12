"use client";

import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  LIMITS,
  TOPIC_GROUPS,
  TOPICS,
  type Language,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { session } from "@/content/session";
import { useOffline } from "@/lib/session/use-offline";
import { roomCopy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";
import { roomApi } from "@/lib/rooms/api";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the room a name.")
    .max(LIMITS.ROOM_TITLE_MAX, `Use ${LIMITS.ROOM_TITLE_MAX} characters or fewer.`),
  topicSlug: z.string().optional(),
  language: z.string(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  media: z.enum(["AUDIO", "VIDEO"]),
  description: z.string().trim().max(500, "Use 500 characters or fewer."),
  scheduledFor: z.string(),
});
type Values = z.infer<typeof schema>;

/** Starts a room now, or schedules one. The person lands inside it as host. */
export function CreateRoomModal({
  open,
  onOpenChange,
  initialTopic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopic?: string;
}) {
  const copy = roomCopy.create;
  const offline = useOffline();
  const router = useRouter();
  const { showError } = useFeedback();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      topicSlug: initialTopic ?? "",
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "AUDIO",
      description: "",
      scheduledFor: "",
    },
  });
  const errors = form.formState.errors;
  const visibility = form.watch("visibility");
  const media = form.watch("media");
  const scheduled = form.watch("scheduledFor") !== "";

  async function submit(v: Values) {
    try {
      const { room } = await roomApi.create({
        title: v.title,
        topicSlug: v.topicSlug || null,
        language: v.language as Language,
        visibility: v.visibility,
        media: v.media,
        description: v.description || null,
        scheduledFor: v.scheduledFor ? new Date(v.scheduledFor).toISOString() : null,
      });
      onOpenChange(false);
      router.push(`/app/rooms/${room.slug}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.scheduledFor) {
        form.setError("scheduledFor", { message: e.fields.scheduledFor });
      } else {
        showError(e instanceof ApiClientError ? e.message : copy.submit);
      }
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={Mic}
      title={copy.title}
      description={copy.description}
    >
      <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
        <Field label={copy.nameLabel} error={errors.title?.message}>
          {(props) => (
            <Input {...props} placeholder={copy.namePlaceholder} {...form.register("title")} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.topicLabel}>
            {(props) => (
              <Controller
                control={form.control}
                name="topicSlug"
                render={({ field }) => (
                  <Combobox
                    id={props.id}
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    placeholder={copy.topicPlaceholder}
                    searchLabel={copy.topicPlaceholder}
                    emptyText={copy.topicEmpty}
                    options={TOPICS.map((t) => ({
                      value: t.slug,
                      label: t.name,
                      hint: TOPIC_GROUPS.find((g) => g.id === t.group)?.label,
                    }))}
                  />
                )}
              />
            )}
          </Field>
          <Field label={copy.languageLabel}>
            {(props) => (
              <Controller
                control={form.control}
                name="language"
                render={({ field }) => (
                  <Select
                    id={props.id}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
                  />
                )}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.mediaLabel}</span>
          <Controller
            control={form.control}
            name="media"
            render={({ field }) => (
              <SegmentedTabs
                label={copy.mediaLabel}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                options={[
                  { value: "AUDIO", label: copy.audio },
                  { value: "VIDEO", label: copy.video },
                ]}
              />
            )}
          />
          <p className="text-sm text-text-muted">
            {media === "AUDIO" ? copy.audioHelp : copy.videoHelp}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.visibilityLabel}</span>
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <SegmentedTabs
                label={copy.visibilityLabel}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                options={[
                  { value: "PUBLIC", label: copy.public },
                  { value: "PRIVATE", label: copy.private },
                ]}
              />
            )}
          />
          <p className="text-sm text-text-muted">
            {visibility === "PUBLIC" ? copy.publicHelp : copy.privateHelp}
          </p>
        </div>
        <Field label={copy.descriptionLabel} error={errors.description?.message}>
          {(props) => <Textarea {...props} rows={2} {...form.register("description")} />}
        </Field>
        <Field
          label={copy.scheduleLabel}
          help={copy.scheduleHelp}
          error={errors.scheduledFor?.message}
        >
          {(props) => <Input {...props} type="datetime-local" {...form.register("scheduledFor")} />}
        </Field>
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          disabled={offline}
          title={offline ? session.needsConnection : undefined}
        >
          {form.formState.isSubmitting
            ? copy.submitting
            : scheduled
              ? copy.submitScheduled
              : copy.submit}
        </Button>
      </form>
    </Modal>
  );
}
