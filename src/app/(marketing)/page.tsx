import {
  BehavioralHero,
  BackersSection,
  FeaturesSection,
  StatsSection,
  CaseStudySection,
  PartnershipSection,
  FAQSection,
} from "@/components/landing";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <>
      <main>
        <BehavioralHero />
        <BackersSection />
        <FeaturesSection />
        <StatsSection />
        <CaseStudySection />
        <PartnershipSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
