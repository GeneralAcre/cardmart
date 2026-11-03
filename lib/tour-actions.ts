"use server";

import { getOptionalUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isTourId, tourXp } from "@/lib/tours";

export interface CompleteToursResult {
  signedIn: boolean;
  /** XP the newly finished tours added (0 if they were already counted). */
  xpGained: number;
  /** How many tours are now done in all. */
  done: number;
}

/**
 * Records finished page tours for the signed-in user. Also how tours finished
 * as a guest are carried over once they sign in (components/tour/tour-guide.tsx
 * keeps those in the browser until then).
 */
export async function completeTours(ids: string[]): Promise<CompleteToursResult> {
  const user = await getOptionalUser();
  if (!user) return { signedIn: false, xpGained: 0, done: 0 };

  const before = user.toursDone.filter(isTourId);
  const added = [...new Set(ids)].filter((id) => isTourId(id) && !before.includes(id));
  if (added.length === 0) return { signedIn: true, xpGained: 0, done: before.length };

  const after = [...before, ...added];
  await prisma.user.update({ where: { id: user.id }, data: { toursDone: after } });
  return { signedIn: true, xpGained: tourXp(after.length) - tourXp(before.length), done: after.length };
}
