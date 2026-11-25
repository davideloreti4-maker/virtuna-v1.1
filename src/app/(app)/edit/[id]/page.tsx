import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorScreen } from "@/components/editor/editor-screen";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit | Maven" };

/**
 * `/edit/[id]`: the editor of one edit (spec 2026-11-24-editor-screens-design.md E1; plan 2026-11-24-editor-screens-a, Task 15).
 * New look only: with the flag off this address does not exist. Its routes are behind the edit tool's gate; the page says so.
 * Keyed by the edit: the page's state is one edit's, so another edit mounts the screen anew (ruling R20).
 */
export default async function EditPage({ params }: PageProps) {
  if (!NEW_LOOK_ENABLED) notFound();
  const { id } = await params;
  return <EditorScreen key={id} id={id} />;
}
