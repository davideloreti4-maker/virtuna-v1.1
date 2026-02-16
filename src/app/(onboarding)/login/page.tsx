import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In | Virtuna",
};

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    expired?: string;
    next?: string;
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <LoginForm
      error={params.error}
      expired={params.expired === "true"}
      next={params.next}
      message={params.message}
    />
  );
}
