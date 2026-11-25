import { CollectionNextLoading } from "@/components/discover-next/collection-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/** A collection's page while the library is read: its own outline under the new look. Without it the page does not exist. */
export default function CollectionLoading() {
  if (NEW_LOOK_ENABLED) return <CollectionNextLoading />;
  return null;
}
