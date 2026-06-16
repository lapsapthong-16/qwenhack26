# Image Generation Prompt Template

Generate each image separately. Replace variables using only the project's `README.md` content. Do not combine multiple images into one.

```text
Generate one standalone 16:9 horizontal README illustration for a project repository.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten English annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character required:
Repo character, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. The repo character must perform the core conceptual action, not decorate the scene. Make the repo character serious, deadpan, and slightly bizarre, not cute.

Theme:
{README illustration theme}

Structure type:
{structure type: workflow / system slice / before-after / role state / concept metaphor / layered method / route map / mini comic panel}

Core idea:
{core idea this image should communicate}

Composition:
{specific scene: where the repo character is, what the repo character is doing, main objects, and how information moves}

Suggested elements:
{element 1} / {element 2} / {element 3} / {element 4}

English handwritten labels:
{label 1} / {label 2} / {label 3} / {label 4} / {optional label 5}

Color use:
Black for main line art and the repo character. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.

Constraints:
Use only the README.md as source material. One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 4-7 short handwritten English labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Do not copy prior examples or reuse known case compositions unless explicitly requested; invent a fresh visual metaphor for this specific project README. It should be clear but not instructional, interesting but not childish, strange but clean.
```

## Image Editing Prompts

Remove a top-left title:

```text
Edit the provided image. Remove only the handwritten title "{要删除的文字}" and its underline from the top-left corner. Fill that area with the same clean white background, matching the surrounding blank paper. Preserve everything else exactly: characters, labels, paths, line style, composition, aspect ratio, and image quality. Do not add any new text or objects.
```

Increase absurdity:

```text
Regenerate this illustration with the same core meaning and simple layout, but make the repo character more central to the conceptual action. The repo character should be doing the strange work that explains the idea, not standing beside the diagram. Keep it clean, sparse, hand-drawn, and not cute.
```
