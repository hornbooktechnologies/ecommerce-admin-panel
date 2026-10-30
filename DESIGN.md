# Admin design foundation

## Visual thesis

A calm, ledger-inspired operations console: warm neutral surfaces, precise ink typography, an evergreen commerce action colour, and dense information separated by rhythm rather than card chrome.

The interface uses the locally bundled Manrope variable family across weights 200–800, with system sans-serif fallbacks. Its open forms keep dense tables readable while its variable weight range gives headings a more contemporary editorial character.

## Content plan

### Dark palette — slate and emerald

Dark mode uses deep slate canvas (`#101820`), raised slate surfaces (`#17232e`), soft white text and emerald actions (`#34c99a`). Teal, muted lavender and copper distinguish module icons; amber is reserved for warning states, not brand chrome. Light mode is unchanged.

The visual thesis is a calm commerce workspace with clear surface separation rather than metallic gold effects. Content hierarchy stays unchanged: navigation, workspace header, working tables and contextual dialogs. Motion retains existing short hover/modal transitions and reduced-motion support; the gold shimmer and repeating selected-menu sheen are removed.

Use semantic tokens for primary/on-primary, surfaces, outlines and state colours, following [Material colour-role guidance](https://m3.material.io/styles/color/the-color-system). Verify text/action pairs at 4.5:1 or better. Do not reintroduce hardcoded gold gradients in individual components.

1. Persistent role-aware navigation and active business context.
2. A compact workspace header with orientation and primary action.
3. A plain metric strip for operational state.
4. One dominant queue/table for decisions requiring attention.
5. A restrained activity rail for recent changes.

## Interaction thesis

- The workspace enters with a short upward settle so the hierarchy is immediately legible.
- Navigation and table rows use a quick horizontal/tonal transition to sharpen location and click affordance.
- Live operational signals use one restrained pulse and respect reduced-motion preferences.

## Application shell

- The sidebar is an operations rail rather than a flat menu: workspace identity, permission-filtered navigation, and environment status are visually distinct layers.
- Module icons retain their semantic accent colours, while the active destination combines an explicit page indicator, stronger type weight, and depth so location never depends on colour alone.
- The header exposes the current workspace and module while keeping user identity grouped with session actions in a clean, distraction-free control plane.
- Ledger-grid motion, edge scanning, glass highlights, and hover depth use transform or opacity, remain subordinate to content, and stop under reduced-motion preferences.

The shell intentionally avoids a dashboard-card mosaic. Borders are used as separators; raised surfaces are reserved for controls that need containment.

Primary actions use evergreen to connect the product with trade, inventory, and financial operations. Navigation and workflow icons use restrained semantic accents—warm ochre for businesses and orders, plum for people and catalog, teal for inventory, and olive for reporting—without changing the meaning of status colours.

The global loader visualises one transaction passing through order, inventory, fulfilment, and finance. It is shared by route, session, and data-loading states and becomes static when reduced motion is requested.

## Authentication surface

- The sign-in screen uses a full-canvas charcoal commerce workflow as its single visual anchor and keeps the form on a calm neutral plane.
- Desktop shows an example order advancing through capture, inventory reservation, seller split, fulfilment and finance; mobile removes secondary signals and preserves a direct, accessible form.
- Access tokens remain in memory, refresh tokens remain in HTTP-only cookies, and protected workspaces show a neutral transition state while the session is restored.
- Light and dark themes use the same semantic tokens, visible focus treatment, 44-pixel icon controls, and reduced-motion fallbacks.

## Tenant operations

- The tenant directory is the dominant working surface: summary filters lead into a searchable, server-paginated table rather than a card grid.
- Onboarding groups business, owner, and store data into three visible sections while a sticky provisioning summary explains the atomic backend result.
- Tenant details use plain structured lists for stores and merchants, with ownership and audit history kept in a narrow context rail.
- Lifecycle changes use explicit action buttons and a reason-required modal; status is never changed through a generic dropdown.
