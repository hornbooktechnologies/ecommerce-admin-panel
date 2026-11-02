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

## Tenant dashboard — quick overview

The tenant dashboard prioritises understanding and action, with no cinematic hero or scroll choreography. The existing commerce background effect stays enabled behind the working surfaces. This dashboard deliberately uses four clickable summary cards at the client's request: orders today, awaiting fulfilment, low-stock alerts and return requests. Cards have semantic icon colours, concise explanations and a direct module link; inaccessible cards are omitted rather than disabled.

The remaining layout is one task panel beside a quick-actions panel, followed by always-visible order charts and recent audit activity. Guidance for making a product sellable stays in a secondary disclosure instead of occupying the primary work area. Priority record previews are likewise secondary; queue counts and next actions are immediately visible.

The existing slate/emerald and warm-neutral themes, Manrope and semantic colour tokens remain unchanged. Surfaces are opaque and readable, rounded corners and subtle hover feedback add polish, and reduced motion removes decorative transitions. Mobile stacks working panels, adapts metric columns and keeps charts within the viewport. The shared sidebar/header are not redesigned. Dashboard page actions use a 12-pixel gap and matching 48-pixel heights; on small screens they stack at full width.

Use real API counts only. Unavailable counts are not zero, mixed queue types are not summed into a misleading total, and "all caught up" requires all accessible queue counts to be known and zero. The backend currently reports daily order counts and chart dates in UTC, which is explicitly labelled. Order value is not collected revenue, payment or settlement.

Implementation review: JavaScript/JSX and CSS syntax checks only; lint/tests/build remain skipped at the user's request. Browser/device visual verification is still pending.

### Dashboard commerce background — extended material treatment

Only the tenant /admin overview uses the extended background. The previous shared scene is retained for all other routes and shell loading states. A fixed, full-height decorative layer behind the existing work surfaces runs a 20-second example order-to-delivery loop: receipt, parcel packing/label scan, dispatch truck and delivery confirmation. There is no hero panel, scroll pinning, extra page height or live-order simulation.

The parcel is a generated product-photo asset, not an icon: cardboard fibres, tape, corrugated edges, barcode label and alpha transparency. The warehouse and delivery truck are also generated photographic assets; the route lines, receipt, conveyor and delivery marker remain lightweight vectors. Layered shadows, slow perspective drift and coordinated fades add depth; dashboard controls and text stay above the artwork. The backdrop cannot receive pointer or keyboard input. Existing card surfaces and page-action spacing are unchanged.

The header exposes Pause/Resume background. A hidden browser tab pauses the timeline without resetting it. OS reduced motion and data-saving preferences use a static view, and mobile lowers scene opacity. No new runtime package, video stream, external image service or business/API change is introduced.

Asset: public/images/commerce/parcel-realistic-v1.webp; 960 x 960, transparent WebP, 116492 bytes. Generated with the built-in image-generation tool, then mechanically resized and converted to WebP using the existing Sharp dependency. Original PNG remains at its generated source location. Both light/dark scene colours use existing theme tokens; the parcel retains natural material colours.

Generation prompt (verbatim):
Use case: product-mockup. Asset type: transparent decorative parcel image for an ecommerce operations dashboard background, to animate gently with CSS. Create ONE realistic corrugated kraft-cardboard shipping parcel, closed and securely sealed, seen in a premium three-quarter product-photo view with top, front and right side visible. Natural matte brown cardboard fibres, subtly worn folded edges and corrugated seams, translucent satin packing tape across the top and front, and a small off-white shipping label with a simple unbranded black barcode and tiny abstract grey lines (NO names, addresses, readable numbers or logos). Soft studio key light from upper left, believable ambient occlusion at folds, a delicate semi-transparent contact shadow below the parcel, gentle cool-neutral/emerald bounced light without changing the brown cardboard. Object entirely within frame with 12% clear padding, centered, approximately square composition. Photoreal product photography / high-quality physically based product render, not a cartoon, not an icon, not gold or metallic. GENUINELY TRANSPARENT alpha background; no visible floor, backdrop, border, gradients outside the object, checkerboard, UI, text overlay, extra objects or watermark.

Verification for this addition: generated asset visually inspected and alpha metadata checked; source/JSX/CSS syntax and references checked. Browser timing, composition and real-device performance remain pending. Lint, tests and build were not run.

### Faster loop and realistic warehouse/truck

The shared --journey duration is now 20 seconds rather than 40 seconds, so all stages, route signals, captions and perspective motion stay synchronized at twice the earlier speed. Existing manual pause/resume, hidden-tab pause, reduced-motion and data-saving fallbacks are unchanged.

The line-art warehouse and truck are replaced with matching transparent product-render assets. Warehouse placement stays anchored near the packing area; the right-facing truck follows the existing dispatch movement. Foreground dashboard cards, controls and header spacing are not changed.

New assets (built-in image generation, then mechanical WebP resizing/conversion with existing Sharp):
- public/images/commerce/warehouse-realistic-v1.webp — 960 x 960, alpha preserved, 88434 bytes.
- public/images/commerce/delivery-truck-realistic-v1.webp — 960 x 640, alpha preserved, 82008 bytes.
Original generated PNGs are retained. New versioned files do not overwrite existing assets.

Warehouse generation prompt (verbatim):
Use case: product-mockup. Asset type: isolated photoreal warehouse cutout for a low-opacity ecommerce dashboard background animation. Create ONE realistic compact ecommerce fulfilment warehouse building, viewed from an elevated three-quarter front-right angle so the front facade, right wall and low-pitched roof are visible. Modern light-grey corrugated steel walls, charcoal roof, subtle deep-emerald metal trim, two loading-bay roller doors (one partially open with a few kraft shipping cartons and a pallet visible just inside), one small office door and modest roof vents. Realistic material roughness, seams, bolts and loading-bay details. Include only a small concrete threshold immediately beneath the building, not an outdoor scene or large ground plane. Soft studio key light from upper left and delicate ambient contact shadow, physically based product-render / architecture-model photography, matching a natural cardboard parcel product photograph. Entire building fully inside frame with 12% padding, approximately square composition. GENUINE TRANSPARENT ALPHA BACKGROUND outside the building and its soft shadow. No people, vehicles, trees, skyline, sky, horizon, frame, UI, logos, signs, readable text, numbers, watermarks, drawn outline, cartoon style, toy/plastic sheen or baked checkerboard. Natural neutral colours, not metallic gold.

Truck generation prompt (verbatim):
Use case: product-mockup. Asset type: isolated photoreal delivery truck cutout for a low-opacity ecommerce dashboard background animation. Create ONE realistic compact commercial box delivery truck suitable for Indian ecommerce deliveries, FRONT CAB FACING TO THE RIGHT, cargo box on the left. Elevated three-quarter view showing the broad near-side cargo panel, the front grille/windshield and a little roof. White lightly ribbed cargo box, deep-emerald cab and subtle matching cargo trim, black rubber tyres with authentic tread, steel wheel rims, realistic mirrors, clear windshield with a dim empty cabin, working-detail headlights and slightly used matte/satin paint. No brand badges or license-plate text. Soft studio key light from upper left, natural physically based materials, believable ambient occlusion and a delicate semi-transparent contact shadow under the tyres, matching a natural cardboard parcel product photograph. Entire truck including tyres and mirrors inside frame with at least 10% padding, landscape composition. GENUINE TRANSPARENT ALPHA BACKGROUND outside the vehicle and soft shadow. No driver, people, other vehicles, road, sky, floor backdrop, city, warehouse, logos, readable text, numbers, UI, border, watermark, cartoon outlines, toy/plastic sheen or baked checkerboard. Vehicle must face right.

Verification: generated assets visually inspected; source alpha metadata and transparent corner pixels checked; JSX/CSS syntax and style/asset references checked. Browser visual/timing verification remains pending. Lint/tests/build remain skipped as requested.

### Parcel scale and continuous loading handoff

Parcel width is reduced from 47% to 18% of the shared scene plane. Its visual scale now stays constant while the carrier, image and contact shadow move together. The sequence uses explicit dock, conveyor and truck-loading positions instead of floating, rotating and shrinking the carton independently.

The truck arrives early, remains stationary while the parcel is scanned and loaded, then departs only after loading. A small loading bridge connects the conveyor to the cargo area. The parcel travels behind the truck's rear edge before fading; hidden elements reset without a visible positional jump. The scan is clipped and sized relative to the parcel, not a fixed 240-pixel sweep. Camera drift is much smaller and no longer zooms the entire scene.

The full composition now fits the available viewport in portrait and short landscape instead of forcing an oversized 760/850-pixel canvas that crops the warehouse/truck on mobile. The 20-second duration, photographic assets, pause/hidden-tab/reduced-motion controls, foreground layout and existing action spacing remain unchanged.

Verification: JSX/CSS syntax, style references and animation configuration inspected. Browser composition/timing and real-device smoothness remain unverified. Lint/tests/build remain skipped at the user's request.

### Colourful light-theme dashboard

Light mode now uses clear pastel surface families rather than almost-white cards: teal for today's orders, mint for fulfilment, peach for stock alerts and lilac for return requests. Related task, shortcut, chart and activity panels receive softer coordinated surface colours, coloured headings and subtle tinted borders/shadows. The light dashboard canvas is a pale green-neutral. Colours supplement the existing labels/icons and do not replace status text or alter metric meaning.

All new colour rules explicitly require html:not([data-theme="dark"]) and dashboard-local CSS classes. Dark mode, shared navigation/header, foreground layout, button spacing and the commerce animation are not recoloured or reconfigured. The warm accent is slightly deeper in light mode to keep small coloured text legible on peach/cream surfaces. Loading skeletons carry the same light palette.

Verification: CSS/JSX syntax and theme scoping inspected, selected opaque text/background pairs measured for contrast. This is not a full accessibility audit; browser rendering, hover/state composition and device visual checks remain pending. Lint/tests/build remain skipped at the user's request.
