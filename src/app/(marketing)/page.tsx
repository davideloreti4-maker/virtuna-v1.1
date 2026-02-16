import {
  HeroSection,
  FeaturesSection,
  StatsSection,
  FAQSection,
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
        {/* CTA section -- added in 02-02 */}
      </main>
      <Footer />
    </>
  );
}
