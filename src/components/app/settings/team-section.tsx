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
import { useSettingsStore } from "@/stores/settings-store";
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
  member: TeamMember;
  isCurrentUser: boolean;
  onRoleChange: (role: TeamMember["role"]) => void;
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

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3">
        <Avatar.Root className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
          <Avatar.Image
            src={member.avatar}
            alt={member.name}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-400">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{member.name}</span>
            {isCurrentUser && (
              <span className="text-xs text-zinc-500">(you)</span>
            )}
          </div>
          <span className="text-sm text-zinc-400">{member.email}</span>
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
  const team = useSettingsStore((s) => s.team);
  const profile = useSettingsStore((s) => s.profile);
  const addTeamMember = useSettingsStore((s) => s.addTeamMember);
  const removeTeamMember = useSettingsStore((s) => s.removeTeamMember);
  const updateTeamMemberRole = useSettingsStore((s) => s.updateTeamMemberRole);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800));

    // Mock: add as member with email as name
    const name = inviteEmail.split("@")[0]!.replace(/[._]/g, " ");
    addTeamMember({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email: inviteEmail,
      role: "member",
    });

    setInviteEmail("");
    setInviting(false);
  };

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
            />
          </div>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {inviting ? "Inviting..." : "Send invite"}
          </button>
        </div>
      </div>

      {/* Team members list */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          Team members ({team.length})
        </h3>
        <div className="space-y-3">
          {team.map((member) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              isCurrentUser={member.email === profile.email}
              onRoleChange={(role) => updateTeamMemberRole(member.id, role)}
              onRemove={() => removeTeamMember(member.id)}
            />
          ))}
        </div>
      </div>

      {/* Empty state - shown when no other members */}
      {team.length === 1 && (
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
