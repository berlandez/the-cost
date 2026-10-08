import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "The Cost · Outside Lands food/set planner",
    description: "Pick the sets and dishes you want. See exactly how many minutes of music each food stop costs.",
    openGraph: {
      title: "The Cost",
      description: "Outside Lands food decisions, measured in minutes of music.",
      images: [{ url: new URL("/og.png", origin).toString() }],
    },
    twitter: {
      card: "summary_large_image",
      title: "The Cost",
      description: "Outside Lands food decisions, measured in minutes of music.",
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
