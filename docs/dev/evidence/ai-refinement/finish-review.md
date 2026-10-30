disposition: fix

## persistence

Pass. PRODUCT.md exists; this is a local extension of the established Android Operate/Read surface, so a concept roll, approved comp, QUALITY BAR card, comp build state and DESIGN.md change are not applicable. PRODUCT.md:11 still describes a prototype-only project; this is pre-existing documentation drift to preserve and report, not repair in this task. Seven supplied phone captures exist and were opened: comparison, vision formula/table, applied reader, undone reader, dark large text, dark actions, and original PDF dark large text. Their content and dimensions match their stated scope; the scrolled sheet tops are valid. No HTML/CSS detector ran, as required for native.

## fidelity

| Element or promise | Assessment | Evidence |
| --- | --- | --- |
| TYPE | match | RefinementSheet.tsx:235–241 reuses incumbent body, label and bookBody roles; dark 1.3× captures show readable wrapping and accessible actions. The AI provenance controls are state/actions, not decorative heading kickers. |
| MATERIAL | match | Existing Sheet, CheckRow, Segmented, Button, Note and ProgressBar are reused; no invented physical material, glyph icon system or decorative skin is introduced. |
| GROUND | match | Captured paper surfaces follow incumbent tokens (light surface #FFFFFF; dark surface #1C1D21); new styles use role tokens. No separate comp ground is authoritative. |
| Entry and scope | match | Independent Reader and Study read toolbars plus the Study menu expose current-section refinement; scope, model, mode and image-sharing explanation are visible. |
| Source/suggestion comparison | contradicted | phone-vision-formula-light.png and phone-dark-actions.png expose the full HTML table string rather than its cell structure. The same string-only path exposes LaTeX syntax for nontrivial formulas (useRefinementVM.ts:197–208; RefinementSheet.tsx:191–198). This weakens the promised human verification before adoption. |
| Selective adoption through source verification | contradicted | CheckRow changes only local selected state (useRefinementVM.ts:244–248). “查看原文” closes the sheet (useStudyVM.ts:927–929); reopening reloads persisted document.selected (useRefinementVM.ts:75–87), which is initially every generated edit. Previously rejected suggestions are silently selected again. |
| Applied and undone reading | match | phone-reader-light.png shows repaired paragraph, rendered equation/table and AI provenance; phone-undone-light.png restores the broken OCR and retains the existing code reading controls. |
| Native interaction and large text | match within supplied evidence | Existing Sheet handles Android Back, safe areas and Reduce Motion; phone-dark-large.png and phone-dark-actions.png show the new workflow at font_scale 1.3 without clipped new controls. |
| Demonstration truth | match | The source fixture is visibly marked local synthetic acceptance data; the service name is local acceptance. Real LLM OCR accuracy is explicitly untested. |

## ceiling

The incumbent phone UI is the authority for this extension; no new-world devices or motion treatment are owed. Actual screenshots cover paper light/dark only; the other four skins have renderer interaction coverage, not device visual evidence. The supplied Android emulator captures do not prove physical-device gesture behavior or real LLM recognition accuracy. These are evidence limits, not additional feature work.

## material_fixes

1. [P1 — selective-adoption promise] src/features/study/useRefinementVM.ts:75–87,244–248 and src/features/study/useStudyVM.ts:927–929: preserve the current draft selection across closing, original-source inspection and reopening the same run; initialize selection only when loading a different/new run or explicitly regenerating. Verify: deselect one suggestion, inspect the original, reopen, and confirm its unchecked state and adoption count remain unchanged.
2. [P2 — readable verification promise] src/features/study/useRefinementVM.ts:197–208 and src/ui/screens/RefinementSheet.tsx:191–198: pass typed before/after content and render equations and table cells using the incumbent math/table presentation capabilities, with source syntax available as a secondary disclosure if useful; verify both themes and 1.3× text using the same native comparison captures.

## keep

Preserve optional current-section scope, explicit PDF-sharing copy, immutable raw source and geometry, per-edit adoption, undo, shared reader/chat/translation projection, checkpointed batches, existing five-skin tokens and the compatible code-reading UI.
