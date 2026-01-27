import Link from "next/link"
import { Container } from "@/components/layout/container"
import { FadeIn } from "@/components/animations"

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-landing-bg">
      <Container>
        <FadeIn className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-landing-text mb-4">
            Coming Soon
          </h1>
          <p className="text-lg text-landing-text-muted mb-8 max-w-md mx-auto">
            We're working hard to bring you something amazing. Check back soon!
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </Link>
        </FadeIn>
      </Container>
    </main>
  )
}
