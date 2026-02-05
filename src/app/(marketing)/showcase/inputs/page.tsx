import type { Metadata } from "next";

import { Heading, Text, Input, InputField } from "@/components/ui";
import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { ComponentGrid } from "../_components/component-grid";
import {
  ToggleSizeDemo,
  ToggleDisabledDemo,
  ToggleLabelDemo,
} from "../_components/toggle-demo";
import {
  SelectBasicDemo,
  SelectGroupedDemo,
  SelectSizeDemo,
  SelectDisabledDemo,
  SearchableSelectBasicDemo,
  SearchableSelectGroupedDemo,
  SearchableSelectDisabledDemo,
} from "../_components/select-demo";

export const metadata: Metadata = {
  title: "Inputs | Virtuna UI Showcase",
  description:
    "Input, InputField, Select, SearchableSelect, and Toggle components with all variants and states.",
};

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const inputBasicCode = `<Input type="text" placeholder="Enter your name" />
<Input type="email" placeholder="you@example.com" />
<Input type="password" placeholder="Password" />
<Input type="search" placeholder="Search..." />`;

const inputStatesCode = `{/* Error state */}
<Input error placeholder="Invalid email" />

{/* Disabled state */}
<Input disabled placeholder="Cannot edit" />`;

const inputFieldBasicCode = `<InputField
  label="Email"
  type="email"
  placeholder="you@example.com"
/>

<InputField
  label="Password"
  type="password"
  helperText="Must be at least 8 characters"
/>`;

const inputFieldErrorCode = `<InputField
  label="Username"
  error="Username is already taken"
  defaultValue="johndoe"
/>

<InputField
  label="Email"
  error="Please enter a valid email address"
  defaultValue="invalid-email"
/>`;

const selectBasicCode = `import { Select } from "@/components/ui";

const options = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

<Select
  options={options}
  value={value}
  onChange={setValue}
  placeholder="Select a fruit..."
/>`;

const selectGroupedCode = `<Select
  options={[
    {
      label: "Fruits",
      options: [
        { value: "apple", label: "Apple" },
        { value: "banana", label: "Banana" },
      ],
    },
    {
      label: "Vegetables",
      options: [
        { value: "carrot", label: "Carrot" },
        { value: "broccoli", label: "Broccoli" },
      ],
    },
  ]}
  placeholder="Select an item..."
/>`;

const selectSizesCode = `<Select size="sm" options={options} placeholder="Small..." />
<Select size="md" options={options} placeholder="Medium..." />
<Select size="lg" options={options} placeholder="Large..." />`;

const searchableSelectCode = `import { SearchableSelect } from "@/components/ui";

<SearchableSelect
  options={countries}
  value={value}
  onChange={setValue}
  placeholder="Select country..."
  searchPlaceholder="Search countries..."
/>`;

const toggleBasicCode = `import { Toggle } from "@/components/ui";

{/* Sizes */}
<Toggle size="sm" checked={value} onCheckedChange={setValue} />
<Toggle size="md" checked={value} onCheckedChange={setValue} />
<Toggle size="lg" checked={value} onCheckedChange={setValue} />`;

const toggleLabelCode = `<Toggle
  label="Enable notifications"
  checked={enabled}
  onCheckedChange={setEnabled}
/>

<Toggle label="Locked setting" checked disabled />`;

const toggleDisabledCode = `{/* Checked + disabled */}
<Toggle checked disabled aria-label="Checked disabled" />

{/* Unchecked + disabled */}
<Toggle disabled aria-label="Unchecked disabled" />`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InputsShowcasePage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-16">
        <Heading level={1} className="mb-3">
          Inputs
        </Heading>
        <Text size="lg" muted>
          Form input components for collecting user data. Includes text inputs,
          selection dropdowns, and toggle switches.
        </Text>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Input */}
      {/* ----------------------------------------------------------------- */}
      <ShowcaseSection
        id="input"
        title="Input"
        description="Base text input with support for multiple types, error state, and disabled state. Height is 44px for touch target compliance."
      >
        {/* Default variants */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Types
          </Text>
          <ComponentGrid columns={2}>
            <div className="space-y-3">
              <Input type="text" placeholder="Enter your name" />
              <Input type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-3">
              <Input type="password" placeholder="Password" />
              <Input type="search" placeholder="Search..." />
            </div>
          </ComponentGrid>
        </div>
        <CodeBlock code={inputBasicCode} title="Input types" />

        {/* States */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            States
          </Text>
          <ComponentGrid columns={2}>
            <div className="space-y-2">
              <span className="text-xs text-foreground-muted">Error</span>
              <Input error placeholder="Invalid email" />
            </div>
            <div className="space-y-2">
              <span className="text-xs text-foreground-muted">Disabled</span>
              <Input disabled placeholder="Cannot edit" />
            </div>
          </ComponentGrid>
        </div>
        <CodeBlock code={inputStatesCode} title="Input states" />
      </ShowcaseSection>

      {/* ----------------------------------------------------------------- */}
      {/* InputField */}
      {/* ----------------------------------------------------------------- */}
      <ShowcaseSection
        id="input-field"
        title="InputField"
        description="Wraps the base Input with label, helper text, and error message support. Automatically handles accessible labeling and aria-describedby."
      >
        {/* Basic with label + helper */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Label and Helper Text
          </Text>
          <ComponentGrid columns={2}>
            <InputField
              label="Email"
              type="email"
              placeholder="you@example.com"
            />
            <InputField
              label="Password"
              type="password"
              helperText="Must be at least 8 characters"
            />
          </ComponentGrid>
        </div>
        <CodeBlock code={inputFieldBasicCode} title="InputField with label" />

        {/* Error states */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Error Messages
          </Text>
          <ComponentGrid columns={2}>
            <InputField
              label="Username"
              error="Username is already taken"
              defaultValue="johndoe"
            />
            <InputField
              label="Email"
              error="Please enter a valid email address"
              defaultValue="invalid-email"
            />
          </ComponentGrid>
        </div>
        <CodeBlock code={inputFieldErrorCode} title="InputField with error" />
      </ShowcaseSection>

      {/* ----------------------------------------------------------------- */}
      {/* Select */}
      {/* ----------------------------------------------------------------- */}
      <ShowcaseSection
        id="select"
        title="Select"
        description="Custom dropdown select with keyboard navigation, glassmorphism styling, and grouped options support. Three size variants available."
      >
        {/* Basic */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Basic Select
          </Text>
          <SelectBasicDemo />
        </div>
        <CodeBlock code={selectBasicCode} title="Basic Select" />

        {/* Grouped */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Grouped Options
          </Text>
          <SelectGroupedDemo />
        </div>
        <CodeBlock code={selectGroupedCode} title="Grouped Select" />

        {/* Sizes */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Size Variants
          </Text>
          <SelectSizeDemo />
        </div>
        <CodeBlock code={selectSizesCode} title="Select sizes" />

        {/* Disabled */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Disabled
          </Text>
          <SelectDisabledDemo />
        </div>
      </ShowcaseSection>

      {/* ----------------------------------------------------------------- */}
      {/* SearchableSelect */}
      {/* ----------------------------------------------------------------- */}
      <ShowcaseSection
        id="searchable-select"
        title="SearchableSelect"
        description="Select dropdown with built-in type-to-filter search. Options are filtered case-insensitively as the user types."
      >
        {/* Basic searchable */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Basic Searchable
          </Text>
          <SearchableSelectBasicDemo />
        </div>
        <CodeBlock code={searchableSelectCode} title="SearchableSelect" />

        {/* Grouped searchable */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Grouped with Search
          </Text>
          <SearchableSelectGroupedDemo />
        </div>

        {/* Disabled searchable */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Disabled
          </Text>
          <SearchableSelectDisabledDemo />
        </div>
      </ShowcaseSection>

      {/* ----------------------------------------------------------------- */}
      {/* Toggle */}
      {/* ----------------------------------------------------------------- */}
      <ShowcaseSection
        id="toggle"
        title="Toggle"
        description="Switch component built on Radix UI with coral accent glow. Supports 3 sizes, optional label, and disabled state."
      >
        {/* Sizes */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Size Variants
          </Text>
          <ToggleSizeDemo />
        </div>
        <CodeBlock code={toggleBasicCode} title="Toggle sizes" />

        {/* With labels */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            With Labels
          </Text>
          <ToggleLabelDemo />
        </div>
        <CodeBlock code={toggleLabelCode} title="Toggle with label" />

        {/* Disabled */}
        <div className="mt-10 mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Disabled States
          </Text>
          <ToggleDisabledDemo />
        </div>
        <CodeBlock code={toggleDisabledCode} title="Toggle disabled" />
      </ShowcaseSection>
    </>
  );
}
