import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
  minimal?: boolean;
}

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Case Studies", href: "#case-studies" },
    { label: "FAQ", href: "#faq" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

/**
 * Footer component with link grid and copyright.
 * Supports minimal variant for app pages.
 */
export function Footer({ className, minimal = false }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (minimal) {
    return (
      <footer
        className={cn(
          "border-t border-border/50 bg-background py-6",
          className
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-sm text-foreground-muted">
            &copy; {currentYear} Virtuna. All rights reserved.
          </span>
          <div className="flex gap-4">
            <a
              href="/privacy"
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={cn("bg-background-elevated py-12 lg:py-16", className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Logo and Tagline */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-foreground">
                Virtuna
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-foreground-muted">
              Test your ideas with AI-powered audience simulations before
              launching to the real world.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-medium text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-medium text-foreground">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-medium text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-border/50 pt-8">
          <p className="text-sm text-foreground-muted">
            &copy; {currentYear} Virtuna. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
