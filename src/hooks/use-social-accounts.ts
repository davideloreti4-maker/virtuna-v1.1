"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type TiktokAccountRow = Tables<"tiktok_accounts">;

export type Platform = "tiktok" | "instagram";

export interface SocialAccount {
  id: string;
  handle: string;
  platform: Platform;
  is_active: boolean;
  created_at: string;
  user_id: string;
}

// Custom event for cross-component sync (top bar chip <-> sidebar selector)
const ACCOUNTS_CHANGED_EVENT = "social-accounts-changed";

function rowToSocialAccount(row: TiktokAccountRow): SocialAccount {
  return {
    id: row.id,
    handle: row.handle,
    platform: (row.platform as Platform) ?? "tiktok",
    is_active: row.is_active,
    created_at: row.created_at,
    user_id: row.user_id,
  };
}

export function useSocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const skipNextEventRef = useRef(false);

  const activeAccount = accounts.find((a) => a.is_active) ?? null;

  const fetchAccounts = useCallback(async () => {
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
      setAccounts(existing.map(rowToSocialAccount));
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
          platform: "tiktok",
        })
        .select()
        .single();

      if (migrated) {
        setAccounts([rowToSocialAccount(migrated)]);
      }
    }

    setIsLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  // Cross-instance sync: re-fetch when another component mutates accounts
  useEffect(() => {
    function handleAccountsChanged() {
      if (skipNextEventRef.current) {
        skipNextEventRef.current = false;
        return;
      }
      fetchAccounts();
    }
    window.addEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
    return () =>
      window.removeEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
  }, [fetchAccounts]);

  function dispatchChange() {
    skipNextEventRef.current = true;
    window.dispatchEvent(new CustomEvent(ACCOUNTS_CHANGED_EVENT));
  }

  const switchAccount = useCallback(async (id: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("tiktok_accounts")
      .update({ is_active: false })
      .eq("user_id", user.id);

    await supabase
      .from("tiktok_accounts")
      .update({ is_active: true })
      .eq("id", id);

    setAccounts((prev) =>
      prev.map((a) => ({ ...a, is_active: a.id === id })),
    );
    dispatchChange();
  }, []);

  const addAccount = useCallback(
    async (handle: string, platform: Platform = "tiktok") => {
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
          platform,
        })
        .select()
        .single();

      if (inserted) {
        setAccounts((prev) => [
          ...prev.map((a) => ({ ...a, is_active: false })),
          rowToSocialAccount(inserted),
        ]);
      }
      dispatchChange();
    },
    [],
  );

  const removeAccount = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("tiktok_accounts").delete().eq("id", id);

    setAccounts((prev) => {
      const remaining = prev.filter((a) => a.id !== id);
      const deletedWasActive = prev.find((a) => a.id === id)?.is_active;
      if (deletedWasActive && remaining.length > 0) {
        const firstId = remaining[0]!.id;
        // Fire-and-forget DB update
        supabase
          .from("tiktok_accounts")
          .update({ is_active: true })
          .eq("id", firstId)
          .then();
        return remaining.map((a, i) => ({ ...a, is_active: i === 0 }));
      }
      return remaining;
    });
    dispatchChange();
  }, []);

  return {
    accounts,
    activeAccount,
    isLoading,
    switchAccount,
    addAccount,
    removeAccount,
  };
}
