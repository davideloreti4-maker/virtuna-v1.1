"use client";

import { useState } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MoreHorizontal,
  UserPlus,
  Mail,
  Crown,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeam,
  useInviteTeamMember,
  useUpdateMemberRole,
  useRemoveTeamMember,
} from "@/hooks/queries/use-team";
import { Input } from "@/components/ui";
import type { TeamMember } from "@/types/settings";

const ROLE_BADGES: Record<
  TeamMember["role"],
  { label: string; color: string; icon: typeof Crown }
> = {
  owner: {
    label: "Owner",
    color: "text-amber-400 bg-amber-400/10",
    icon: Crown,
  },
  admin: {
    label: "Admin",
    color: "text-blue-400 bg-blue-400/10",
    icon: Shield,
  },
  member: {
    label: "Member",
    color: "text-zinc-400 bg-zinc-400/10",
    icon: User,
  },
};

interface TeamMemberRowProps {
  member: {
    id: string;
    user_id: string | null;
    role: TeamMember["role"];
    invited_email: string | null;
    status: string;
    joined_at: string | null;
  };
  isCurrentUser: boolean;
  onRoleChange: (role: "admin" | "member") => void;
  onRemove: () => void;
}

function TeamMemberRow({
  member,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: TeamMemberRowProps) {
  const badge = ROLE_BADGES[member.role];
  const BadgeIcon = badge.icon;
  const displayName = member.invited_email?.split("@")[0] || "Unknown";
  const displayEmail = member.invited_email || "";

  const initials = displayName
    .split(/[.\-_\s]/)
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3">
        <Avatar.Root className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-400">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{displayName}</span>
            {isCurrentUser && (
              <span className="text-xs text-zinc-500">(you)</span>
            )}
            {member.status === "invited" && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                Invited
              </span>
            )}
          </div>
          <span className="text-sm text-zinc-400">{displayEmail}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            badge.color
          )}
        >
          <BadgeIcon className="h-3 w-3" />
          {badge.label}
        </span>

        {!isCurrentUser && member.role !== "owner" && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[160px] rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl"
                sideOffset={5}
                align="end"
              >
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none hover:bg-zinc-800"
                  onClick={() => onRoleChange("admin")}
                >
                  <Shield className="h-4 w-4" />
                  Make admin
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none hover:bg-zinc-800"
                  onClick={() => onRoleChange("member")}
                >
                  <User className="h-4 w-4" />
                  Make member
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-zinc-800" />
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-900/20"
                  onClick={onRemove}
                >
                  Remove
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </div>
  );
}

export function TeamSection() {
  const { data, isLoading } = useTeam();
  const inviteMember = useInviteTeamMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveTeamMember();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError("");

    try {
      await inviteMember.mutateAsync(inviteEmail);
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-6 w-16 rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-64 rounded bg-zinc-800" />
        </div>
        <div className="h-32 rounded-lg bg-zinc-800" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  const members = data?.members || [];
  const currentUserId = data?.currentUserId;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Team</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your team members and their permissions.
        </p>
      </div>

      {/* Invite section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-medium text-white">Invite team member</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Send an invite to add someone to your team.
        </p>
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="pl-10"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
          </div>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviteMember.isPending || !inviteEmail.trim()}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {inviteMember.isPending ? "Inviting..." : "Send invite"}
          </button>
        </div>
        {inviteError && (
          <p className="mt-2 text-sm text-red-400">{inviteError}</p>
        )}
      </div>

      {/* Team members list */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          Team members ({members.length})
        </h3>
        <div className="space-y-3">
          {members.map((member) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              isCurrentUser={member.user_id === currentUserId}
              onRoleChange={(role) =>
                updateRole.mutate({ memberId: member.id, role })
              }
              onRemove={() => removeMember.mutate(member.id)}
            />
          ))}
        </div>
      </div>

      {/* Empty state - shown when no other members */}
      {members.length <= 1 && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            You&apos;re the only team member. Invite others to collaborate!
          </p>
        </div>
      )}
    </div>
  );
}
