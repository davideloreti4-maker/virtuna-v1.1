import { ImageResponse } from "next/og";

import { MARK_PATH_NEXT } from "./maven-logo";

/**
 * The new-look link preview (1200 x 630), drawn by `next/og` for both opengraph-image routes when
 * `NEXT_PUBLIC_NEW_LOOK` is on. The lockup from the sidebar at display size: the coral mark against
 * an ink "Maven" on the light page ground. Satori takes inline styles and literal colours only, so
 * the values mirror the light new-look tokens (background #f9f9f7, foreground #191918).
 *
 * Satori renders a variable font at its default instance (400), so `og-fonts/` holds two static
 * Inter instances cut from `public/edit/fonts/inter/Inter.ttf` (wght 680 and 400, opsz 32, subset
 * to printable ASCII): the wordmark's 680 is the sidebar lockup's weight.
 */
export async function nextOgImage(line: string, size: { width: number; height: number }) {
  const [bold, regular] = await Promise.all([
    fetch(new URL("./og-fonts/inter-680.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./og-fonts/inter-400.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  return new ImageResponse(<NextOgCard line={line} />, {
    ...size,
    fonts: [
      { name: "Inter", data: bold, weight: 700, style: "normal" },
      { name: "Inter", data: regular, weight: 400, style: "normal" },
    ],
  });
}

function NextOgCard({ line }: { line: string }) {
  const markHeight = 104;
  return (
    <div
      style={{
        background: "#f9f9f7",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <svg
          width={Math.round(markHeight * (222 / 110.4))}
          height={markHeight}
          viewBox="9 25.8 222 110.4"
          fill="#FF6363"
        >
          <path d={MARK_PATH_NEXT} />
        </svg>
        <div style={{ fontSize: 124, fontWeight: 700, color: "#191918", letterSpacing: "-0.04em", lineHeight: 1 }}>
          Maven
        </div>
      </div>
      <div style={{ marginTop: 44, fontSize: 36, color: "rgba(25, 25, 24, 0.64)", letterSpacing: "-0.01em" }}>
        {line}
      </div>
    </div>
  );
}
