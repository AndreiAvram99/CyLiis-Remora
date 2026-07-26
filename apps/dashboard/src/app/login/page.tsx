import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session?.user?.isMember) {
    redirect("/events");
  }
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <Image
          src="/logo.png"
          alt="CyLiis Remora"
          width={72}
          height={72}
          className="mb-4"
          priority
        />
        <h1 className="text-2xl font-semibold">CyLiis Remora</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sign in with Discord to manage events, reminders and presence for your
          server.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error === "AccessDenied"
              ? "You need to be a member of the Discord server to sign in."
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
