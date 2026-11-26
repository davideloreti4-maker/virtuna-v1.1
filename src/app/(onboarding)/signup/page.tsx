import type { Metadata } from "next";
import { SignupNext } from "@/components/auth-next/signup-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up | Maven",
};

interface SignupPageProps {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  if (NEW_LOOK_ENABLED) return <SignupNext error={params.error} next={params.next} />;

  return (
    <SignupForm
      error={params.error}
      next={params.next}
    />
  );
}
