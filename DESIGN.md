---
name: Academic Precision
colors:
  surface: '#faf9fd'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#eeedf1'
  surface-container-high: '#e8e8ec'
  surface-container-highest: '#e2e2e6'
  on-surface: '#1a1c1f'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#73777f'
  outline-variant: '#c3c6cf'
  surface-tint: '#3d608a'
  primary: '#001b35'
  on-primary: '#ffffff'
  primary-container: '#003057'
  on-primary-container: '#7699c5'
  inverse-primary: '#a6c9f8'
  secondary: '#0059bb'
  on-secondary: '#ffffff'
  secondary-container: '#0070ea'
  on-secondary-container: '#fefcff'
  tertiary: '#301100'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f2202'
  on-tertiary-container: '#cb865e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a6c9f8'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#234871'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc7ff'
  on-secondary-fixed: '#001a41'
  on-secondary-fixed-variant: '#004493'
  tertiary-fixed: '#ffdbc9'
  tertiary-fixed-dim: '#ffb68c'
  on-tertiary-fixed: '#321200'
  on-tertiary-fixed-variant: '#6d3917'
  background: '#faf9fd'
  on-background: '#1a1c1f'
  surface-variant: '#e2e2e6'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.25'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for the modern university student, balancing the institutional prestige of the Universidad Tecnológica Nacional with the high-velocity efficiency of a contemporary SaaS platform. The aesthetic is rooted in **Corporate / Modern** principles, prioritizing clarity and cognitive ease to support intensive learning sessions and complex data analysis.

The brand personality is authoritative yet approachable—acting as a reliable digital companion for engineering and technical students. The visual language utilizes structured layouts, intentional whitespace, and a high-contrast color strategy to differentiate between static educational content and interactive tools.

## Colors

The palette is anchored by "UTN Deep Blue," a color that evokes institutional trust and academic rigor. This is paired with "Action Blue," a vibrant, high-luminance blue reserved exclusively for primary calls-to-action and interactive states to provide clear visual affordance.

The neutral palette leverages cool grays for borders and secondary text, ensuring the interface feels "clean" rather than "cold." Success and error states use calibrated semantic colors that maintain high legibility against white and light-gray surfaces, ensuring accessibility for critical feedback during quizzes.

## Typography

The typography strategy employs a dual-font system to maximize both character and readability. **Montserrat** is used for headings to provide a strong, geometric, and modern structural feel. **Inter** is utilized for all body text, UI labels, and data-heavy quiz content due to its exceptional legibility and neutral tone.

Emphasis is placed on a strict vertical rhythm. Large display sizes are slightly tightened in letter-spacing to maintain a professional appearance. Labels utilize a semi-bold weight and occasional uppercase styling to clearly distinguish metadata from primary reading content.

## Layout & Spacing

This design system utilizes a **12-column fixed grid** for desktop, centering the content within a 1280px container to prevent excessive line lengths in educational reading material. The system is built on an **8px linear scale**, ensuring consistent alignment across all components.

On mobile devices, the grid collapses to 4 columns with 16px side margins. Elements like course cards and quiz options transition from multi-column layouts to stacked vertical lists. Generous padding (1.5x to 2x) is applied to containers to ensure the UI feels airy and reduces the "wall of text" effect often found in academic software.

## Elevation & Depth

Depth is used sparingly and purposefully to denote interactive layers. The system utilizes **Ambient Shadows**—soft, diffused blurs with very low opacity—to elevate cards and modals above the primary background.

- **Level 0 (Floor):** The `#F8FAFC` background.
- **Level 1 (Cards):** White surfaces with a 1px soft gray border or a very subtle drop shadow (y: 2px, blur: 8px, opacity: 0.04).
- **Level 2 (Active/Hover):** Enhanced shadow (y: 4px, blur: 16px, opacity: 0.08) to indicate focus or interactivity.
- **Level 3 (Modals/Overlays):** High-diffusion shadow to separate critical user tasks from the background.

This hierarchy ensures that the most important information (the learning material) feels physically closest to the user.

## Shapes

The shape language reflects a "Contemporary SaaS" feel by using **Rounded (0.5rem / 8px)** corners as the standard. This radius provides a friendly, modern touch while maintaining enough structural rigidity to look professional and academic.

Larger components, such as course cards and featured banners, utilize **rounded-lg (1rem / 16px)** to create a distinct visual container. Buttons and input fields strictly follow the 8px standard to maintain a cohesive look across all form elements.

## Components

### Course Cards
Cards are the primary container for discovery. They feature a white surface, a 1px border (`#E2E8F0`), and use `headline-sm` for titles. They include a dedicated bottom section for progress bars.

### Progress Bars
Used extensively for course completion and quiz status. The track uses a light gray background with the fill using "Action Blue." For successful completion, the bar transitions to the success green.

### Focused Quiz Interface
The quiz UI removes global navigation to minimize distraction. Options are presented as large, selectable cards with clear hover states. Active selections use a 2px "Action Blue" border.

### Filter Tags (Chips)
Small, pill-shaped elements with a light blue background and deep blue text. They are used for categorizing subjects (e.g., "Sistemas," "Electrónica").

### Buttons
- **Primary:** "Action Blue" background, white text, 8px radius.
- **Secondary:** White background, "Action Blue" border and text.
- **Ghost:** No background, "UTN Deep Blue" text, used for less critical actions.

### Input Fields
Standardized with a 1px border that turns "Action Blue" on focus. Labels always sit above the input using `label-sm` to ensure the user never loses context.