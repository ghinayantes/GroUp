# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Comments
- Add comments only when they are obviously needed.
- Do not comment code that already explains itself through clear names and structure.

## Research Before Implementing

- Check the official documentation for the library, framework, or tool before writing code.
- If the docs do not answer the question, check official forums, GitHub issues, and discussions.
- Use current, documented APIs. Do not rely on memory or outdated examples.

## No Backwards Compatibility

- Do not keep old code paths, deprecated APIs, shims, or fallbacks for previous versions.
- When something changes, update every usage directly and remove the old version.
- Always target the latest versions of libraries and tools.

## Session Documentation

- Document every working session in a Markdown file in the `sessions/` folder.
- Name the file `YYYY-MM-DD-short-topic.md`, for example `2026-11-02-setup-notebook-sync.md`.
- If a session continues on the same day and topic, update the existing file instead of creating a new one.
- Write the file before the session ends, using this structure:

```markdown
# <Session title>

**Date:** YYYY-MM-DD

## Goal
What the session set out to do.

## What Was Done
- Main steps and changes, in order.

## Decisions
- Important choices and the reason behind each one.

## Files Changed
- `path/to/file`: short description of the change.

## Issues and Notes
- Problems found, workarounds, and anything worth remembering.

## Next Steps
- Unfinished work or follow-up tasks.
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
