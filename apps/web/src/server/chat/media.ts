import { randomUUID } from "node:crypto";
import { getDb, type User } from "@gistroom/db";
import {
  checkUpload,
  errors,
  extensionOf,
  messageTypeFor,
  type FinalizeUploadInput,
  type MessageDto,
  type SignUploadInput,
  type SignedUpload,
  type UploadVerdict,
} from "@gistroom/shared";
import { AppError, notFound } from "../http";
import { enforce, policies } from "../rate-limit";
import {
  buckets,
  createSignedUploadUrl,
  createSignedUrl,
  readHead,
  removeObjects,
} from "../storage";
import { accessFor, assertCanInteract, sendMessage } from "./service";

const THUMB_MAX_BYTES = 500 * 1024;

export function uploadError(reason: Extract<UploadVerdict, { ok: false }>["reason"]): AppError {
  const message =
    reason === "TOO_BIG"
      ? errors.uploadTooBig
      : reason === "EMPTY"
        ? errors.uploadEmpty
        : reason === "MISMATCH"
          ? errors.uploadMismatch
          : reason === "NOT_IMAGE"
            ? errors.uploadNotImage
            : errors.uploadType;
  return new AppError(400, "INVALID", message);
}

/** Step one: check the declared file and hand back a one time URL to upload it to. */
export async function signChatUpload(me: User, input: SignUploadInput): Promise<SignedUpload> {
  await enforce(policies.mediaSign, me.id);
  const access = await accessFor(me.id, input.conversationId);
  await assertCanInteract(me.id, access.peerId);

  let mime = input.mime.toLowerCase();
  if (input.role === "thumb") {
    if (mime !== "image/jpeg" || input.size > THUMB_MAX_BYTES) throw uploadError("TYPE");
  } else {
    const verdict = checkUpload({ mime, name: input.name, size: input.size, purpose: "chat" });
    if (!verdict.ok) throw uploadError(verdict.reason);
    mime = verdict.rule.mime;
  }

  const ext = input.role === "thumb" ? "jpg" : extensionOf(input.name) || "bin";
  const path = `dm/${input.conversationId}/${me.id}/${randomUUID()}.${ext}`;
  const bucket = buckets.media();
  const asset = await getDb().fileAsset.create({
    data: { ownerId: me.id, bucket, path, mime, sizeBytes: input.size },
  });
  return { assetId: asset.id, uploadUrl: await createSignedUploadUrl(bucket, path) };
}

async function takeAsset(me: User, conversationId: string, assetId: string) {
  const asset = await getDb().fileAsset.findUnique({ where: { id: assetId } });
  if (
    !asset ||
    asset.ownerId !== me.id ||
    asset.status !== "PENDING" ||
    !asset.path.startsWith(`dm/${conversationId}/`)
  ) {
    throw new AppError(404, "NOT_FOUND", errors.uploadMissing);
  }
  return asset;
}

/**
 * Step two: the file is stored. Read its first bytes, confirm it is what it claims, then make the message.
 * A file that fails is deleted straight away. Sending again with the same clientId returns the first message.
 */
export async function finalizeChatUpload(
  me: User,
  conversationId: string,
  input: FinalizeUploadInput,
): Promise<{ message: MessageDto; created: boolean }> {
  const access = await accessFor(me.id, conversationId);
  await assertCanInteract(me.id, access.peerId);

  const already = await getDb().message.findUnique({
    where: { senderId_clientId: { senderId: me.id, clientId: input.clientId } },
    select: { id: true },
  });
  if (!already) {
    const main = await takeAsset(me, conversationId, input.assetId);
    const stored = await readHead(main.bucket, main.path);
    if (!stored) throw new AppError(404, "NOT_FOUND", errors.uploadMissing);
    const verdict = checkUpload({
      mime: main.mime,
      name: `file.${extensionOf(main.path)}`,
      size: stored.size,
      purpose: "chat",
      head: stored.head,
    });
    if (!verdict.ok) {
      await removeObjects(main.bucket, [main.path]);
      await getDb().fileAsset.delete({ where: { id: main.id } });
      throw uploadError(verdict.reason);
    }

    let thumbPath: string | null = null;
    const thumbAsset = input.thumbAssetId
      ? await takeAsset(me, conversationId, input.thumbAssetId)
      : null;
    if (thumbAsset) {
      const thumb = await readHead(thumbAsset.bucket, thumbAsset.path);
      if (
        thumb &&
        thumb.size <= THUMB_MAX_BYTES &&
        checkUpload({
          mime: "image/jpeg",
          name: "t.jpg",
          size: thumb.size,
          purpose: "chat",
          head: thumb.head,
        }).ok
      ) {
        thumbPath = thumbAsset.path;
      } else {
        await removeObjects(thumbAsset.bucket, [thumbAsset.path]);
      }
    }

    const result = await sendMessage(me, conversationId, {
      clientId: input.clientId,
      type: messageTypeFor(verdict.rule.kind),
      body: input.caption?.trim() || null,
      replyToId: input.replyToId ?? null,
      meta: input.fileName ? { fileName: input.fileName } : null,
      attachment: {
        storagePath: main.path,
        thumbPath,
        mime: verdict.rule.mime,
        sizeBytes: stored.size,
        width: input.width ?? null,
        height: input.height ?? null,
        durationMs: input.durationMs ?? null,
        waveform: input.waveform ?? [],
      },
    });
    await getDb().fileAsset.updateMany({
      where: { id: { in: [main.id, ...(thumbAsset && thumbPath ? [thumbAsset.id] : [])] } },
      data: { status: "ATTACHED", sizeBytes: stored.size },
    });
    return result;
  }
  return sendMessage(me, conversationId, {
    clientId: input.clientId,
    type: "FILE",
    body: null,
  });
}

/** A short lived link to one attachment, for people in the conversation only (R15). */
export async function attachmentLink(
  me: User,
  attachmentId: string,
  thumb: boolean,
): Promise<string> {
  const row = await getDb().messageAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { select: { conversationId: true, deletedForEveryoneAt: true } } },
  });
  if (!row || row.message.deletedForEveryoneAt) throw notFound();
  await accessFor(me.id, row.message.conversationId);
  const path = thumb && row.thumbPath ? row.thumbPath : row.storagePath;
  return createSignedUrl(buckets.media(), path, 300);
}
