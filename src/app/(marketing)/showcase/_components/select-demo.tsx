"use client";

import * as React from "react";
import { Select, SearchableSelect } from "@/components/ui";
import type { SelectOption, SelectGroup } from "@/components/ui";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const FRUIT_OPTIONS: SelectOption[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "grape", label: "Grape" },
  { value: "mango", label: "Mango" },
];

const GROUPED_OPTIONS: (SelectOption | SelectGroup)[] = [
  {
    label: "Fruits",
    options: [
      { value: "apple", label: "Apple" },
      { value: "banana", label: "Banana" },
      { value: "cherry", label: "Cherry" },
    ],
  },
  {
    label: "Vegetables",
    options: [
      { value: "carrot", label: "Carrot" },
      { value: "broccoli", label: "Broccoli" },
      { value: "spinach", label: "Spinach" },
    ],
  },
];

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "jp", label: "Japan" },
  { value: "au", label: "Australia" },
  { value: "br", label: "Brazil" },
  { value: "ca", label: "Canada" },
];

// ---------------------------------------------------------------------------
// Select demos
// ---------------------------------------------------------------------------

/** Basic Select with placeholder. */
export function SelectBasicDemo() {
  const [value, setValue] = React.useState("");

  return (
    <div className="max-w-xs">
      <Select
        options={FRUIT_OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="Select a fruit..."
      />
    </div>
  );
}

/** Select with grouped options. */
export function SelectGroupedDemo() {
  const [value, setValue] = React.useState("");

  return (
    <div className="max-w-xs">
      <Select
        options={GROUPED_OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="Select an item..."
      />
    </div>
  );
}

/** Select size variants. */
export function SelectSizeDemo() {
  const [smVal, setSmVal] = React.useState("");
  const [mdVal, setMdVal] = React.useState("");
  const [lgVal, setLgVal] = React.useState("");

  return (
    <div className="flex flex-col gap-4 max-w-xs">
      <div>
        <span className="text-xs text-foreground-muted mb-1 block">sm</span>
        <Select
          size="sm"
          options={FRUIT_OPTIONS}
          value={smVal}
          onChange={setSmVal}
          placeholder="Small..."
        />
      </div>
      <div>
        <span className="text-xs text-foreground-muted mb-1 block">md</span>
        <Select
          size="md"
          options={FRUIT_OPTIONS}
          value={mdVal}
          onChange={setMdVal}
          placeholder="Medium..."
        />
      </div>
      <div>
        <span className="text-xs text-foreground-muted mb-1 block">lg</span>
        <Select
          size="lg"
          options={FRUIT_OPTIONS}
          value={lgVal}
          onChange={setLgVal}
          placeholder="Large..."
        />
      </div>
    </div>
  );
}

/** Select disabled state. */
export function SelectDisabledDemo() {
  return (
    <div className="max-w-xs">
      <Select
        options={FRUIT_OPTIONS}
        disabled
        placeholder="Disabled select..."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchableSelect demos
// ---------------------------------------------------------------------------

/** SearchableSelect basic demo. */
export function SearchableSelectBasicDemo() {
  const [value, setValue] = React.useState("");

  return (
    <div className="max-w-xs">
      <SearchableSelect
        options={COUNTRY_OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="Select country..."
        searchPlaceholder="Search countries..."
      />
    </div>
  );
}

/** SearchableSelect with grouped options. */
export function SearchableSelectGroupedDemo() {
  const [value, setValue] = React.useState("");

  return (
    <div className="max-w-xs">
      <SearchableSelect
        options={GROUPED_OPTIONS}
        value={value}
        onChange={setValue}
        placeholder="Search items..."
        searchPlaceholder="Type to filter..."
      />
    </div>
  );
}

/** SearchableSelect disabled state. */
export function SearchableSelectDisabledDemo() {
  return (
    <div className="max-w-xs">
      <SearchableSelect
        options={COUNTRY_OPTIONS}
        disabled
        placeholder="Disabled searchable..."
      />
    </div>
  );
}
