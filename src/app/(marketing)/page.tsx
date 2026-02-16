import {
  HeroSection,
  FeaturesSection,
  StatsSection,
  FAQSection,
  CTASection,
} from "@/components/landing";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <>
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
