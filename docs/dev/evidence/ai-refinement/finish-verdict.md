## verdict

1. P1 — resolved. The overwritten phone-dark-actions.png shows the table suggestion still unchecked and the action reading “采纳 3 处修改” after the reported original-source round trip. useRefinementVM.ts:91–94 now initializes selection only for a different run; lines 61–62 clear it on scope change and lines 140–142 reset it for generation results. The added same-run/new-run regression targets the original failure.
2. P2 — resolved. The overwritten phone-vision-formula-light.png and added phone-vision-formula-dark-large.png show rendered x = O / x = 0 equations and aligned Item/Count table cells rather than HTML/LaTeX strings. The comparison remains readable in light 1.0× and dark 1.3×; phone-dark-actions.png retains the accessible adoption action. RefinementSheet.tsx:196–199,244–264 uses the typed preview and incumbent MathView, with horizontally scrollable table cells.

No material regressions from this fix batch are visible in the four reopened captures. This ship verdict covers the two scored fixes only.

## remaining

clear

disposition: ship
