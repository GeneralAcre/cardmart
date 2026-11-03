import { getOptionalUser } from "@/lib/session";
import type { TourId } from "@/lib/tours";
import { TourGuide } from "@/components/tour/tour-guide";

/**
 * The page's first-visit tour (lib/tours.ts). Drop it anywhere on the page;
 * it reads who's signed in and which tours they've finished.
 */
export async function PageTour({ id }: { id: TourId }) {
  const user = await getOptionalUser();
  return <TourGuide id={id} signedIn={user != null} done={user?.toursDone ?? []} />;
}
