import type { Metadata } from "next";
import { LoginNext } from "@/components/auth-next/login-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In | Maven",
};

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    expired?: string;
    next?: string;
    message?: string;
    /** `1` after an account is deleted (Settings, spec 2026-11-26-settings 2.4). */
    deleted?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  if (NEW_LOOK_ENABLED) {
    return (
      <LoginNext
        error={params.error}
        expired={params.expired === "true"}
        next={params.next}
        message={params.message}
        deleted={params.deleted === "1"}
      />
    );
  }

  const form = (
    <LoginForm
      error={params.error}
      expired={params.expired === "true"}
      next={params.next}
      message={params.message}
    />
  );
  if (params.deleted !== "1") return form;

  return (
    <>
      <p role="status" className="mb-4 w-full max-w-[400px] text-center text-sm text-foreground">
        Your account was deleted.
      </p>
      {form}
    </>
  );
}
