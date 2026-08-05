"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Label } from "@/components/ui";

export interface AttendeeOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AttendeeRole {
  id: string;
  name: string;
  memberIds: string[];
}

export interface AttendeeRoster {
  roles: AttendeeRole[];
  members: AttendeeOption[];
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-neutral-300">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function AttendeePicker({
  roster,
  selected,
  onChange,
}: {
  roster: AttendeeRoster;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const picked = useMemo(() => new Set(selected), [selected]);
  const { roles, members } = roster;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  function toggle(id: string) {
    onChange(
      picked.has(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  function toggleRole(role: AttendeeRole, everyone: boolean) {
    if (everyone) {
      const drop = new Set(role.memberIds);
      onChange(selected.filter((s) => !drop.has(s)));
      return;
    }
    onChange([...new Set([...selected, ...role.memberIds])]);
  }

  if (members.length === 0) {
    return (
      <div>
        <Label>Expected attendees</Label>
        <p className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] px-3 py-3 text-sm text-neutral-500">
          No members found. Check that the bot has &quot;Server Members
          Intent&quot; enabled.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>Expected attendees</Label>
        <span className="text-xs text-neutral-500">
          {selected.length} of {members.length} selected
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))]">
        {/* One tap invites (or drops) everyone holding the role. */}
        {roles.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[rgb(var(--line))] px-3 py-2">
            <span className="mr-0.5 text-xs uppercase tracking-wide text-neutral-600">
              By role
            </span>
            {roles.map((role) => {
              const all = role.memberIds.every((id) => picked.has(id));
              const some = !all && role.memberIds.some((id) => picked.has(id));
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role, all)}
                  aria-pressed={all}
                  title={
                    all
                      ? `Remove everyone with ${role.name}`
                      : `Select everyone with ${role.name}`
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${
                    all
                      ? "border-brand bg-brand/10 text-neutral-100"
                      : some
                        ? "border-brand/40 text-neutral-200 hover:bg-neutral-800/60"
                        : "border-[rgb(var(--line))] text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                  }`}
                >
                  {all ? <Check size={12} /> : <Plus size={12} />}
                  {role.name}
                  <span className="text-neutral-600">
                    {role.memberIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-b border-[rgb(var(--line))] px-3 py-2">
          <Search size={14} className="shrink-0 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
          />
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="shrink-0 text-xs text-neutral-400 transition hover:text-neutral-100"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="max-h-72 overflow-y-auto px-3 py-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-neutral-600">No member matches that.</p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {filtered.map((m) => {
                const on = picked.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                      on
                        ? "border-brand bg-brand/10 text-neutral-100"
                        : "border-transparent text-neutral-300 hover:bg-neutral-800/60"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on
                          ? "border-brand bg-brand text-white"
                          : "border-neutral-600"
                      }`}
                      aria-hidden
                    >
                      {on ? "✓" : ""}
                    </span>
                    <Avatar name={m.name} avatarUrl={m.avatarUrl} />
                    <span className="min-w-0 truncate">{m.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Anyone selected who doesn&apos;t answer Going or Motivation shows up in
        the missing list on Presence, and gets a black mark once the meeting
        starts.
      </p>
    </div>
  );
}
