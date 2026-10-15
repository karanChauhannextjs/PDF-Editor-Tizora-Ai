# Tizora PDF Editor

Browser-based PDF editor: open a PDF, draw shapes and text on each page, manage layers, undo/redo edits, export annotation JSON, or download a PDF with markup embedded.

## Setup and run

Requires **Node.js 20.19+** and npm.

```bash
npm install
```

| Command        | What it does                                                |
| -------------- | ----------------------------------------------------------- |
| `npm run dev`  | Start the Vite dev server (usually `http://localhost:5173`) |
| `npm run lint` | Run ESLint on the project (`--max-warnings 0`)              |
| `npm run test` | Run Vitest once (unit + UI tests)                           |

Other scripts: `npm run build` (production build), `npm run preview`, `npm run format` / `npm run format:check` (Prettier).

---

## Project layout (high level)

```
src/
  components/
    editor/     # PDF editor UI (viewer, toolbar, annotation layer, layers panel)
    ui/         # shadcn/ui primitives (button, dialog, select, …)
  hooks/        # React hooks for PDF loading and annotations
  stores/       # Zustand session persistence (PDF + annotation history)
  utils/        # Reducers, geometry, JSON import/export, pdf-lib export
  types/        # TypeScript models
  test/         # Vitest tests
```

---

## Libraries

| Library                            | Role                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **pdfjs-dist**                     | Load PDFs and render the current page to a `<canvas>` (view only; we do not write PDFs through PDF.js).  |
| **pdf-lib**                        | **Download PDF with annotations**: copy original PDF bytes and draw vector strokes + text in page space. |
| **React** + **TypeScript**         | UI and typed annotation model.                                                                           |
| **Vite**                           | Dev server and build.                                                                                    |
| **Zustand**                        | Persist editor session (annotations + PDF metadata) to IndexedDB.                                        |
| **Tailwind CSS**                   | Layout and styling.                                                                                      |
| **shadcn/ui** + **@base-ui/react** | Accessible UI primitives.                                                                                |
| **lucide-react**                   | Icons.                                                                                                   |
| **sonner**                         | Toast notifications (e.g. successful download).                                                          |
| **Vitest** + **Testing Library**   | Tests.                                                                                                   |
| **ESLint** + **Prettier**          | Lint and format.                                                                                         |

Editing logic (tools, hit-testing, undo, coordinates, JSON schema) lives under `src/`—not a third-party annotation SDK.

### PDF view vs annotated download

1. **View** — PDF.js renders the page bitmap on a canvas.
2. **Annotate** — An SVG overlay (`AnnotationLayer`) sits on top; all shapes/text are vectors in PDF page units.
3. **Export JSON** — Versioned sidecar file for backup and re-import (`annotationPersistence.ts`).
4. **Download PDF** — `downloadAnnotatedPdf` in `pdfExport.ts` uses stored `Uint8Array` bytes + `pdf-lib` to stamp annotations onto a copy of the file (including rotation where applicable).

---

## `src/stores` — Zustand session

**`editorSessionStore.ts`** persists the editor across refresh:

| State               | Purpose                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `annotationHistory` | `{ past, present, future }` undo stack over **all pages** (`AnnotationRootState`).           |
| `pdfSession`        | `fileName`, `pdfData` (byte array), `currentPageIndex` so the same PDF reopens after reload. |
| `blankPage`         | Dimensions when working on annotations without a PDF (e.g. tests / import-only).             |
| `hasHydrated`       | `true` after IndexedDB rehydrate (avoids flashing empty UI on load).                         |

Storage uses **`createJSONStorage` + `createIdbStorage()`** (`src/utils/idbStorage.ts`) with key `tizora-editor-session-v1`. In tests, hydration is skipped via `import.meta.env.VITEST`.

Helpers: `cloneAnnotationHistory`, `resetEditorSessionStoreForTests` (used in `src/test/setup.ts`).

---

## `src/components/ui` — shadcn/ui

Installed via [shadcn](https://ui.shadcn.com/) (see `components.json`). Primitives used in the editor include:

- `button`, `input`, `textarea`, `select`, `dialog`, `alert`, `separator`, `tooltip`, `sonner` (toasts)

These wrap **@base-ui/react** where needed and use **Tailwind** + `cn()` from `src/lib/utils.ts`. ESLint turns off `react-refresh/only-export-components` for `src/components/ui/**` because shadcn files often export variants alongside components.

---

## Hooks (`src/hooks`)

### `usePdfDocument`

Owns the **PDF.js document lifecycle**:

- Validates `%PDF` header before load (`hasPdfHeader`, `readFileBytes`).
- Keeps a **separate `Uint8Array`** of file bytes (`pdfBytesRef`) because PDF.js can detach the buffer you pass in—required for **Download PDF**.
- Renders the current page to the canvas with device-pixel ratio; avoids re-rendering when only annotations change (canvas snapshot + `requestId`).
- **`goToPage`** — serializes page changes (ignores overlapping navigations until render completes).
- **`loadFromBytes` / `unloadPdf`** — open from file or restored session; clear document on remove.

Returns: `phase`, `page`, `pageCount`, `currentPageIndex`, `fileName`, `handleCanvasRef`, `getPdfBytes`, `goToPage`, `error`, etc.

### `useAnnotations`

Owns **per-page annotation state** and **undo/redo** on top of the Zustand store:

- Reads `annotationHistory.present` and slices the current page via `getPageSlice`.
- **`dispatch`** — forwards actions to `annotationRootReducer` with `pageIndex`.
- **`beginHistoryTransaction` / `endHistoryTransaction`** — one pointer gesture (drag move, resize, rotate, color picker drag) = **one** undo step.
- **`undo` / `redo`** — swap `present` with `past` / `future`; clears any open transaction; history capped at **80** steps.
- Actions that **do not** record history: `select`, `setPageDimensions`.
- **`replaceDocument` / `replacePage` / `exportRootState`** — import JSON and export.

### `usePdfEditor` (orchestration)

Composes `usePdfDocument` + `useAnnotations` + session restore, file open/import/export, keyboard shortcuts, tool/style state, and confirm dialogs. **`PdfEditor.tsx`** is a thin shell that calls this hook and renders subcomponents (`PdfEditorHeader`, `PdfEditorChrome`, `PdfEditorWorkspace`, etc.).

---

## Drawing shapes (pointer down → move → up)

Flow is implemented in **`AnnotationLayer.tsx`** with helpers in **`annotationGeometry.ts`** and **`annotationTransform.ts`**.

| Step             | What happens                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pointer down** | `handlePointerDown` — `clientToPagePoint` maps screen coords to PDF page units using the SVG `viewBox`. For rectangle/circle/line tools, starts a `draw` drag with `setPointerCapture`.               |
| **Pointer move** | `handlePointerMove` — `shapeDraftFromDrag(tool, start, point, page)` builds a live preview (`preview` state).                                                                                         |
| **Pointer up**   | `handlePointerUp` — `isSignificantShape(draft)` drops tiny clicks; else `annotationFromDraft(draft, stroke, strokeWidth)` then `dispatch({ type: 'add', annotation })` after `clampAnnotationToPage`. |

**`shapeDraftFromDrag`** (geometry):

- **Rectangle** — normalizes negative width/height from drag box.
- **Circle** — center + radius from drag (diameter-style drag).
- **Line** — `start` and `end` points.

**Text** — pointer down with Text tool calls `onTextRequest` → inline `TextAnnotationEditor` → `add` on save.

**Select mode** — `handleAnnotationPointerDown` selects; drag moves annotation (`move` + `updateAnnotation`); corner handles **`resizeAnnotation`**; rotate handle uses **`rotateAnnotation`** (circles have no rotate handle).

---

## Undo / redo

Model: classic **past / present / future** stacks in `annotationHistory` (`editorSessionStore`).

- Each meaningful reducer action clones `present` into `past` and clears `future` (`useAnnotations.applyAction`).
- **Transactions**: `beginHistoryTransaction` snapshots state at gesture start; `endHistoryTransaction` pushes that snapshot only if `present` changed—so dragging a shape once undoes as one step.
- **Undo** (`useAnnotations.undo`): pop `past` → new `present`, push old present to `future`.
- **Redo**: pop `future` → new `present`, push old present to `past`.
- Toolbar **Undo / Redo** and keyboard shortcuts are wired in `usePdfEditor`.
- Style bar color changes batch via begin/end transaction on picker focus/blur.

Reducer entry points: **`annotationReducer.ts`** (single page), **`annotationRootReducer.ts`** (page index + all pages).

---

## Layers (stacking order)

- Annotations are stored in an **ordered array** per page. **Later items paint on top** in the SVG (`annotations.map` in `AnnotationLayer`).
- **`AnnotationListPanel`** shows layers **top-first** (reversed list) with “Top items draw above lower ones.”
- **Move up / down** call `dispatch({ type: 'reorder', id, direction: 'forward' | 'backward' })`.
- **`annotationReducer` `reorder`** swaps the item with its neighbor in the array (`forward` = toward end of array = visually higher).

---

## Rotation

- Shapes (not circles) expose a **rotate handle** via `SelectionHandles` + `getRotateHandlePoint` / `getRotateHandleAnchor` in `annotationTransform.ts`.
- Drag sets `DragState` kind `'rotate'`; on move, **`rotateAnnotation`** updates `rotation` degrees around the shape pivot (`getAnnotationPivot`).
- **`AnnotationItem`** applies `transform="rotate(...)"` when rendering.
- **PDF export** applies the same rotation when drawing with pdf-lib.

Resize uses **`resizeAnnotation`** with handle ids (`nw`, `se`, `start`, `end`, `radius`, `text-scale`, etc.).

---

## ESLint configuration

File: **`eslint.config.js`** (flat config).

| Area              | Rules / plugins                                                                        |
| ----------------- | -------------------------------------------------------------------------------------- |
| **Ignores**       | `dist`, `node_modules`, `coverage`, `public`, `**/*.min.mjs`                           |
| **Base**          | `@eslint/js` recommended                                                               |
| **TypeScript**    | `typescript-eslint` recommended                                                        |
| **React**         | `eslint-plugin-react-hooks` (recommended), `eslint-plugin-react-refresh`               |
| **react-refresh** | `only-export-components`: warn (off for `src/components/ui/**` and `FileControls.tsx`) |
| **Prettier**      | `eslint-config-prettier` disables conflicting formatting rules                         |

Run: `npm run lint`.

---

## Prettier configuration

File: **`.prettierrc.json`**

| Option          | Value    |
| --------------- | -------- |
| `semi`          | `false`  |
| `singleQuote`   | `true`   |
| `trailingComma` | `all`    |
| `tabWidth`      | `2`      |
| `printWidth`    | `100`    |
| `arrowParens`   | `always` |
| `endOfLine`     | `lf`     |

Run: `npm run format` or `npm run format:check`.

---

## Tests (Vitest)

Config in **`vite.config.ts`**: environment **`happy-dom`**, setup **`src/test/setup.ts`** (resets editor store, jest-dom matchers).

| File                                | What it covers                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`PdfEditor.test.tsx`**            | UI: create text annotation; no delete while editing text; toolbar undo; invalid PDF shows alert (PDF.js mocked). |
| **`annotationReducer.test.ts`**     | Add/delete; move rectangle, circle, line.                                                                        |
| **`annotationRootReducer.test.ts`** | Annotations isolated per page index.                                                                             |
| **`annotationHistory.test.ts`**     | Redo restores stroke color after undo; history snapshots not mutated.                                            |
| **`annotationGeometry.test.ts`**    | Rectangle drag normalization; pointer → page coordinate mapping.                                                 |
| **`annotationPersistence.test.ts`** | JSON v1/v2 round-trip, sample document, malformed JSON / bad types rejected.                                     |
| **`pdfExport.test.ts`**             | Annotated PDF bytes embed markup via pdf-lib.                                                                    |
| **`fileValidation.test.ts`**        | Non-PDF file rejected.                                                                                           |

Run: `npm run test`.

---

## Design notes

- **Canvas + SVG** — PDF.js renders pixels; SVG handles interaction and crisp vectors.
- **JSON sidecar** — Structured editing and import validation; multi-page v2 matches in-memory root state.
- **Client-only** — Password-protected or huge PDFs are limited by browser memory.
- **Download vs JSON** — Download bakes visuals into PDF; re-editing vectors from that file alone is not supported (use JSON export for round-trips).
