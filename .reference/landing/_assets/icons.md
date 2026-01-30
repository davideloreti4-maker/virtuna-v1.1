# Icon Reference - Societies.io

All icons appear to be from **Phosphor Icons** (https://phosphoricons.com/)

## Nav Logo

```svg
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z" fill="currentColor"></path>
</svg>
```

## Feature Icons

### 1. Unreachable audiences (Target/Crosshair)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
  <path d="M220.06,84a102.06,102.06,0,1,1-24.31-32.27l24-24a6,6,0,0,1,8.48,8.49l-96,96a6,6,0,1,1-8.48-8.49l29.39-29.4a42,42,0,1,0,16.78,31.24,6,6,0,1,1,12-.68A54,54,0,1,1,161.7,85.83l25.54-25.55a89.91,89.91,0,1,0,22,28.93A6,6,0,1,1,220.06,84Z"></path>
</svg>
```
**Phosphor name:** `Crosshair` or similar target icon

### 2. Instant insights (Lightning)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
  <path d="M213.84,118.63a6,6,0,0,0-3.73-4.25L150.88,92.17l15-75a6,6,0,0,0-10.27-5.27l-112,120a6,6,0,0,0,2.28,9.71l59.23,22.21-15,75a6,6,0,0,0,3.14,6.52A6.07,6.07,0,0,0,96,246a6,6,0,0,0,4.39-1.91l112-120A6,6,0,0,0,213.84,118.63ZM106,220.46l11.85-59.28a6,6,0,0,0-3.77-6.8l-55.6-20.85,91.46-98L138.12,94.82a6,6,0,0,0,3.77,6.8l55.6,20.85Z"></path>
</svg>
```
**Phosphor name:** `Lightning`

### 3. Millions of personas (Users/People)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
  <path d="M243.6,148.8a6,6,0,0,1-8.4-1.2A53.58,53.58,0,0,0,192,126a6,6,0,0,1,0-12,26,26,0,1,0-25.18-32.5,6,6,0,0,1-11.62-3,38,38,0,1,1,59.91,39.63A65.69,65.69,0,0,1,244.8,140.4A6,6,0,0,1,243.6,148.8ZM189.19,213a6,6,0,0,1-2.19,8.2,5.9,5.9,0,0,1-3,.81,6,6,0,0,1-5.2-3,59,59,0,0,0-101.62,0,6,6,0,1,1-10.38-6A70.1,70.1,0,0,1,103,182.55a46,46,0,1,1,50.1,0A70.1,70.1,0,0,1,189.19,213ZM128,178a34,34,0,1,0-34-34A34,34,0,0,0,128,178Z"></path>
</svg>
```
**Phosphor name:** `UsersThree` or `Users`

### 4. True understanding (Brain)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
  <path d="M246,124a54.13,54.13,0,0,0-32-49.33V72a46,46,0,0,0-86-22.67A46,46,0,0,0,42,72v2.67a54,54,0,0,0,0,98.63V176a46,46,0,0,0,86,22.67A46,46,0,0,0,214,176v-2.7A54.07,54.07,0,0,0,246,124ZM88,210a34,34,0,0,1-34-32.94A53.67,53.67,0,0,0,64,178h8a6,6,0,0,0,0-12H64A42,42,0,0,1,50,84.39a6,6,0,0,0,4-5.66V72a34,34,0,0,1,68,0v73.05A45.89,45.89,0,0,0,88,130a6,6,0,0,0,0,12,34,34,0,0,1,0,68Zm104-44h-8a6,6,0,0,0,0,12h8a53.67,53.67,0,0,0,10-.94A34,34,0,1,1,168,142a6,6,0,0,0,0-12,45.89,45.89,0,0,0-34,15.05V72a34,34,0,0,1,68,0v6.73a6,6,0,0,0,4,5.66A42,42,0,0,1,192,166Z"></path>
</svg>
```
**Phosphor name:** `Brain`

## Persona Card Icons

These are smaller (12px) icons from Phosphor:
- `MapPin` - Location
- `GenderMale` / `GenderFemale` - Gender
- `User` - Age/Generation
- `Buildings` - Industry

## Social Icons

- LinkedIn: Standard LinkedIn logo
- X: X (Twitter) logo
- Email: `Envelope` from Phosphor

## Icon Library Setup

```bash
# Install Phosphor React
pnpm add @phosphor-icons/react
```

```tsx
import { Lightning, Brain, UsersThree, Crosshair } from '@phosphor-icons/react';

// Usage
<Lightning size={28} weight="light" />
```

Note: The weight appears to be "light" (thin strokes) based on the SVG paths.
