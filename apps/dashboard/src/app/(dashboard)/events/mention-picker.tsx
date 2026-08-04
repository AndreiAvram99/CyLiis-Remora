"use client";

import { useMemo, useState } from "react";
import { AtSign, Search } from "lucide-react";
import { Label } from "@/components/ui";

export interface MentionOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface MentionValue {
  roleIds: string[];
  userIds: string[];
  everyone: boolean;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
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

function Chip({
  label,
  on,
  onClick,
  tone = "brand",
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  tone?: "brand" | "warn";
}) {
  const active =
    tone === "warn"
      ? "border-[rgba(224,92,92,0.45)] bg-[rgba(229,109,109,0.12)] text-[#E56D6D]"
      : "border-brand bg-brand/10 text-neutral-100";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-2.5 py-1 text-sm transition ${
        on
          ? active
          : "border-[rgb(var(--line))] text-neutral-300 hover:bg-neutral-800/60"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Who gets pinged when this schedule is announced. Roles and individual members
 * are independent, so a manager can tag a whole role, a couple of people, or
 * both — and picking nothing means the post stays silent.
 */
export function MentionPicker({
  roles,
  members,
  value,
  onChange,
}: {
  roles: MentionOption[];
  members: MentionOption[];
  value: MentionValue;
  onChange: (next: MentionValue) => void;
}) {
  const [query, setQuery] = useState("");
  const pickedUsers = useMemo(() => new Set(value.userIds), [value.userIds]);
  const pickedRoles = useMemo(() => new Set(value.roleIds), [value.roleIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? members.filter((m) => m.name.toLowerCase().includes(q))
      : members;
    // Keep chosen members visible even when a search would hide them.
    const chosen = members.filter((m) => pickedUsers.has(m.id));
    return [...new Set([...chosen, ...list])];
  }, [members, query, pickedUsers]);

  const toggleRole = (id: string) =>
    onChange({
      ...value,
      roleIds: pickedRoles.has(id)
        ? value.roleIds.filter((r) => r !== id)
        : [...value.roleIds, id],
    });

  const toggleUser = (id: string) =>
    onChange({
      ...value,
      userIds: pickedUsers.has(id)
        ? value.userIds.filter((u) => u !== id)
        : [...value.userIds, id],
    });

  const total =
    value.roleIds.length + value.userIds.length + (value.everyone ? 1 : 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>Tags to ping</Label>
        {total > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ roleIds: [], userIds: [], everyone: false })}
            className="text-xs text-neutral-400 transition hover:text-neutral-100"
          >
            Clear all
          </button>
        ) : (
          <span className="text-xs text-neutral-500">No one is pinged</span>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--input))] p-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="@everyone"
            tone="warn"
            on={value.everyone}
            onClick={() => onChange({ ...value, everyone: !value.everyone })}
          />
          {roles.map((r) => (
            <Chip
              key={r.id}
              label={`@${r.name}`}
              on={pickedRoles.has(r.id)}
              onClick={() => toggleRole(r.id)}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))]">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--line))] px-3 py-2">
            <Search size={14} className="shrink-0 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tag someone individually…"
              className="w-full bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600"
            />
            {value.userIds.length > 0 ? (
              <span className="shrink-0 text-xs text-neutral-500">
                {value.userIds.length} tagged
              </span>
            ) : null}
          </div>

          <div className="max-h-48 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-sm text-neutral-600">
                No member matches that.
              </p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {filtered.map((m) => {
                  const on = pickedUsers.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleUser(m.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                        on
                          ? "border-brand bg-brand/10 text-neutral-100"
                          : "border-transparent text-neutral-300 hover:bg-neutral-800/60"
                      }`}
                    >
                      <AtSign
                        size={13}
                        className={on ? "shrink-0 text-brand" : "shrink-0 text-neutral-600"}
                      />
                      <Avatar name={m.name} avatarUrl={m.avatarUrl} />
                      <span className="min-w-0 truncate">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Applies to the announcement and every reminder for this schedule.
      </p>
    </div>
  );
}
