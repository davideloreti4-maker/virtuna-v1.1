import { Heading, Text } from "@/components/ui";

interface ShowcaseSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  id?: string;
}

export function ShowcaseSection({
  title,
  description,
  children,
  id,
}: ShowcaseSectionProps) {
  return (
    <section id={id} className="mb-16">
      <Heading level={2} className="mb-2">
        {title}
      </Heading>
      <Text size="sm" muted className="mb-8">
        {description}
      </Text>
      {children}
    </section>
  );
}
