"use client";

import * as Switch from "@radix-ui/react-switch";
import { useSettingsStore } from "@/stores/settings-store";
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium text-foreground"
        >
          {title}
        </label>
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 cursor-pointer rounded-full bg-white/[0.1] transition-colors data-[state=checked]:bg-accent"
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
  const notifications = useSettingsStore((s) => s.notifications);
  const updateNotifications = useSettingsStore((s) => s.updateNotifications);

  const handleToggle = (id: keyof NotificationPrefs, checked: boolean) => {
    updateNotifications({ [id]: checked });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-foreground">Notifications</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Choose what notifications you want to receive.
        </p>
      </div>

      {/* Email notifications */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-foreground-secondary">
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
      <p className="text-sm text-foreground-muted">
        You can unsubscribe from these emails at any time by clicking the link
        in the footer of any email you receive from us.
      </p>
    </div>
  );
}
