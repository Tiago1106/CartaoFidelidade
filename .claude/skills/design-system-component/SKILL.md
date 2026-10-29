---
name: design-system-component
description: How to build or change a reusable UI component for Freguês (shadcn base plus product composites), with a Storybook story. Use for every design-system task and whenever a screen needs a component that does not exist yet.
---

# Design-system component

## Where things live

- shadcn primitives: `apps/web/src/components/ui/`.
- Product composites (`ProgramCard`, `BottomNav`, `StampSeal`, ...): `apps/web/src/components/product/`.
- One folder per component with `index.ts`, the component, its story (`*.stories.tsx`) and its test (`*.test.tsx`).
- Tokens and type scale: `apps/web/src/index.css` (values are in `CLAUDE.md`).

## Steps

1. **Read the design.** Open the component's `.dc.html` in `docs/design/screens/` (the mapping table in `CLAUDE.md` gives the Portuguese design name and the English code name). Note every prop, every state and every measure from the inline styles and the `renderVals` logic at the end of the file.
2. **Start from shadcn when it exists** (Button, Input, Label, Checkbox, RadioGroup, Progress, Badge, Avatar, ...). Restyle it with the product tokens. Do not fork behavior without a reason.
3. **API of the component.** Props in English, camelCase. Variants with `class-variance-authority`. Forward `ref` and `className`. Native attributes pass through. No logic that belongs to a screen.
4. **Tokens only.** No raw hex in components, no arbitrary pixel values when a token or type-scale class exists. The only dynamic color is `cardColor` (and the text color derived from it by the contrast function).
5. **States.** Implement every state the design shows (default, focus, error, disabled, selected, blocked, complete, ...). The Storybook story shows all of them side by side.
6. **Accessibility.** Correct roles (`radiogroup`, `tablist`, `progressbar`, ...), labels, `aria-*`, a visible focus ring (2 px `ring`), a touch target of at least 44 px, state not only by color. Test with Testing Library queries by role.
7. **Text.** Components never contain hard-coded Portuguese. Visible text comes from props or from the messages file. Default stories may pass sample Portuguese text as props.
8. **Story.** Title in English, for example `Product/ProgramCard`. Use the 390 px viewport. Include a story per state and one "all states" story. Add controls for the main props.
9. **Test.** Behavior and logic only (contrast choice, keyboard handling, disabled behavior). Do not test pixel values in unit tests.
10. **Screenshot.** Capture each story with Playwright at the design size and save it to `docs/evidence/<task-id>/`.
11. **Compare with the design** and fix differences before delivering. List what you compared in the delivery message.
12. **Deliver** with the `approval-workflow` skill. Tiago will check the stories in Storybook.

## Notes

- Do not add a dependency without a reason. Icons come from `lucide-react` (the mapping is in `CLAUDE.md`).
- The seal (`StampSeal`) is drawn from the SVG in `docs/design/logo/svg/`. Copy the paths. Do not redraw it.
- Contrast: a pure function `getReadableTone(cardColor)` returns `'light'` or `'dark'`. It has tests with the eight palette colors in `docs/BUSINESS_RULES.md` (RN-CAR-03).
