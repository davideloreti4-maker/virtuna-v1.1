"use client"

import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/animations/fade-in"
import { SlideUp } from "@/components/animations/slide-up"

export default function ComponentShowcase() {
  return (
    <Container className="py-12">
      <FadeIn>
        <h1 className="text-4xl font-bold text-landing-text mb-2">Component Showcase</h1>
        <p className="text-landing-text-muted mb-12">
          Visual verification of all design system components
        </p>
      </FadeIn>

      {/* Buttons Section */}
      <FadeIn delay={0.1}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Buttons</h2>

          <div className="space-y-8">
            {/* Variants */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </div>

            {/* Rounded */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Rounded</h3>
              <div className="flex flex-wrap gap-3">
                <Button rounded="default">Default</Button>
                <Button rounded="full">Full</Button>
                <Button rounded="none">None</Button>
              </div>
            </div>

            {/* States */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">States</h3>
              <div className="flex flex-wrap gap-3">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
                <Button fullWidth className="max-w-xs">Full Width</Button>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Inputs Section */}
      <FadeIn delay={0.2}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Inputs</h2>

          <div className="space-y-8 max-w-md">
            {/* Default states */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">States</h3>
              <div className="space-y-3">
                <Input placeholder="Default input" />
                <Input placeholder="With value" defaultValue="Hello World" />
                <Input placeholder="Disabled input" disabled />
                <Input placeholder="Error state" error />
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Sizes</h3>
              <div className="space-y-3">
                <Input inputSize="sm" placeholder="Small input" />
                <Input inputSize="md" placeholder="Medium input" />
                <Input inputSize="lg" placeholder="Large input" />
              </div>
            </div>

            {/* Types */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Types</h3>
              <div className="space-y-3">
                <Input type="email" placeholder="Email input" />
                <Input type="password" placeholder="Password input" />
                <Input type="number" placeholder="Number input" />
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Cards Section */}
      <FadeIn delay={0.3}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Card with Header</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-landing-text-muted">
                  This card has a header with a title and content section below.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-landing-text-muted">
                  This card only has content, no header section.
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Full Width Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-landing-text-muted">
                  Cards can span multiple columns and contain any content.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm">Action 1</Button>
                  <Button size="sm" variant="outline">Action 2</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </FadeIn>

      {/* Skeletons Section */}
      <FadeIn delay={0.4}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Skeletons</h2>

          <div className="space-y-8 max-w-md">
            {/* Text skeletons */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Text Lines</h3>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>

            {/* Card skeleton */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Card Skeleton</h3>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Avatar + text skeleton */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Profile Skeleton</h3>
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Animations Section */}
      <FadeIn delay={0.5}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Animations</h2>

          <div className="space-y-8">
            {/* FadeIn demo */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">FadeIn (staggered)</h3>
              <div className="flex gap-4">
                {[0, 0.1, 0.2, 0.3].map((delay, i) => (
                  <FadeIn key={i} delay={delay + 0.5}>
                    <div className="w-16 h-16 bg-primary-500 rounded-lg flex items-center justify-center text-white font-medium">
                      {i + 1}
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>

            {/* SlideUp demo */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">SlideUp</h3>
              <SlideUp delay={0.8}>
                <Card className="max-w-sm">
                  <CardContent className="pt-6">
                    <p className="text-landing-text-muted">
                      This card slides up into view with a smooth animation.
                    </p>
                  </CardContent>
                </Card>
              </SlideUp>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Typography Section */}
      <FadeIn delay={0.6}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Typography</h2>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold">Heading 1</h1>
            <h2 className="text-4xl font-bold">Heading 2</h2>
            <h3 className="text-3xl font-semibold">Heading 3</h3>
            <h4 className="text-2xl font-semibold">Heading 4</h4>
            <h5 className="text-xl font-medium">Heading 5</h5>
            <h6 className="text-lg font-medium">Heading 6</h6>
            <p className="text-base text-landing-text">
              Body text - Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
            <p className="text-sm text-landing-text-muted">
              Small text - Secondary information and captions.
            </p>
          </div>
        </section>
      </FadeIn>

      {/* Colors Section */}
      <FadeIn delay={0.7}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-landing-text mb-6">Colors</h2>

          <div className="space-y-6">
            {/* Primary */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Primary</h3>
              <div className="flex gap-2">
                <div className="w-16 h-16 rounded-lg bg-primary-100" title="primary-100" />
                <div className="w-16 h-16 rounded-lg bg-primary-200" title="primary-200" />
                <div className="w-16 h-16 rounded-lg bg-primary-300" title="primary-300" />
                <div className="w-16 h-16 rounded-lg bg-primary-400" title="primary-400" />
                <div className="w-16 h-16 rounded-lg bg-primary-500" title="primary-500" />
                <div className="w-16 h-16 rounded-lg bg-primary-600" title="primary-600" />
                <div className="w-16 h-16 rounded-lg bg-primary-700" title="primary-700" />
              </div>
            </div>

            {/* Gray */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Gray</h3>
              <div className="flex gap-2">
                <div className="w-16 h-16 rounded-lg bg-gray-100 border" title="gray-100" />
                <div className="w-16 h-16 rounded-lg bg-gray-200" title="gray-200" />
                <div className="w-16 h-16 rounded-lg bg-gray-300" title="gray-300" />
                <div className="w-16 h-16 rounded-lg bg-gray-400" title="gray-400" />
                <div className="w-16 h-16 rounded-lg bg-gray-500" title="gray-500" />
                <div className="w-16 h-16 rounded-lg bg-gray-600" title="gray-600" />
                <div className="w-16 h-16 rounded-lg bg-gray-700" title="gray-700" />
              </div>
            </div>

            {/* Status colors */}
            <div>
              <h3 className="text-sm font-medium text-landing-text-muted mb-3">Status</h3>
              <div className="flex gap-2">
                <div className="w-16 h-16 rounded-lg bg-success" title="success" />
                <div className="w-16 h-16 rounded-lg bg-warning" title="warning" />
                <div className="w-16 h-16 rounded-lg bg-error" title="error" />
              </div>
            </div>
          </div>
        </section>
      </FadeIn>
    </Container>
  )
}
