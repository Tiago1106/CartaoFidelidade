---
name: implement-screen
description: How to build a screen of the Freguês app from its approved design file. Use for every screen task (customer, staff, owner), before writing any screen code.
---

# Implement a screen

The approved design is in `docs/design/screens/`. The `.dc.html` files are the specification. Read them as source text. Do not try to render them (D-009).

## Steps

1. **Find the files.** The screen table in `docs/PRD.md` (section 6) gives the number and name. Open the matching `.dc.html`, for example `Inicio-Selecionado.dc.html` for 06.1. The `README.md` in that folder lists every file.
2. **Read the screen and what it imports.** Every `<dc-import name="X">` points to `X.dc.html`. Read each one for its props and states. Use the component mapping table in `CLAUDE.md` to find the code name (for example `Campo` is `TextField`). Reuse the components that already exist in `apps/web/src/components/`. If a component is missing, stop and make it a separate design-system task. Do not build it inline inside the screen.
3. **Read the rules.** Open `docs/BUSINESS_RULES.md` and read every `RN-...` that the PRD row cites, plus the ones you find by searching for the screen's words. The rules beat the design where they disagree. In that case, stop and ask Tiago.
4. **Copy the measures exactly.** Padding, gaps, font sizes, weights, radii and colors come from the inline styles. Use the tokens from `index.css` and the Tailwind classes that map to them. Do not write raw hex values in screens. The only dynamic color is `program.cardColor`.
5. **User-facing text.** Copy every string exactly as written in the design, including accents and punctuation. Put it in `apps/web/src/messages/pt-BR.ts` under a key named in English (for example `signIn.phone.title`). Screens read text from there. No Portuguese strings inside components or logic.
6. **Names in English.** Component, hook, function, file and route names are English (decision D-011). The route for each screen is listed there or in `docs/DECISIONS.md`. Add new routes in English.
7. **Data.** Screens read data only through hooks (decision D-008). In Phase B the hooks return fixtures. In Phase C they call the API. Fixture values should be the sample values shown in the design (for example Maria, Barbearia Navalha), so the screenshot matches.
8. **States.** Build every state the design shows (empty, selected, error, disabled, complete). Add a simple loading state and a simple error state when the screen fetches data. Keep them minimal and consistent.
9. **Accessibility.** Real `button`, `a`, `label` and `input` elements. Visible focus ring. Touch targets of at least 44 px. Sheets are `role="dialog"` with `aria-modal`, close with the X in the top-right corner, and trap focus. Never convey state by color alone.
10. **Mobile first.** The phone frame is 390 x 844. Check 360 x 640 too, with no horizontal scroll. Respect the safe area at the bottom (the bottom bar has 24 px of padding for it).
11. **Test.** Add a Vitest and Testing Library test for the behavior (for example: the button stays disabled until the phone is valid) and one Playwright screenshot test at 390 x 844. Save the screenshot in `docs/evidence/<task-id>/`.
12. **Deliver** with the `approval-workflow` skill, and include a checklist comparing the screenshot with the design: layout, spacing, type, colors, texts, states.

## Things that are easy to get wrong

- Sheets close with the X at the top-right. Never add a "Fechar" button at the bottom.
- The customer's QR always shows the countdown bar and "Renova em 0:NN". The counter QR (screen 26) does not renew.
- Stamped squares use the inverted seal. Empty ones are dashed circles.
- Amber text on a light background uses `primary-ink`, not `primary`.
- The "Meu QR" tab stays in the customer bottom bar (RN-ENT-09).
- Do not use the word "salão" in general copy for customers. Use what the design says.
