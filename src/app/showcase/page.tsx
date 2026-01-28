"use client";

import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui";
import { Skeleton } from "@/components/ui";
import { Container, Header, Footer } from "@/components/layout";
import { FadeIn, SlideUp } from "@/components/motion";
import { ArrowRight, Heart, Star, MagnifyingGlass } from "@phosphor-icons/react";

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header variant="landing" />

      <main className="py-16">
        <Container>
          {/* Page Title */}
          <FadeIn>
            <div className="mb-16 text-center">
              <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
                Design System Showcase
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-muted">
                A comprehensive display of all Virtuna design system components,
                tokens, and patterns.
              </p>
            </div>
          </FadeIn>

          {/* Typography Section */}
          <FadeIn delay={0.1}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Typography
              </h2>
              <Card>
                <CardContent className="space-y-6 pt-6">
                  {/* Display Font */}
                  <div>
                    <p className="mb-2 text-sm text-foreground-muted">
                      Display Font (Funnel Display)
                    </p>
                    <h1 className="font-display text-4xl font-bold text-foreground">
                      The quick brown fox
                    </h1>
                    <h2 className="font-display text-2xl font-semibold text-foreground">
                      Jumps over the lazy dog
                    </h2>
                  </div>

                  {/* Body Font */}
                  <div>
                    <p className="mb-2 text-sm text-foreground-muted">
                      Body Font (Satoshi)
                    </p>
                    <p className="text-foreground">
                      Regular weight body text. Perfect for paragraphs and general
                      content.
                    </p>
                    <p className="font-medium text-foreground">
                      Medium weight for emphasis and labels.
                    </p>
                    <p className="font-semibold text-foreground">
                      Semibold weight for strong emphasis.
                    </p>
                    <p className="font-bold text-foreground">
                      Bold weight for headings and CTAs.
                    </p>
                  </div>

                  {/* Color Tokens */}
                  <div>
                    <p className="mb-2 text-sm text-foreground-muted">
                      Text Color Tokens
                    </p>
                    <div className="space-y-1">
                      <p className="text-foreground">
                        text-foreground - Primary text color (#FFFFFF)
                      </p>
                      <p className="text-foreground-muted">
                        text-foreground-muted - Secondary text color (#CCCCCC)
                      </p>
                      <p className="text-accent">
                        text-accent - Accent/highlight color (#E57850)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Button Section */}
          <SlideUp delay={0.2}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Buttons
              </h2>
              <Card>
                <CardContent className="space-y-8 pt-6">
                  {/* Variants */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">Variants</p>
                    <div className="flex flex-wrap gap-4">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="link">Link</Button>
                    </div>
                  </div>

                  {/* Sizes */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">Sizes</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                      <Button size="icon">
                        <Heart weight="fill" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* With Icons */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">With Icons</p>
                    <div className="flex flex-wrap gap-4">
                      <Button>
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button variant="secondary">
                        <Star weight="fill" className="mr-2 h-4 w-4" />
                        Favorite
                      </Button>
                    </div>
                  </div>

                  {/* States */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">States</p>
                    <div className="flex flex-wrap gap-4">
                      <Button disabled>Disabled</Button>
                      <Button variant="secondary" disabled>
                        Disabled Secondary
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </SlideUp>

          {/* Input Section */}
          <FadeIn delay={0.3}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Inputs
              </h2>
              <Card>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Default */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Default Input
                      </label>
                      <Input placeholder="Enter your email..." />
                    </div>

                    {/* With Icon */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        With Search Icon
                      </label>
                      <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                        <Input className="pl-10" placeholder="Search..." />
                      </div>
                    </div>

                    {/* Error State */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Error State
                      </label>
                      <Input
                        error
                        placeholder="Invalid email"
                        defaultValue="not-an-email"
                      />
                      <p className="mt-1 text-sm text-red-500">
                        Please enter a valid email address
                      </p>
                    </div>

                    {/* Disabled */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Disabled
                      </label>
                      <Input
                        disabled
                        placeholder="Cannot edit"
                        defaultValue="Locked value"
                      />
                    </div>
                  </div>

                  <p className="text-sm text-foreground-muted">
                    Note: Focus states are visible when interacting with inputs
                    (click to see accent border).
                  </p>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Card Section */}
          <SlideUp delay={0.4}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Cards
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Basic Card */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-foreground">
                      Basic Card
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      A simple card with header
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-muted">
                      Card content goes here. This demonstrates the spacing and
                      structure of the Card component.
                    </p>
                  </CardContent>
                </Card>

                {/* Card with Footer */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-foreground">
                      Card with Action
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      Includes a footer with button
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-muted">
                      Use CardFooter for action buttons or additional information.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm">Learn More</Button>
                  </CardFooter>
                </Card>

                {/* Feature Card */}
                <Card>
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Star weight="fill" className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Feature Card
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground-muted">
                      Cards can be customized for different use cases like feature
                      highlights.
                    </p>
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button variant="link" size="sm">
                      View Details
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </section>
          </SlideUp>

          {/* Skeleton Section */}
          <FadeIn delay={0.5}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Skeletons
              </h2>
              <Card>
                <CardContent className="space-y-8 pt-6">
                  {/* Text Skeletons */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">
                      Text Placeholders
                    </p>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                  </div>

                  {/* Avatar Skeleton */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">
                      Avatar Placeholder
                    </p>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </div>

                  {/* Card Skeleton */}
                  <div>
                    <p className="mb-4 text-sm text-foreground-muted">
                      Card Placeholder
                    </p>
                    <div className="rounded-lg border border-border bg-background-elevated p-6">
                      <Skeleton className="mb-4 h-6 w-1/3" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="mt-4 h-9 w-24" />
                    </div>
                  </div>

                  <p className="text-sm text-foreground-muted">
                    Skeletons show a pulse animation. If you have
                    prefers-reduced-motion enabled, the animation will be disabled.
                  </p>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Animation Section */}
          <SlideUp delay={0.6}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Animations
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {/* FadeIn Demo */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-foreground">
                      FadeIn
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      Subtle fade with slight upward movement
                    </p>
                  </CardHeader>
                  <CardContent>
                    <FadeIn>
                      <div className="rounded-lg bg-accent/10 p-4">
                        <p className="text-foreground">
                          This content fades in when it enters the viewport.
                        </p>
                      </div>
                    </FadeIn>
                  </CardContent>
                </Card>

                {/* SlideUp Demo */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold text-foreground">
                      SlideUp
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      More dramatic vertical slide animation
                    </p>
                  </CardHeader>
                  <CardContent>
                    <SlideUp>
                      <div className="rounded-lg bg-accent/10 p-4">
                        <p className="text-foreground">
                          This content slides up into view from below.
                        </p>
                      </div>
                    </SlideUp>
                  </CardContent>
                </Card>
              </div>

              <p className="mt-4 text-sm text-foreground-muted">
                Scroll down and back up to see animations trigger. Animations
                respect prefers-reduced-motion settings.
              </p>
            </section>
          </SlideUp>

          {/* Color Palette Section */}
          <FadeIn delay={0.7}>
            <section className="mb-16">
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Color Palette
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Background */}
                    <div>
                      <div className="mb-2 h-16 rounded-lg border border-border bg-background" />
                      <p className="text-sm font-medium text-foreground">
                        Background
                      </p>
                      <p className="text-xs text-foreground-muted">#0D0D0D</p>
                    </div>

                    {/* Background Elevated */}
                    <div>
                      <div className="mb-2 h-16 rounded-lg border border-border bg-background-elevated" />
                      <p className="text-sm font-medium text-foreground">
                        Elevated
                      </p>
                      <p className="text-xs text-foreground-muted">#1A1A1A</p>
                    </div>

                    {/* Accent */}
                    <div>
                      <div className="mb-2 h-16 rounded-lg bg-accent" />
                      <p className="text-sm font-medium text-foreground">Accent</p>
                      <p className="text-xs text-foreground-muted">#E57850</p>
                    </div>

                    {/* Border */}
                    <div>
                      <div className="mb-2 flex h-16 items-center justify-center rounded-lg border-2 border-border">
                        <span className="text-xs text-foreground-muted">
                          Border
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">Border</p>
                      <p className="text-xs text-foreground-muted">#2A2A2A</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Spacing Reference */}
          <SlideUp delay={0.8}>
            <section>
              <h2 className="font-display mb-8 text-2xl font-bold text-foreground">
                Spacing Scale
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {[
                      { name: "4px", class: "w-1" },
                      { name: "8px", class: "w-2" },
                      { name: "12px", class: "w-3" },
                      { name: "16px", class: "w-4" },
                      { name: "24px", class: "w-6" },
                      { name: "32px", class: "w-8" },
                      { name: "48px", class: "w-12" },
                      { name: "64px", class: "w-16" },
                    ].map((space) => (
                      <div key={space.name} className="flex items-center gap-4">
                        <div
                          className={`h-4 rounded bg-accent ${space.class}`}
                        />
                        <span className="text-sm text-foreground-muted">
                          {space.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          </SlideUp>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
