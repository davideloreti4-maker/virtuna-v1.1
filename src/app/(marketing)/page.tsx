import {
  HeroSection,
  FeaturesSection,
  StatsSection,
  SocialProofSection,
  FAQSection,
} from "@/components/landing";
import { HiveDemo } from "@/components/hive-demo";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <>
      <main>
        <HeroSection />
        <HiveDemo />
        <FeaturesSection />
        <StatsSection />
        <SocialProofSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
