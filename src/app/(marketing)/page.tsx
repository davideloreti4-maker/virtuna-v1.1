import {
  HeroSection,
  LogoCloudSection,
  SocialProofStats,
  TestimonialsSection,
} from "@/components/landing";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <>
      <main>
        {/* Hero Section - Phase 59 */}
        <HeroSection />

        {/* Social Proof - Phase 60 */}
        <LogoCloudSection />
        <SocialProofStats />
        <TestimonialsSection />

        {/* Features - Phase 61 */}
        {/* Conversion - Phase 62 */}
      </main>
      <Footer />
    </>
  );
}
