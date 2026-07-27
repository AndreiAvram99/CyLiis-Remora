import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyLiis Remora",
  description: "Schedule Discord events and reminders synced with Google Calendar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('remora:accent');if(a){var c=a.replace('#','');var r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);var l=(0.299*r+0.587*g+0.114*b)/255;var d=document.documentElement;d.style.setProperty('--brand',a);d.style.setProperty('--brand-fg',l>0.6?'#023047':'#ffffff');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
