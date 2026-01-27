"use client"

import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn, SlideUp } from "@/components/animations"

export default function ComponentShowcase() {
  return (
    <div className="py-12 bg-background">
      <Container>
        <div className="space-y-16">
          {/* Page Title */}
          <FadeIn delay={0}>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-foreground">Component Showcase</h1>
              <p className="text-lg text-muted-foreground">
                Explore all components in the Virtuna design system
              </p>
            </div>
          </FadeIn>

          {/* Buttons Section */}
          <FadeIn delay={0.1}>
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Buttons</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Variants</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Sizes</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">Small</Button>
                    <Button size="md">Medium</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">States</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled>Disabled</Button>
                  </div>
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Inputs Section */}
          <FadeIn delay={0.2}>
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Inputs</h2>

              <div className="space-y-4 max-w-md">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Default</h3>
                  <Input />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">With Placeholder</h3>
                  <Input placeholder="Enter your email..." />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Disabled</h3>
                  <Input disabled placeholder="Disabled input" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Error State</h3>
                  <Input error placeholder="Invalid input" />
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Cards Section */}
          <FadeIn delay={0.3}>
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Cards</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <Card>
                  <CardHeader>
                    <CardTitle>Card with Header</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      This is a card component with a header and content section.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className="text-muted-foreground">
                      This is a card with only content, no header.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>
          </FadeIn>

          {/* Skeletons Section */}
          <FadeIn delay={0.4}>
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Skeletons</h2>

              <div className="space-y-6 max-w-md">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Text Lines</h3>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Card Skeleton</h3>
                  <Card>
                    <CardContent>
                      <div className="space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Animations Section */}
          <FadeIn delay={0.5}>
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Animations</h2>

              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Fade In</h3>
                  <FadeIn delay={0.6}>
                    <Card>
                      <CardContent>
                        <p className="text-muted-foreground">
                          This content fades in with a delay.
                        </p>
                      </CardContent>
                    </Card>
                  </FadeIn>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Slide Up</h3>
                  <SlideUp delay={0.6}>
                    <Card>
                      <CardContent>
                        <p className="text-muted-foreground">
                          This content slides up from below.
                        </p>
                      </CardContent>
                    </Card>
                  </SlideUp>
                </div>
              </div>
            </section>
          </FadeIn>
        </div>
      </Container>
    </div>
  )
}
