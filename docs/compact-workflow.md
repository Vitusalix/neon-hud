# Compact workflow: notes first, then compact

The Compact button is built for one habit: **before the conversation is compacted, Claude writes the important state into a notes file.** After the compact, Claude reads that file and carries on. Nothing important is lost in the summary, because it lives in a file.

This page shows the full setup as the author uses it. You can take all of it or just steps 1-2.

## 1. Pick the notes file

In `plugins/neon-cockpit/hooks/config.ts` (after installing: in the plugin's folder, see the README):

```ts
export const LANG: 'en' | 'de' = 'en'
export const NOTES_FILE = 'NOTES.md'
```

`NOTES_FILE` is what the Compact button tells Claude to update. Use a path relative to your project, for example `docs/NOTES.md`.

**Several chats on one project?** Give each chat its own file and name it in the chat's first message, for example `docs/sessions/02-search.md`. The button's prompt says "your notes file", so Claude uses the one it was told about. The author runs a main chat that keeps `PROGRESS.md` and numbered side chats with one file each.

## 2. Tell Claude about it in `CLAUDE.md`

Add a short rule to your project's `CLAUDE.md`, so every chat knows the habit even without the button:

```markdown
## Compact rule
Plan a compact at about 50-60 % context, at a clean point (step finished and committed), never mid-task.
1. Update the notes file (NOTES.md) with: goal, status, decisions, open points, important files, next step.
2. End the answer with the keypoints for the compact, 3-8 short lines, inside <compact-keypoints> … </compact-keypoints>.
3. After the compact: read the notes file first, then continue with the next step.
```

## 3. Raise the auto-compact threshold (optional)

Claude Code compacts on its own when the context gets full. If you prefer to compact yourself at a good moment, push the automatic one far out, so it only acts as an emergency brake. In your user settings, `~/.claude/settings.json`:

```json
{
  "autoCompactWindow": 900000
}
```

The value is in tokens (allowed range 100 000 to 1 000 000). The bar marks this point as **AUTO** on its scale and shows how many tokens are left until it.

## 4. Using the button

1. The bar turns **yellow at 50 %** ("Compact advisable") and **red at 60 %** ("Compact recommended").
2. Press **Compact**. The mod sends Claude a prompt: finish the step, update the notes file, write the keypoints. The arrows next to the button move while this runs.
3. When Claude's answer contains the `<compact-keypoints>` block, the mod puts a ready `/compact Keep only: …` command into your input line.
4. Read it, then press **Enter**. The compact runs.
5. Write a short "continue". Claude reads the notes file and picks up the next step.

Why the extra Enter? In the Claude desktop app a plugin is not allowed to start a compact by itself, so the last step stays yours. It also gives you a chance to check the keypoints.

## Keep warm

The prompt cache makes long chats cheaper and faster, but it expires about an hour after the last request. **Keep warm** sends a tiny invisible ping shortly before it expires, for up to 4 hours. Use it when you take a break and want to come back to a warm chat. The flame icon glows while it is on and blinks yellow when the cache is about to expire.
