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
      <div className="w-full max-w-sm rounded-3xl border border-[rgb(var(--line))] bg-neutral-900 p-8 shadow-[var(--shadow-card)]">
        <Image
          src="/logo.png"
          alt="CyLiis Remora"
          width={76}
          height={76}
          className="mb-5"
          priority
        />
        <h1 className="text-2xl font-bold tracking-tight">CyLiis Remora</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Sign in with Discord to manage events, reminders and presence for your
          server.
        </p>
        {error ? (
          <p className="mt-5 rounded-xl border border-[rgba(224,92,92,0.28)] bg-[rgba(229,109,109,0.1)] px-3 py-2 text-sm text-[#E56D6D]">
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
