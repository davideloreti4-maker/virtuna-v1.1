"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/layout/container";
import { FadeIn } from "@/components/animations/fade-in";
import { SlideUp } from "@/components/animations/slide-up";

export default function ComponentShowcase() {
  const [inputValue, setInputValue] = useState("");

  return (
    <Container className="py-16">
      <FadeIn>
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Component Showcase</h1>
          <p className="text-lg text-gray-600">
            Virtuna Design System Foundation
          </p>
        </div>
      </FadeIn>

      {/* Buttons Section */}
      <FadeIn delay={0.1}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Buttons</h2>
          <div className="space-y-6">
            {/* Variants */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                Variants
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* States */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">States</h3>
              <div className="flex flex-wrap gap-4">
                <Button disabled>Disabled</Button>
                <Button fullWidth>Full Width</Button>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Inputs Section */}
      <FadeIn delay={0.2}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Inputs</h2>
          <div className="space-y-4 max-w-md">
            <Input
              placeholder="Default input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input placeholder="With placeholder" />
            <Input disabled placeholder="Disabled input" />
            <Input error placeholder="Error state" />
          </div>
        </section>
      </FadeIn>

      {/* Cards Section */}
      <FadeIn delay={0.3}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Cards</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Simple Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  This is a basic card with header and content.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card with More Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Cards can contain various types of content.
                </p>
                <Button size="sm">Action</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600">Card without header</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </FadeIn>

      {/* Skeletons Section */}
      <FadeIn delay={0.4}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Skeletons</h2>
          <div className="space-y-6">
            {/* Text skeletons */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                Text Lines
              </h3>
              <div className="space-y-2 max-w-md">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>

            {/* Card skeleton */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                Card Skeleton
              </h3>
              <Card className="max-w-md">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-10 w-24 mt-4" />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Animations Section */}
      <FadeIn delay={0.5}>
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Animations</h2>
          <div className="space-y-8">
            {/* FadeIn demo */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                FadeIn (with staggered delays)
              </h3>
              <div className="space-y-3">
                <FadeIn delay={0}>
                  <Card>
                    <CardContent className="py-4">
                      <p>First item (no delay)</p>
                    </CardContent>
                  </Card>
                </FadeIn>
                <FadeIn delay={0.1}>
                  <Card>
                    <CardContent className="py-4">
                      <p>Second item (0.1s delay)</p>
                    </CardContent>
                  </Card>
                </FadeIn>
                <FadeIn delay={0.2}>
                  <Card>
                    <CardContent className="py-4">
                      <p>Third item (0.2s delay)</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              </div>
            </div>

            {/* SlideUp demo */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                SlideUp (dramatic effect)
              </h3>
              <SlideUp distance={60}>
                <Card>
                  <CardHeader>
                    <CardTitle>Hero Section Effect</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      SlideUp uses a dramatic ease-out-expo curve with
                      configurable distance.
                    </p>
                  </CardContent>
                </Card>
              </SlideUp>
            </div>
          </div>
        </section>
      </FadeIn>
    </Container>
  );
}
