import { cn } from "@/lib/utils";
import { Quotes } from "@phosphor-icons/react/dist/ssr";

export interface TestimonialQuoteProps {
  quote: string;
  authorName: string;
  authorTitle: string;
  authorCompany: string;
  className?: string;
}

/**
 * TestimonialQuote component for displaying customer quotes.
 * Used in case study and partnership sections.
 *
 * Styling matches societies.io reference:
 * - Quote icon: Phosphor Quotes, 32px, 50% opacity
 * - Blockquote: Inter 20px, line-height 34px
 * - Author name: Inter medium weight, white
 * - Author title: Inter 14px, muted gray
 */
export function TestimonialQuote({
  quote,
  authorName,
  authorTitle,
  authorCompany,
  className,
}: TestimonialQuoteProps) {
  return (
    <div className={cn("flex flex-col justify-center", className)}>
      <Quotes size={32} weight="fill" className="mb-4 text-white/50" />
      <blockquote className="font-sans text-xl leading-[34px] text-white">
        {quote}
      </blockquote>
      <div className="mt-6">
        <div className="font-medium text-white">{authorName}</div>
        <div className="text-sm text-foreground-muted">
          {authorTitle}, {authorCompany}
        </div>
      </div>
    </div>
  );
}
