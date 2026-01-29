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
  plan: "free" | "pro" | "enterprise";
  pricePerMonth: number;
  creditsRemaining: number;
  creditsTotal: number;
  renewalDate: string; // ISO date string
}
