/**
 * Every word of the new-look auth screens (sign in, sign up, forgot and set a password). The
 * sentences the server actions and `@/lib/auth/otp` write (refusals, "Check your email…") arrive
 * as they are and are shown as written.
 */
import { OTP_LENGTH } from "@/lib/auth/otp";

export const HOME_LABEL = "Maven home";

export const LOGIN_TITLE = "Welcome back";
export const LOGIN_LINE = "Sign in to pick up where you left off.";
export const SIGNUP_TITLE = "Create your account";
export const SIGNUP_LINE = "Start with Google or your email.";
export const FORGOT_TITLE = "Reset your password";
export const FORGOT_LINE = "We'll email you a link to set a new one.";
export const FORGOT_SENT_LINE = "Check your inbox.";
export const FORGOT_SENT =
  "If an account exists for that email, a reset link is on its way. The link works for one hour.";
export const RESET_TITLE = "Set a new password";
export const RESET_LINE = "You're signed in. Choose the new password for your account.";

export const GOOGLE = "Continue with Google";
export const OR = "or";
export const EMAIL = "Email";
export const EMAIL_PLACEHOLDER = "you@email.com";
export const PASSWORD = "Password";
export const NEW_PASSWORD = "New password";
export const PASSWORD_AGAIN = "Password again";
export const CONTINUE = "Continue";
export const SENDING = "Sending…";
export const CHECKING = "Checking…";
export const CODE_HINT = `We'll email you a ${OTP_LENGTH}-digit code. No password needed.`;
export const CODE_SENT_TO = "We sent a code to";
export const CODE_LABEL = `${OTP_LENGTH}-digit code`;
export const RESEND = "Resend code";
export const resendIn = (seconds: number) => `Resend in ${seconds}s`;
export const CHANGE_EMAIL = "Change email";

export const PASSWORD_INSTEAD = "Sign in with a password instead";
export const FORGOT_LINK = "Forgot password?";
export const SIGN_IN = "Sign in";
export const CREATE_ACCOUNT = "Create account";
export const SEND_LINK = "Send reset link";
export const SAVE_PASSWORD = "Save new password";

export const NO_ACCOUNT = "No account yet?";
export const SIGN_UP = "Sign up";
export const HAVE_ACCOUNT = "Already have an account?";
export const REMEMBERED = "Remembered it?";

export const EXPIRED = "Your session ended. Sign in again.";
export const DELETED = "Your account was deleted.";

export const SIGNUP_PASSWORD_HINT = "At least 6 characters.";
export const RESET_PASSWORD_HINT = "At least 8 characters.";
export const PASSWORDS_DIFFER = "Those passwords don't match.";
