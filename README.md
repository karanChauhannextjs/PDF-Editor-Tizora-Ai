# Tizora PDF Editor

Browser-based PDF editor: open a PDF, draw shapes and text on each page, manage layers, undo/redo edits, export annotation JSON, or download a PDF with markup embedded.

## Setup and run

Requires **Node.js 20.19+** and npm (Vite 8 and several dev tools declare the same minimum). If `npm install` prints `EBADENGINE` and shows `v20.18.x`, upgrade Node (e.g. `nvm install` using `.nvmrc`, or install [Node 20.19+](https://nodejs.org/)).

The UI uses copied shadcn components under `src/components/ui/`; theme helpers live in `src/styles/shadcn-tailwind.css` (vendored from shadcn). Add new primitives with `npx shadcn@latest add <component>` when needed.

```bash
npm install
npm run dev    # local dev server (usually http://localhost:5173)
npm run lint   # ESLint, zero warnings allowed
npm run test   # Vitest (unit + UI tests)
```

Other scripts: `npm run build`, `npm run preview`, `npm run format`, `npm run format:check`.

## Project layout

```
src/
  components/editor/   PDF shell (viewer, file/page controls); pdfEditor/ and annotation/ subfolders
  components/ui/       shadcn/ui primitives
  hooks/               usePdfDocument, useAnnotations, usePdfEditor
  stores/              Zustand + IndexedDB session
  utils/               reducers, geometry, JSON, pdf-lib export
  types/               TypeScript models
  styles/              Vendored shadcn Tailwind helpers (`shadcn-tailwind.css`)
  test/                Vitest tests
public/                static assets (logo, PDF.js worker, favicon)
```

---

## Libraries

- **pdfjs-dist** — Load PDFs and render the current page to a `<canvas>` (view only).
- **pdf-lib** — Build **Download PDF**: copy original bytes and draw vector strokes + text.
- **React + TypeScript** — UI and annotation model.
- **Vite** — Dev server and production build.
- **Zustand** — Persist session (annotations + PDF metadata) in IndexedDB.
- **Tailwind CSS** — Layout and styling.
- **shadcn/ui + @base-ui/react** — Buttons, dialogs, selects, tooltips, alerts.
- **lucide-react** — Icons.
- **sonner** — Toast notifications.
- **Vitest + Testing Library** — Tests.
- **ESLint + Prettier** — Lint and format (code only; not this README).

Editing logic lives under `src/` (not a third-party annotation SDK).

### PDF view vs annotated download

1. **View** — PDF.js renders the page on a canvas.
2. **Annotate** — SVG overlay (`AnnotationLayer`) in PDF page units.
3. **Export JSON** — Versioned sidecar (`annotationPersistence.ts`).
4. **Download PDF** — `downloadAnnotatedPdf` in `pdfExport.ts` uses stored bytes + pdf-lib (including rotation).

---

## `src/stores` (Zustand)

**File:** `editorSessionStore.ts`

- **`annotationHistory`** — `{ past, present, future }` undo stack for all pages.
- **`pdfSession`** — `fileName`, `pdfData`, `currentPageIndex` for reload after refresh.
- **`blankPage`** — Page dimensions without a PDF (tests / import-only).
- **`hasHydrated`** — True after IndexedDB rehydrate (avoids empty flash on load).

Persistence: `createJSONStorage` + `idbStorage.ts`, key `tizora-editor-session-v1`. Tests skip hydration via `import.meta.env.VITEST`.

Helpers: `cloneAnnotationHistory`, `resetEditorSessionStoreForTests` (`src/test/setup.ts`).

---

## `src/components/ui` (shadcn)

Installed via [shadcn](https://ui.shadcn.com/) (`components.json`). Used primitives include `button`, `input`, `textarea`, `select`, `dialog`, `alert`, `separator`, `tooltip`, `sonner`.

ESLint disables `react-refresh/only-export-components` under `src/components/ui/**`.

---

## Hooks (`src/hooks`)

### `usePdfDocument`

PDF.js lifecycle: validate `%PDF`, keep a copy of bytes for download, render page to canvas, `goToPage` with navigation lock, `loadFromBytes` / `unloadPdf`.

### `useAnnotations`

Per-page state + undo/redo: `dispatch`, `beginHistoryTransaction` / `endHistoryTransaction` (one gesture = one undo), `undo` / `redo` (max 80 steps). Skips history for `select` and `setPageDimensions`.

### `usePdfEditor`

Orchestrates PDF + annotations + session restore, files, shortcuts, and `PdfEditor` subcomponents.

---

## Drawing shapes (press → drag → release)

**Files:** `AnnotationLayer.tsx`, `annotationGeometry.ts`, `annotationTransform.ts`

1. **Pointer down** — `handlePointerDown` → `clientToPagePoint`; rectangle/circle/line start a `draw` drag.
2. **Pointer move** — `shapeDraftFromDrag` updates preview.
3. **Pointer up** — `isSignificantShape`, then `annotationFromDraft` → `dispatch({ type: 'add' })` → `clampAnnotationToPage`.

- **Rectangle** — normalized box from drag.
- **Circle** — center + radius from drag.
- **Line** — start and end points.
- **Text** — `onTextRequest` → `TextAnnotationEditor` → save adds annotation.
- **Select** — move, `resizeAnnotation`, `rotateAnnotation` (no rotate on circles).

---

## Undo / redo

Stacks in `annotationHistory` (Zustand). Meaningful actions push `present` to `past` and clear `future`. Transactions batch drags and color-picker edits. Reducer: `annotationReducer.ts` (page), `annotationRootReducer.ts` (all pages).

---

## Layers

Array order = paint order (later = on top). **Layers** panel lists top-first; **up/down** dispatches `reorder` with `forward` | `backward` (swap with neighbor in the array).

---

## Rotation

Rotate handle on shapes (not circles): `rotateAnnotation`, pivot from `getAnnotationPivot`. SVG `transform` in `AnnotationItem`; pdf-lib on export. Resize via `resizeAnnotation` and handle ids (`nw`, `se`, `start`, `end`, etc.).

---

## ESLint (`eslint.config.js`)

- **ESLint 10** + **@eslint/js** + **typescript-eslint** (recommended + **type-checked** on `src/**/*.{ts,tsx}` via `projectService`)
- **Strict typing rules:** `no-explicit-any`, `no-unsafe-*` (assignment, call, argument, member access, return)
- **react-hooks** recommended, **react-refresh** (`only-export-components` warn; off for `ui/**` and `FileControls.tsx`)
- **eslint-config-prettier** — no style conflicts with Prettier
- **Ignores:** `dist`, `node_modules`, `coverage`, `public`, `**/*.min.mjs`, `eslint.config.js`, `vite.config.ts`

Run: `npm run lint` (zero warnings)

---

## Prettier (`.prettierrc.json`)

`semi: false`, `singleQuote: true`, `trailingComma: all`, `tabWidth: 2`, `printWidth: 100`, `arrowParens: always`, `endOfLine: lf`.

Run: `npm run format` (does not touch `README.md`).

---

## Tests (Vitest)

**Config:** `vite.config.ts` — `happy-dom`, setup `src/test/setup.ts`.

| Test file | Covers |
|-----------|--------|
| `PdfEditor.test.tsx` | Text tool, edit guard, toolbar undo, invalid PDF alert |
| `annotationReducer.test.ts` | Add/delete, move shapes |
| `annotationRootReducer.test.ts` | Per-page isolation |
| `annotationHistory.test.ts` | Redo stroke color, snapshot immutability, one undo per drag gesture |
| `annotationGeometry.test.ts` | Rectangle drag, pointer mapping |
| `annotationPersistence.test.ts` | JSON v1/v2, validation errors |
| `pdfExport.test.ts` | Embedded annotations in PDF bytes |
| `fileValidation.test.ts` | Reject non-PDF |

Run: `npm run test`

---

## Design notes

- **Canvas + SVG** — PDF.js for pixels, SVG for interaction.
- **JSON sidecar** — Round-trip editing; multi-page v2 in memory and on disk.
- **Client-only** — Large or encrypted PDFs limited by the browser.
- **Download vs JSON** — Download is flat PDF; use JSON to edit again.

