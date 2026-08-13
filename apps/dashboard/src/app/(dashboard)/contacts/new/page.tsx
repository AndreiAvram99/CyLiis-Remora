import { requireManager } from "@/lib/session";
import { ContactForm } from "../contact-form";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requireManager();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-[38px] sm:leading-tight">
        New contact
      </h1>
      <ContactForm />
    </div>
  );
}
