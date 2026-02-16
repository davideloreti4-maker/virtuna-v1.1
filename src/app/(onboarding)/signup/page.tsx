import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up | Virtuna",
};

interface SignupPageProps {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return (
    <SignupForm
      error={params.error}
      next={params.next}
    />
  );
}
