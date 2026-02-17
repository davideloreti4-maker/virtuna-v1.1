"use client";

import { MapPin, GenderFemale, GenderMale, User } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface PersonaCardProps {
  initials: string;
  name: string;
  role: string;
  company: string;
  bio: string;
  location: string;
  gender: "Male" | "Female" | "Non-binary";
  generation: string;
  className?: string;
}

export function PersonaCard({
  initials,
  name,
  role,
  company,
  bio,
  location,
  gender,
  generation,
  className,
}: PersonaCardProps) {
  const GenderIcon = gender === "Female" ? GenderFemale : GenderMale;

  return (
    <div
      className={cn(
        "bg-background-elevated rounded-lg p-4 w-72 shadow-lg",
        className
      )}
    >
      {/* Header: Avatar + Name/Role */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-sm font-medium">
          {initials}
        </div>
        <div>
          <div className="text-white font-medium">{name}</div>
          <div className="text-gray-400 text-sm">{role}</div>
        </div>
      </div>

      {/* Company & Bio */}
      <div className="mb-3">
        <div className="text-gray-400 text-sm">{company}</div>
        <div className="text-gray-300 text-sm mt-1">{bio}</div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin size={12} weight="fill" />
          {location}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <GenderIcon size={12} weight="fill" />
          {gender}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <User size={12} weight="fill" />
          {generation}
        </span>
      </div>
    </div>
  );
}
