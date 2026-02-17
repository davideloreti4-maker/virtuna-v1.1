"use client";

import * as Switch from "@radix-ui/react-switch";
import { useProfile, useUpdateNotifications } from "@/hooks/queries/use-profile";
import type { NotificationPrefs } from "@/types/settings";

interface NotificationItemProps {
  id: keyof NotificationPrefs;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function NotificationItem({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: NotificationItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium text-white"
        >
          {title}
        </label>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 cursor-pointer rounded-full bg-zinc-700 transition-colors data-[state=checked]:bg-emerald-600"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}

const NOTIFICATION_OPTIONS: {
  id: keyof NotificationPrefs;
  title: string;
  description: string;
}[] = [
  {
    id: "emailUpdates",
    title: "Product updates",
    description:
      "Get notified about new features, improvements, and updates to the platform.",
  },
  {
    id: "testResults",
    title: "Test results",
    description:
      "Receive notifications when your tests complete and results are ready.",
  },
  {
    id: "weeklyDigest",
    title: "Weekly digest",
    description: "A weekly summary of your test activity and key insights.",
  },
  {
    id: "marketingEmails",
    title: "Marketing emails",
    description:
      "Occasional emails about tips, best practices, and promotional offers.",
  },
];

export function NotificationsSection() {
  const { data: profile, isLoading } = useProfile();
  const updateNotifications = useUpdateNotifications();

  const notifications = profile?.notifications ?? {
    emailUpdates: true,
    testResults: true,
    weeklyDigest: false,
    marketingEmails: false,
  };

  const handleToggle = (id: keyof NotificationPrefs, checked: boolean) => {
    updateNotifications.mutate({ [id]: checked });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-6 w-32 rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-64 rounded bg-zinc-800" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Notifications</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose what notifications you want to receive.
        </p>
      </div>

      {/* Email notifications */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          Email notifications
        </h3>
        <div className="space-y-3">
          {NOTIFICATION_OPTIONS.map((option) => (
            <NotificationItem
              key={option.id}
              id={option.id}
              title={option.title}
              description={option.description}
              checked={notifications[option.id]}
              onCheckedChange={(checked) => handleToggle(option.id, checked)}
            />
          ))}
        </div>
      </div>

      {/* Info text */}
      <p className="text-sm text-zinc-500">
        You can unsubscribe from these emails at any time by clicking the link
        in the footer of any email you receive from us.
      </p>
    </div>
  );
}
