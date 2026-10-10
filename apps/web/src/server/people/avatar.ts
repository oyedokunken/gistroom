import { randomUUID } from "node:crypto";
import { getDb, type User } from "@gistroom/db";
import { checkUpload, errors, extensionOf, type SignedUpload } from "@gistroom/shared";
import { AppError } from "../http";
import { enforce, policies } from "../rate-limit";
import { buckets, createSignedUploadUrl, readHead, removeObjects } from "../storage";
import { uploadError } from "../chat/media";

const folder = (userId: string) => `${userId}/`;

/** Step one: a photo up to 5 MB. Avatars are the only public files, so they are checked twice. */
export async function signAvatarUpload(
  me: User,
  input: { name: string; mime: string; size: number },
): Promise<SignedUpload> {
  await enforce(policies.mediaSign, me.id);
  const verdict = checkUpload({ ...input, purpose: "avatar" });
  if (!verdict.ok) throw uploadError(verdict.reason);
  const bucket = buckets.avatars();
  const path = `${folder(me.id)}${randomUUID()}.${extensionOf(input.name) || "jpg"}`;
  const asset = await getDb().fileAsset.create({
    data: { ownerId: me.id, bucket, path, mime: verdict.rule.mime, sizeBytes: input.size },
  });
  return { assetId: asset.id, uploadUrl: await createSignedUploadUrl(bucket, path) };
}

/** Step two: confirm the stored file is an image, make it the profile photo and delete the old one. */
export async function commitAvatar(me: User, assetId: string): Promise<{ path: string }> {
  const asset = await getDb().fileAsset.findUnique({ where: { id: assetId } });
  if (
    !asset ||
    asset.ownerId !== me.id ||
    asset.status !== "PENDING" ||
    !asset.path.startsWith(folder(me.id))
  ) {
    throw new AppError(404, "NOT_FOUND", errors.uploadMissing);
  }
  const stored = await readHead(asset.bucket, asset.path);
  if (!stored) throw new AppError(404, "NOT_FOUND", errors.uploadMissing);
  const verdict = checkUpload({
    mime: asset.mime,
    name: `a.${extensionOf(asset.path)}`,
    size: stored.size,
    purpose: "avatar",
    head: stored.head,
  });
  if (!verdict.ok) {
    await removeObjects(asset.bucket, [asset.path]);
    await getDb().fileAsset.delete({ where: { id: asset.id } });
    throw uploadError(verdict.reason);
  }
  const previous = me.avatarPath;
  await getDb().$transaction([
    getDb().user.update({ where: { id: me.id }, data: { avatarPath: asset.path } }),
    getDb().fileAsset.update({ where: { id: asset.id }, data: { status: "ATTACHED" } }),
  ]);
  if (previous && previous !== asset.path) await removeObjects(asset.bucket, [previous]);
  return { path: asset.path };
}

export async function removeAvatar(me: User): Promise<void> {
  if (!me.avatarPath) return;
  await getDb().user.update({ where: { id: me.id }, data: { avatarPath: null } });
  await removeObjects(buckets.avatars(), [me.avatarPath]);
}
