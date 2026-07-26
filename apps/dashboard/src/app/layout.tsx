import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Reminder Dashboard",
  description: "Schedule Discord events and reminders synced with Google Calendar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
