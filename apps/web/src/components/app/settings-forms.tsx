"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BIO_MAX, nameSchema, type MeUser, type UpdateProfileInput } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { AvatarUploader } from "./avatar-uploader";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { settings } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";

/** Saves a partial profile and shows a calm inline confirmation next to the button. */
function useSave() {
  const router = useRouter();
  const { showError } = useFeedback();
  const [saved, setSaved] = useState(false);
  async function save(patch: UpdateProfileInput) {
    setSaved(false);
    try {
      await apiFetch("/api/me", { method: "PATCH", body: patch });
      setSaved(true);
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
      return false;
    }
  }
  return { save, saved, clear: () => setSaved(false) };
}

const profileSchema = z.object({
  name: nameSchema,
  bio: z.string().trim().max(BIO_MAX, `Use ${BIO_MAX} characters or fewer.`),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileForm({ user }: { user: MeUser }) {
  const copy = settings.profile;
  const { save, saved, clear } = useSave();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, bio: user.bio ?? "" },
  });
  const errors = form.formState.errors;
  return (
    <form
      noValidate
      onChange={clear}
      onSubmit={form.handleSubmit(async (v) => {
        await save({ name: v.name, bio: v.bio === "" ? null : v.bio });
      })}
      className="flex w-full flex-col gap-4"
    >
      <AvatarUploader name={user.name} avatarUrl={user.avatarUrl} />
      <Field label={copy.nameLabel} error={errors.name?.message}>
        {(props) => <Input {...props} autoComplete="name" {...form.register("name")} />}
      </Field>
      <Field label={copy.bioLabel} help={copy.bioHelp} error={errors.bio?.message}>
        {(props) => <Textarea {...props} rows={3} {...form.register("bio")} />}
      </Field>
      <Field label={copy.usernameLabel} help={copy.usernameHelp}>
        {(props) => <Input {...props} value={`@${user.username}`} readOnly />}
      </Field>
      <Field label={copy.emailLabel} help={copy.emailHelp}>
        {(props) => <Input {...props} value={user.email} readOnly />}
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function PrivacyForm({ user }: { user: MeUser }) {
  const copy = settings.privacy;
  const { save, saved, clear } = useSave();
  const [values, setValues] = useState({
    discoverable: user.discoverable,
    showPresence: user.showPresence,
    sendReadReceipts: user.sendReadReceipts,
    roomInvitesFrom: user.roomInvitesFrom,
  });
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    clear();
    setValues((v) => ({ ...v, [key]: value }));
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="divide-y divide-border">
        <Switch
          label={copy.discoverable}
          help={copy.discoverableHelp}
          checked={values.discoverable}
          onChange={(v) => update("discoverable", v)}
        />
        <Switch
          label={copy.showPresence}
          help={copy.showPresenceHelp}
          checked={values.showPresence}
          onChange={(v) => update("showPresence", v)}
        />
        <Switch
          label={copy.sendReadReceipts}
          help={copy.sendReadReceiptsHelp}
          checked={values.sendReadReceipts}
          onChange={(v) => update("sendReadReceipts", v)}
        />
      </div>
      <Field label={copy.roomInvitesLabel}>
        {(props) => (
          <Select
            {...props}
            value={values.roomInvitesFrom}
            onValueChange={(v) => update("roomInvitesFrom", v as "FRIENDS" | "EVERYONE")}
            options={[
              { value: "FRIENDS", label: copy.roomInvitesFriends },
              { value: "EVERYONE", label: copy.roomInvitesEveryone },
            ]}
          />
        )}
      </Field>
      <div className="mt-3 flex items-center gap-4">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await save(values);
            setBusy(false);
          }}
        >
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DataSaverForm({ user }: { user: MeUser }) {
  const copy = settings.data;
  const { save, saved, clear } = useSave();
  const [on, setOn] = useState(user.dataSaver);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2">
      <Switch
        label={copy.toggle}
        help={copy.help}
        checked={on}
        onChange={(v) => {
          clear();
          setOn(v);
        }}
      />
      <div className="mt-3 flex items-center gap-4">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await save({ dataSaver: on });
            setBusy(false);
          }}
        >
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}
