import type { Metadata } from "next";
import "./globals.css";

const themeInitializationScript = `
  (() => {
    let theme = "dark";
    try {
      const stored = window.localStorage.getItem("latency-theme");
      theme = stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    } catch {
      theme = "dark";
    }
    document.documentElement.dataset.theme = theme;
  })();
`;

export const metadata: Metadata = {
  title: "Latency Space",
  description:
    "A map of Europe where distance is network latency, not geography. Drag the slider and the continent morphs into the shape the internet actually has, measured from the RIPE Atlas anchoring mesh.",
  applicationName: "Latency Space",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
