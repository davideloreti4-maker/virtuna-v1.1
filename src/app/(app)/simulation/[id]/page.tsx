import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimulationScreen } from "@/components/result/simulation-screen";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Simulation | Maven" };

/**
 * `/simulation/[id]`: the result page of a video simulation (spec §8). New look only: with the flag
 * off this address does not exist and `/analyze/[id]` stays as it is.
 */
export default async function SimulationPage({ params }: PageProps) {
  if (!NEW_LOOK_ENABLED) notFound();
  const { id } = await params;
  return <SimulationScreen id={id} />;
}
