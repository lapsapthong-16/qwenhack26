---
name: repo-illustrations
description: Generate English README illustrations for project repositories. Use only when the user asks for hand-drawn, absurd, README, repository, project overview, architecture, workflow, feature, setup, or shot-list illustrations based on a repo README.md file. Read only the README.md content as source material; ignore code, package files, docs, issues, websites, and other repo files unless the user explicitly asks to stop using this skill.
---

# Repo Illustrations

## Core Purpose

Design and generate 16:9 horizontal illustrations for project repository README files. The output should help explain a repo's product idea, problem, workflow, architecture, features, setup path, or project story using a sparse absurd hand-drawn visual style.

This skill must only use `README.md` files as source material. Do not inspect or infer from source code, package manifests, docs folders, websites, screenshots, issues, commit history, or any other repo file. If no README path is given, look for the repository's root `README.md`. If the user provides a differently named Markdown file, ask whether to treat it as the README before using it.

The default visual IP is a small solid-black absurd repo character with white dot eyes, tiny thin legs, and a blank serious expression, doing one strange but logically meaningful action. The character must drive the core concept, not decorate the scene.

All visible text in generated images must be English. Use sparse, short, handwritten English labels.

## References To Read

Read only what is needed:

- `references/style-dna.md`: style DNA, color, text density, and visual bans. Treat any Chinese-label guidance there as English-label guidance.
- `references/visual-ip.md`: repo character design, personality, action library, and bans.
- `references/composition-patterns.md`: structure types, metaphor invention, and anti-copy rules.
- `references/prompt-template.md`: single-image generation prompt template.
- `references/qa-checklist.md`: post-generation checks and iteration rules.
- `assets/examples/`: low-frequency visual calibration only. Do not copy their compositions, objects, or labels.

## Workflow

### 1. Read Only The README

Read the repo's `README.md` and no other project file. Extract:

- project name and one-line concept
- problem statement or user pain
- solution or core product behavior
- story scenario or user workflow
- architecture or system flow, if present in the README
- key features and evidence types
- setup or getting-started path, if useful
- any sections that are better left as text

Do not average across every README section. Prefer cognitive anchors: problem-to-solution, messy input to clear output, local/private boundary, user journey, indexing/search pipeline, architecture handoff, before/after, feature cluster, setup path, failure modes, or role/state changes.

### 2. Produce A README Illustration Strategy

If the user asks to analyze, plan, or suggest illustrations, provide a short shot list. For each image, include:

- README section placement
- image theme
- core idea
- structure type
- what the repo character does
- suggested elements
- suggested short English labels

Default to 3-6 images for a typical project README. Use 1-3 for short READMEs. Do not exceed 8 unless the README is unusually long and the user asks for broad coverage.

### 3. Generate Single Images

If the user explicitly asks to generate, output, make, or create illustrations, do not wait for confirmation. Use `image_gen` for each image separately. Do not combine multiple illustrations into a single image.

Each image must explain one core structure. Prompts must include:

- 16:9 horizontal README illustration for a project repository
- pure white background
- minimalist black hand-drawn line art
- sparse red/orange/blue handwritten English annotations
- lots of white space
- the repo character as the core action subject
- no PPT, commercial vector style, cute mascot poster, complex architecture diagram, or top-left type title

Do not copy prior examples. Examples only calibrate density and the repo character's participation. Do not reuse known compositions such as conveyor breakpoints, line-pulling paths, fish-as-assets, stamped toolboxes, or common-pit paths unless the user explicitly requests that exact remake. Invent a fresh, strange, but coherent metaphor from the README content.

### 4. Check And Iterate

After generation, check `references/qa-checklist.md`. If any of these appear, regenerate or edit:

- the repo character is decorative instead of active
- the image is too full
- it looks like a flowchart, PPT slide, or formal architecture diagram
- English labels are too long, misspelled, or unreadable
- the top-left corner contains a generic title such as "Workflow", "Architecture", or "Features"
- the style is cute, childish, rigid, or commercial
- the background is not clean white

### 5. Save And Deliver

If the user is working inside a workspace, save final images to:

```text
assets/<repo-slug>-readme-illustrations/
```

Name files in order:

```text
01-topic-name.png
02-topic-name.png
```

Preserve original generated files. Do not overwrite existing assets unless the user explicitly asks to replace them.

## Output Style

Before generation, keep strategy output short and specific. After generation, include:

- number of images generated
- the README section or purpose for each image
- save path
- which images are strongest and which are optional

Do not explain style theory at length. Let the images carry the idea.
