"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { updateUser } from "@/lib/users";
import { profileSchema } from "@/lib/validators";

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  profile: profileSchema,
});

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveSettingsAction(input: unknown): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid. Please check your information." };
  }

  const updated = await updateUser(session.user.id, (user) => {
    user.name = parsed.data.name;
    user.profile = parsed.data.profile;
  });
  if (!updated) return { ok: false, error: "Your account could not be found." };

  await logEvent(session.user.id, "user.profile_updated", {
    fields: Object.keys(parsed.data.profile),
    nameChanged: updated.name !== session.user.name,
  });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}
