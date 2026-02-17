import type { Metadata } from "next";
import { TrendingClient } from "./trending-client";

export const metadata: Metadata = {
  title: "Trending | Virtuna",
  description: "Discover trending content and sounds on TikTok.",
};

export default function TrendingPage() {
  return <TrendingClient />;
}
