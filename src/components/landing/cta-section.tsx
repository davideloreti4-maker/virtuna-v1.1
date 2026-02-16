import Link from "next/link";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/motion";

export function CTASection() {
  return (
    <section className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <FadeIn>
          <h2 className="text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
            Ready to predict your next viral hit?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Test your content ideas in under 30 seconds. No guesswork, just
            data.
          </p>
          <div className="mt-10">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
