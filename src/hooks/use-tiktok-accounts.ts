"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type TiktokAccount = Tables<"tiktok_accounts">;

export function useTiktokAccounts() {
  const [accounts, setAccounts] = useState<TiktokAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeAccount = accounts.find((a) => a.is_active) ?? null;

  // Fetch accounts + legacy migration
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (existing && existing.length > 0) {
        setAccounts(existing);
        setIsLoading(false);
        return;
      }

      // Legacy migration: copy creator_profiles.tiktok_handle if present
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("tiktok_handle")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.tiktok_handle) {
        const { data: migrated } = await supabase
          .from("tiktok_accounts")
          .insert({
            user_id: user.id,
            handle: profile.tiktok_handle,
            is_active: true,
          })
          .select()
          .single();

        if (migrated) {
          setAccounts([migrated]);
        }
      }

      setIsLoading(false);
    }
    load();
  }, []);

  const switchAccount = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Deactivate all
      await supabase
        .from("tiktok_accounts")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Activate target
      await supabase
        .from("tiktok_accounts")
        .update({ is_active: true })
        .eq("id", id);

      setAccounts((prev) =>
        prev.map((a) => ({ ...a, is_active: a.id === id }))
      );
    },
    []
  );

  const addAccount = useCallback(async (handle: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Deactivate all existing
    await supabase
      .from("tiktok_accounts")
      .update({ is_active: false })
      .eq("user_id", user.id);

    // Insert new as active
    const { data: inserted } = await supabase
      .from("tiktok_accounts")
      .insert({
        user_id: user.id,
        handle: handle.replace(/^@/, ""),
        is_active: true,
      })
      .select()
      .single();

    if (inserted) {
      setAccounts((prev) => [
        ...prev.map((a) => ({ ...a, is_active: false })),
        inserted,
      ]);
    }
  }, []);

  const removeAccount = useCallback(
    async (id: string) => {
      const supabase = createClient();
      await supabase.from("tiktok_accounts").delete().eq("id", id);

      setAccounts((prev) => {
        const remaining = prev.filter((a) => a.id !== id);
        // If deleted was active, activate first remaining
        const deletedWasActive = prev.find((a) => a.id === id)?.is_active;
        if (deletedWasActive && remaining.length > 0) {
          const firstId = remaining[0]!.id;
          // Fire-and-forget DB update
          supabase
            .from("tiktok_accounts")
            .update({ is_active: true })
            .eq("id", firstId)
            .then();
          return remaining.map((a, i) => ({
            ...a,
            is_active: i === 0,
          }));
        }
        return remaining;
      });
    },
    []
  );

  return { accounts, activeAccount, isLoading, switchAccount, addAccount, removeAccount };
}
