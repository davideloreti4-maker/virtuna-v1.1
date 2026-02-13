import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Virtuna - AI Content Intelligence for TikTok Creators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#07080a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo mark */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 32 32"
          fill="none"
          style={{ marginBottom: 24 }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
            fill="white"
          />
        </svg>

        {/* Brand name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          Virtuna
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#848586",
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          AI Content Intelligence for TikTok Creators
        </div>

        {/* Accent line */}
        <div
          style={{
            fontSize: 20,
            color: "#FF7F50",
            marginTop: 20,
          }}
        >
          Know what will go viral before you post
        </div>
      </div>
    ),
    { ...size },
  );
}
