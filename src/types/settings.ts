// src/types/settings.ts

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string; // URL or null for initials fallback
  company?: string;
  role?: string;
}

export interface NotificationPrefs {
  emailUpdates: boolean; // Product updates and news
  testResults: boolean; // Notifications when tests complete
  weeklyDigest: boolean; // Weekly summary email
  marketingEmails: boolean; // Promotional content
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  avatar?: string;
  joinedAt: string; // ISO date string
}

export interface BillingInfo {
  plan: "free" | "starter" | "pro";
  status: "active" | "cancelled" | "expired" | "past_due";
  whopConnected: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null; // ISO date string
  creditsRemaining: number;
  creditsTotal: number;
}
