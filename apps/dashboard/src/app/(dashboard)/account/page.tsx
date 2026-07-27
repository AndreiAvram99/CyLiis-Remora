import { requireMember } from "@/lib/session";
import { Badge } from "@/components/ui";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireMember();
  const isManager = Boolean(session.user?.isManager);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {session.user?.name ?? "Account"}
          </h1>
          <Badge
            className={
              isManager
                ? "bg-palette-sky/20 text-palette-sky"
                : "bg-neutral-800 text-neutral-400"
            }
          >
            {isManager ? "Manager" : "View only"}
          </Badge>
        </div>
        <p className="text-sm text-neutral-400">
          Personalize how the dashboard looks for you.
        </p>
      </div>
      <AccountForm name={session.user?.name} />
    </div>
  );
}
