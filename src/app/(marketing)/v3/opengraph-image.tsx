import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Virtuna | Predict viral before you post";
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
        <svg
          width="72"
          height="72"
          viewBox="0 0 32 32"
          fill="none"
          style={{ marginBottom: 28 }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
            fill="#ffffff"
          />
        </svg>

        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          Virtuna
        </div>

        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "#FF7F50",
            letterSpacing: "-0.01em",
            marginBottom: 20,
          }}
        >
          Predict viral before you post
        </div>

        <div
          style={{
            fontSize: 22,
            color: "#848586",
            maxWidth: 720,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          AI virality intelligence for TikTok creators — score, forecast, and
          benchmark every idea before it ships.
        </div>
      </div>
    ),
    { ...size },
  );
}
