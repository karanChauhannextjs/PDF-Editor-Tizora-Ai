# Tizora PDF Editor

Browser-based PDF editor: open a file, annotate pages with shapes and text, export JSON for backup, or download a PDF with the markup baked in.

## Run it

You need **Node 20.19+** and npm.

```bash
npm install
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`). Other useful commands: `npm run build`, `npm run test`, `npm run lint`.

## Major libraries

| Library | Role in this project |
| --- | --- |
| **React** + **TypeScript** | UI and typed annotation model |
| **Vite** | Dev server and production build |
| **pdfjs-dist** | Load PDFs and render the current page to a `<canvas>` (view only—we do not write PDFs through PDF.js) |
| **pdf-lib** | Build the “Download PDF” file: copy the original bytes and draw vector/text annotations on top |
| **Tailwind CSS** | Layout and styling |
| **shadcn/ui** + **@base-ui/react** | Buttons, dialogs, selects, tooltips, alerts |
| **lucide-react** | Toolbar icons |
| **@fontsource-variable/geist** | App font |
| **Vitest** + **Testing Library** | Unit tests for reducers, geometry, JSON import, export edge cases |
| **ESLint** + **Prettier** | Lint and format |

Everything that feels like “the editor” (tools, hit-testing, undo, JSON schema, coordinate math) is our code under `src/`, not a PDF annotation SDK.

## What we built ourselves

**PDF loading (`usePdfDocument`, `src/lib/pdfjs.ts`)**  
Files are validated (`%PDF` header) before PDF.js runs. We keep a separate `Uint8Array` of the file because PDF.js detaches the buffer you pass in—without that copy, annotated PDF download would break. The page is rendered once per document/page/canvas; the canvas ref is stable so annotation updates do not trigger a full re-render and flicker. Page navigation loads another page from the same document.

**Coordinates (`src/utils/coordinates.ts`, SVG overlay)**  
Annotations live in PDF page units (width/height from PDF.js at scale 1). The SVG `viewBox` matches that space and stretches with the canvas. Pointer positions go through `clientToPagePoint` using the SVG’s bounding rect so resizing the window or zooming the browser does not throw off placement.

**Drawing and editing (`AnnotationLayer`, `annotationGeometry.ts`, `annotationTransform.ts`)**  
Shapes come from pointer drag with capture: preview on move, commit on up. Rectangles normalize negative width/height; circles use the drag as a diameter; lines store endpoints. Select mode supports move, resize handles, and rotation (except circles). Text uses an inline editor; font size from the dropdown is also the min/max when resizing by handle (`clampFontSize` in `annotationStyle.ts`).

**State (`useAnnotations`, `annotationReducer`, `annotationRootReducer`)**  
Per-page annotation lists sit in a root state keyed by page index. A small reducer handles add/update/delete/move/reorder/style changes. Undo/redo keeps a bounded history; drag operations wrap in `beginHistoryTransaction` / `endHistoryTransaction` so one gesture is one undo step.

**Persistence (`annotationPersistence.ts`)**  
Export produces versioned JSON: v1 single-page or v2 multi-page. Import validates types, ids, numbers, colors, and page metadata before applying anything. Wrong page size vs the open PDF scales annotations and shows a notice. Filenames for export/download include `Date.now()` so repeated saves do not overwrite in the downloads folder.

**PDF export (`pdfExport.ts`)**  
Uses stored PDF bytes + `pdf-lib` to draw strokes and text in page space, including rotation where it matters. This is separate from the JSON sidecar: JSON is for editing round-trips; download is for sharing a single file.

**UI shell (`PdfEditor.tsx`)**  
Toolbar, style bar (shape vs text controls), layers panel, empty state, and confirm dialogs when opening a new PDF or import would wipe annotations.

## Design choices (short)

- **Canvas + SVG stack** — PDF.js is good at rendering; SVG is good at interactive vectors. We do not try to annotate inside the canvas bitmap.
- **JSON sidecar** — Easy to validate, diff, and import without parsing PDF internals. Multi-page v2 matches how we store state in memory.
- **pdf-lib only for download** — Keeps the editing path simple; embedding at export time is enough for the MVP deliverable.
- **Strict import validation** — Bad files fail with a clear message instead of partially rendering garbage.
- **Desktop-first layout** — Page width capped (~960px CSS) so the sheet and overlay stay aligned on typical screens.

## Tests

`npm run test` covers reducer moves/deletes, geometry helpers, JSON parse errors, PDF byte handling for export, and a few UI flows with PDF.js mocked where needed.

## Limits worth knowing

Password-protected PDFs are rejected. Very large PDFs are limited by browser memory like any client-only tool. Export JSON is the source of truth for editing; if you only keep the downloaded PDF, you cannot re-import vector edits as structured annotations (that would need a different format).
