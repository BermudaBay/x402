# Retro: homepage layout / “format is off” (Mar 2026)

## What went wrong

- **Mobile header:** Wordmark and the collapsible “How this demo works” block read as one tangled region—easy to perceive as overlap or wrong stacking when padding and row boundaries were weak.
- **Link color:** Next.js `<Link>` renders `<a>`. Without explicit `no-underline` / `visited:` styles, some browsers showed **default visited purple** on parts of the wordmark or other links, clashing with the teal/gold palette.
- **Hero rhythm:** Tight vertical gaps made the CTA and feature row feel crushed; **min-height** was a bit short on some phones, so **“The collection”** sat awkwardly at the fold.
- **Scroll targets:** `#bermuda-collection` did not account for the **sticky two-row header** + safe area, so anchored scroll could hide the section title under the header.

## Fixes applied (reference)

- `Header.tsx`: Outer `flex flex-col`; clear **row 1** = logo + actions only; **row 2** = mobile details with stronger border/spacing; wordmark `block` + `visited:text-white` + `no-underline`; safe-area top padding.
- `HeroBanner.tsx`: Slightly taller shell, more `py` / gaps, explicit CTA link `no-underline` + `visited:text-bermuda-950`.
- `ProductGrid.tsx`: Larger `scroll-mt` tied to header + safe area; more section padding.
- `globals.css`: `scroll-padding-top` on `html` for in-page anchors.

## Don’t repeat — checklist before shipping UI

1. **Resize:** Chrome DevTools—**375px**, **390px**, **sm/md/lg** breakpoints; confirm header rows don’t merge visually.
2. **Links:** Any `<Link>` used as branding or on dark backgrounds—set **`no-underline`** and **`visited:`** to match hover/focus colors.
3. **Sticky header + anchors:** After changing header height, update **`scroll-mt`** on target sections and **`scroll-padding-top`** on `html`.
4. **Safe areas:** Test with iOS safe-area insets (`env(safe-area-inset-top)`) on sticky chrome.
5. **Run** `npm run verify` **and** a quick **manual scroll** (hero → Shop the Collection → collection title fully visible).

## Related files

- `components/Header.tsx`, `HeroBanner.tsx`, `ProductGrid.tsx`
- `app/globals.css`
