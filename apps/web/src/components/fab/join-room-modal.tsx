"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { fab as copy } from "@/content/fab";
import { roomPathFrom } from "@/lib/fab-config";

const schema = z.object({
  target: z
    .string()
    .trim()
    .min(1, copy.join.required)
    .refine((v) => roomPathFrom(v) !== null, copy.join.invalid),
});
type Values = z.infer<typeof schema>;

/** Paste an invite link or a room code and go straight to that room. */
export function JoinRoomModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { target: "" } });

  function submit(values: Values) {
    const path = roomPathFrom(values.target);
    if (!path) return;
    onOpenChange(false);
    form.reset();
    router.push(path);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={Link2}
      title={copy.join.title}
      description={copy.join.body}
    >
      <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
        <Field label={copy.join.label} error={form.formState.errors.target?.message}>
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={copy.join.placeholder}
              {...form.register("target")}
            />
          )}
        </Field>
        <Button type="submit" className="min-h-12">
          {copy.join.submit}
        </Button>
      </form>
    </Modal>
  );
}
