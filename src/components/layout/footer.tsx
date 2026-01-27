import Link from "next/link"
import Image from "next/image"
import { Container } from "./container"
import { footerLinks, socialLinks, footerContact } from "@/lib/constants/navigation"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-landing-border bg-[#0d0d0d]">
      <Container>
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Brand Column */}
            <div className="md:col-span-4">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/images/landing/logo.png"
                  alt="Artificial Societies"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="text-[16px] font-medium text-white">
                  Artificial Societies
                </span>
              </Link>
              <p className="mt-4 text-[14px] text-landing-text-dim max-w-xs">
                Research that was impossible is now instant.
              </p>

              {/* Contact email */}
              <Link
                href={`mailto:${footerContact.email}`}
                className="mt-4 inline-block text-[14px] text-landing-text-dim hover:text-white transition-colors"
              >
                {footerContact.email}
              </Link>
            </div>

            {/* Spacer */}
            <div className="hidden md:block md:col-span-4" />

            {/* Links Columns */}
            {footerLinks.map((section) => (
              <div key={section.title} className="md:col-span-2">
                <h3 className="text-[14px] font-medium text-white mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[14px] text-landing-text-dim hover:text-white transition-colors"
                        {...(link.external && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Social Links Column */}
            <div className="md:col-span-2">
              <h3 className="text-[14px] font-medium text-white mb-4">
                Connect
              </h3>
              <ul className="space-y-3">
                {socialLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-landing-text-dim hover:text-white transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-landing-border">
            <p className="text-[14px] text-landing-text-dim">
              &copy; {currentYear} {footerContact.copyright}. All rights reserved.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  )
}
