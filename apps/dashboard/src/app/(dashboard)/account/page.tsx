import Link from "next/link";
import { Settings, ChevronRight } from "lucide-react";
import { requireMember } from "@/lib/session";
import { Badge, Card } from "@/components/ui";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireMember();
  const isManager = Boolean(session.user?.isManager);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
            {session.user?.name ?? "Account"}
          </h1>
          <Badge
            className={
              isManager
                ? "bg-palette-azure/10 text-palette-sky"
                : "bg-neutral-800 text-neutral-400"
            }
          >
            {isManager ? "Manager" : "View only"}
          </Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Personalize how the dashboard looks for you.
        </p>
      </div>
      <AccountForm
        name={session.user?.name}
        discordAvatar={session.user?.image}
      />

      {isManager ? (
        <Link href="/settings" className="block">
          <Card className="flex items-center gap-4 p-5 transition hover:border-brand/40">
            <Settings size={20} className="shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-100">Server settings</p>
              <p className="text-sm text-neutral-500">
                Timezone, channels and default reminders for the whole team.
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-neutral-500" />
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
