import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bit Office",
  description: "Control your AI agents from anywhere",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1a1530" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, backgroundColor: "#1a1530", color: "#eddcb8", fontFamily: "system-ui, sans-serif" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --px-bg-deep: #16122a;
            --px-bg-panel: #1e1a30;
            --px-bg-card: #231e38;
            --px-bg-chat: #1a1530;
            --px-border: #3d2e54;
            --px-border-warm: #5a3d14;
            --px-gold: #e8b040;
            --px-gold-dim: #a87820;
            --px-text: #eddcb8;
            --px-text-muted: #9a8a68;
            --px-text-dim: #6a5a48;
            --px-amber: #e0900a;
            --px-amber-bg: rgba(232, 176, 64, 0.14);
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: #5a3d14 #1a1530;
          }
          *::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          *::-webkit-scrollbar-track {
            background: transparent;
          }
          *::-webkit-scrollbar-thumb {
            background: #3d2d10;
            border-radius: 0;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: #e8b040;
          }
          *::-webkit-scrollbar-corner {
            background: transparent;
          }
          .px-font {
            font-family: 'Press Start 2P', monospace;
          }
          @keyframes px-blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes px-pulse-gold {
            0%, 100% { box-shadow: 0 0 0 0 rgba(200,155,48,0); }
            50% { box-shadow: 0 0 8px 2px rgba(200,155,48,0.25); }
          }
        `}} />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && location.hostname === 'localhost') {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  for (var r of regs) r.unregister();
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
