# Modals and Dialogs

## Screenshot References
- `_assets/leave-feedback-modal.png`
- `_assets/create-target-society.png`

---

## Leave Feedback Modal

### Structure
```
┌─────────────────────────────────────────┐
│ Leave feedback                     [×]  │
├─────────────────────────────────────────┤
│ Your details                            │
│ ┌─────────────────────────────────────┐│
│ │ Davide Loreti                       ││ ← Pre-filled
│ └─────────────────────────────────────┘│
│ ┌─────────────────────────────────────┐│
│ │ davide.loreti4@gmail.com            ││ ← Pre-filled
│ └─────────────────────────────────────┘│
│                                         │
│ Your feedback                           │
│ ┌─────────────────────────────────────┐│
│ │ Tell us what you think! It goes     ││
│ │ directly to the founders            ││
│ │                                     ││
│ │                                     ││
│ └─────────────────────────────────────┘│
│                                         │
│ Email us at support@societies.io        │
│                              [Submit →] │
└─────────────────────────────────────────┘
```

### Modal Container
```css
background: #18181B;
border: 1px solid #27272A;
border-radius: 16px;
padding: 24px;
width: 480px;
max-width: 90vw;
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
```

### Header
```css
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 24px;
```

Title:
```css
font-size: 18px;
font-weight: 600;
color: white;
```

Close button:
```css
color: #71717A;
cursor: pointer;
padding: 4px;
```

### Section Label
```css
font-size: 13px;
color: #A1A1AA;
margin-bottom: 12px;
```

### Input Fields
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 8px;
padding: 12px 16px;
font-size: 14px;
color: white;
width: 100%;
margin-bottom: 12px;
```

Pre-filled inputs appear slightly muted.

### Textarea
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 8px;
padding: 12px 16px;
font-size: 14px;
color: white;
width: 100%;
min-height: 120px;
resize: vertical;
```

Placeholder:
```css
color: #52525B;
```

### Footer
```css
display: flex;
justify-content: space-between;
align-items: center;
margin-top: 20px;
```

### Email Link
```css
font-size: 13px;
color: #71717A;
```

Link color:
```css
color: #A1A1AA;
text-decoration: underline;
cursor: pointer;
```

### Submit Button
```css
background: white;
color: #0A0A0A;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
display: flex;
align-items: center;
gap: 8px;
cursor: pointer;
```

Arrow icon: → (right arrow)

---

## Create Target Society Modal

### Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ [←]                                                             │
│                                                                 │
│        Who do you want in your society?                         │
│                                                                 │
│   Describe the people you want in your society. We'll match     │
│   your description with AI personas from our database. Every    │
│   AI persona is based on a real person.                         │
│                                                                 │
│   ┌───────────────────────────────────────────────────────────┐│
│   │ e.g. Founders in London...                                ││
│   │                                                           ││
│   └───────────────────────────────────────────────────────────┘│
│                                                                 │
│   ┌───────────────────────────────────────────────────────────┐│
│   │              Create your society                          ││
│   └───────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

    ↑ Gradient background (purple/blue mesh)
```

### Modal Container
```css
background: linear-gradient(
  135deg,
  rgba(99, 102, 241, 0.1) 0%,
  rgba(139, 92, 246, 0.1) 50%,
  rgba(59, 130, 246, 0.05) 100%
);
border: 1px solid #27272A;
border-radius: 24px;
padding: 32px;
width: 700px;
max-width: 90vw;
position: relative;
overflow: hidden;
```

Background has subtle purple/blue gradient mesh effect.

### Back Button
```css
position: absolute;
top: 24px;
left: 24px;
color: white;
cursor: pointer;
padding: 8px;
```

Arrow icon: ← (left arrow)

### Heading
```css
font-size: 32px;
font-weight: 600;
color: white;
text-align: center;
margin-bottom: 16px;
```

### Description
```css
font-size: 15px;
color: #A1A1AA;
text-align: center;
max-width: 500px;
margin: 0 auto 32px;
line-height: 1.6;
```

### Textarea Input
```css
background: #18181B;
border: 1px solid #27272A;
border-radius: 12px;
padding: 16px 20px;
font-size: 15px;
color: white;
width: 100%;
min-height: 80px;
resize: none;
margin-bottom: 16px;
```

Placeholder:
```css
color: #52525B;
```

### Submit Button
```css
background: white;
color: #0A0A0A;
border: none;
border-radius: 12px;
padding: 16px 32px;
font-size: 15px;
font-weight: 500;
width: 100%;
cursor: pointer;
transition: background 0.2s;
```

Hover:
```css
background: #E4E4E7;
```

---

## Common Modal Patterns

### Backdrop
```css
position: fixed;
inset: 0;
background: rgba(0, 0, 0, 0.6);
backdrop-filter: blur(4px);
z-index: 50;
```

### Modal Centering
```css
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
z-index: 51;
```

### Animation (enter)
```css
animation: modalIn 0.2s ease-out;

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
```

### Close Behavior
- Click backdrop: closes modal
- ESC key: closes modal
- Close button: closes modal

## Implementation Notes
- Use Radix UI Dialog or similar for accessibility
- Trap focus inside modal when open
- Prevent body scroll when modal is open
- Return focus to trigger element on close
