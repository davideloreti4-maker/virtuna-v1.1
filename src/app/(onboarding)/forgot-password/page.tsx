import type { Metadata } from "next";

import { ForgotPasswordNext } from "@/components/auth-next/password-reset-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset Password | Maven",
};

export default function ForgotPasswordPage() {
  return NEW_LOOK_ENABLED ? <ForgotPasswordNext /> : <ForgotPasswordForm />;
}
