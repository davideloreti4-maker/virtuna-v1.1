"use client";

import { Users } from "lucide-react";

export function TeamSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-foreground">Team</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage your team members and their permissions.
        </p>
      </div>

      {/* Coming soon placeholder */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] px-6 py-16 text-center">
        <Users className="h-12 w-12 text-foreground-muted" />
        <h3 className="mt-4 text-base font-medium text-foreground">
          Team Management
        </h3>
        <p className="mt-2 max-w-sm text-sm text-foreground-muted">
          Collaborate with your team — invite members, assign roles, and manage
          permissions. Coming soon.
        </p>
      </div>
    </div>
  );
}
