import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session?.user?.isAdmin) {
    redirect("/events");
  }
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Event Reminder</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sign in with Discord to manage events, reminders and outreach for your
          server.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error === "AccessDenied"
              ? "That Discord account is not authorized for this dashboard."
              : "Sign in failed. Please try again."}
          </p>
        ) : null}
        <div className="mt-6">
          <LoginButton />
        </div>
      </div>
    </main>
  );
}
