import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextResultScreen } from "@/components/result/text-result-screen";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { textResultAsOf } from "@/lib/result/text-result";

interface PageProps {
  params: Promise<{ threadId: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { title: "Simulation | Maven" };

/**
 * `/simulation/hook/[threadId]/[key]` (`?as=idea|opening`): the result page of a text simulation
 * (thread answers step 2, spec §4). New look only: with the flag off this address does not exist.
 */
export default async function TextResultPage({ params, searchParams }: PageProps) {
  if (!NEW_LOOK_ENABLED) notFound();
  const { threadId, key } = await params;
  const { as } = await searchParams;
  return <TextResultScreen threadId={threadId} sealKey={key} as={textResultAsOf(Array.isArray(as) ? as[0] : as)} />;
}
