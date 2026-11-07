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