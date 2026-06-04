import { useEffect, useRef, useState } from "react";
import type { WidgetConfig } from "@a11yaudit/assist-widget";

const SAMPLE_BODY = `
  <main style="max-width:640px;margin:40px auto;font-family:system-ui;padding:0 20px">
    <h1>Örnek sayfa</h1>
    <p>Bu, widget'ın gerçek bir sayfada nasıl göründüğünü gösteren önizlemedir. Metni okuyun, butona tıklayın, tercihleri deneyin.</p>
    <p><a href="#">Örnek bağlantı</a> ve <button type="button">Örnek buton</button>.</p>
  </main>`;

// JSON embedded inside a <script> must not contain a literal </script>.
function safeJson(config: WidgetConfig): string {
  return JSON.stringify(config).replace(/<\/script/gi, "<\\/script");
}

export function buildPreviewSrcdoc(config: WidgetConfig, origin: string): string {
  return `<!doctype html><html lang="${config.language}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>${SAMPLE_BODY}
<script>window.__AA_ASSIST_CONFIG__=${safeJson(config)};</script>
<script src="${origin}/assist/a11yaudit-assist.js" defer></script>
</body></html>`;
}

export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [srcdoc, setSrcdoc] = useState(() => buildPreviewSrcdoc(config, origin));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce so typing in the CSS box doesn't reload on every keystroke.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSrcdoc(buildPreviewSrcdoc(config, origin)), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [config, origin]);

  return (
    <iframe
      title="widget-preview"
      srcDoc={srcdoc}
      style={{ width: "100%", height: 520, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }}
    />
  );
}
