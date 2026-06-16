# QA Checklist

## Must Pass

- The source material came only from the project `README.md`.
- The image is 16:9 horizontal.
- The background is clean white.
- Repo character appears.
- Repo character performs the core action instead of decorating the scene.
- The composition does not copy old examples; it invents a new metaphor for this README.
- The image feels absurd, creative, and interesting.
- The layout is clean and sparse; the main subject uses no more than about 60% of the canvas.
- One image explains only one core structure.
- English annotations are sparse, short, readable, and correctly spelled.
- Orange is used only for the main path, flow, or arrows.
- Red is used only for emphasis, problems, warnings, or results.
- Blue is used only for secondary notes, feedback, or system state.

## Failure Signals

If any of these appear, regenerate or locally edit:

- The concept depends on source code, package files, docs, issues, or any file other than README.md.
- The top-left corner has a generic title like "Workflow", "Architecture", "Roadmap", or "Features".
- Repo character looks like a mascot, meme, cute cartoon, or children's character.
- The image looks like a PPT slide, course material, or formal flowchart.
- There are too many elements, arrows, or nodes.
- Text becomes paragraph-length explanation.
- The background has paper texture, shadows, gradients, beige tint, or noise.
- The image includes realistic UI screenshots or glossy tech-interface styling.
- English labels are misspelled, too long, or unreadable.
- Chinese text appears anywhere in the generated image.
- The image feels rigid and lacks an absurd metaphor.
- The composition is too similar to examples in `assets/examples/`.

## Iteration Methods

- Too ordinary: make the repo character the action subject and add a strange but coherent metaphor.
- Too complex: remove nodes; keep one action and 3-5 short labels.
- Too cute: emphasize deadpan, blank serious expression, not cute, not mascot.
- Too PPT-like: remove titles, frames, tidy grids, and excess arrows; turn it into a hand-drawn scene.
- Too similar to old examples: keep the core idea, but change the main object and the repo character's action.
- Text errors: locally edit first; if many labels are wrong, regenerate with fewer labels.

## Delivery Judgment

A strong README illustration should make the reader think "that is a little strange" and then understand the repo idea within about one second.

If the first impression is a tutorial page instead of a strange product sketch on white paper, it fails.
