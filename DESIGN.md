# Design System — PlateBeam

<!-- impeccable:design-schema 1 -->

## World

**Control Tower Dispatch Overlook** — cool night glass over a lit apron. PlateBeam reads as venue dispatch: cyan live-signal, amber taxiway alerts, chili abort, condensed callsign type. Seed `4a33c557` (assigned index 6). Code-led build.

## Palette

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--pb-canvas` | `#E7EEF8` | `#0B1220` | Page ground / glass field |
| `--pb-surface` | `#F4F7FC` | `#121A2B` | Panels |
| `--pb-surface-raised` | `#FFFFFF` | `#1A2740` | Elevated controls |
| `--pb-border` | `#C5D0E0` | `#2A3A55` | Chassis edges |
| `--pb-ink` | `#0B1220` | `#E7EEF8` | Primary text |
| `--pb-muted` | `#4A5B73` | `#8FA0B8` | Secondary text |
| `--pb-accent` | `#0F9F8A` | `#3DE0C5` | Live / primary CTA |
| `--pb-gold` / turmeric | `#C47D00` / `#D48900` | `#F0A202` | Warning / bill |
| `--pb-olive` | `#1F7A4D` | `#3DCE7F` | Ready / success |
| `--pb-chili` | `#C23434` | `#D64545` | Alert / overdue |

KDS stays dark-first (`#070D18` / `#101A2C`) with cyan/amber/chili SLA chrome.

## Typography

- **Display:** Teko (`--font-display`) — tower callsigns, surface titles
- **Body:** Karla (`--font-sans`)
- **Data:** Share Tech Mono (`--font-mono`) — timers, PINs, channel codes

## Materials & components

- Grid glass field (`.tower-field`), LED rails (`.led-rail`), channel strips (`.channel-strip`)
- Squared chassis radii (`rounded-sm`), inset glass panels (`.glass-panel`)
- Native `<dialog>` with discrete transitions; theme via `light-dark()` + meta `color-scheme`
- Coarse pointer `--target-size: 44px`; safe-area helpers including `.pb-safe-bottom-bar`

## Motion

- LED pulse on live badges; occasional tower scan wash on hero
- Dialog enter: opacity + slight translate, exponential ease
- Honor `prefers-reduced-motion`

## Surfaces

| Route | Mode | Notes |
| --- | --- | --- |
| `/` | Persuade | Callsign hero + channel strips |
| `/login` | Operate | PIN keypad clearance |
| `/t/[qr]` | Operate | Guest menu inherits tokens |
| `/pos/*` | Operate | Floor dispatch + 8s poll |
| `/kds/*` | Operate | Dark station tickets + 5s poll |
| `/dashboard` | Operate | Owner BI |
| `/admin` | Operate | Tenant registry |

## Anti-references retired

Warm alabaster canvas, Instrument Serif, Plus Jakarta Sans, saffron ember CTAs, soft equal icon-card home grid.
