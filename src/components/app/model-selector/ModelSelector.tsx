"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSimulationStore } from "@/stores/simulation-store";
import { useTiktokAccounts } from "@/hooks/use-tiktok-accounts";
import { ApolloTierSelector } from "./ApolloTierSelector";
import { OracleCard } from "./OracleCard";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  className?: string;
}

export function ModelSelector({ className }: ModelSelectorProps) {
  const modelFamily = useSimulationStore((s) => s.modelFamily);
  const setModelFamily = useSimulationStore((s) => s.setModelFamily);
  const nodeCount = useSimulationStore((s) => s.nodeCount);
  const { activeAccount } = useTiktokAccounts();

  return (
    <div className={cn(className)}>
      <Tabs
        value={modelFamily}
        onValueChange={(v) => setModelFamily(v as "apollo" | "oracle")}
      >
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="apollo" size="sm">
              Apollo
            </TabsTrigger>
            <TabsTrigger value="oracle" size="sm">
              Oracle
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="apollo">
          <ApolloTierSelector />
          <p className="text-xs text-foreground-muted text-center mt-3">
            {activeAccount
              ? `${nodeCount.toLocaleString()} personas modeled from @${activeAccount.handle}'s audience`
              : "Connect an account for personalized audience modeling"}
          </p>
        </TabsContent>

        <TabsContent value="oracle">
          <OracleCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
