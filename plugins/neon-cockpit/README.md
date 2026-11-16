# neon-cockpit

Cockpit bar above the Claude Code prompt: context fill on a scaled bar (marks at 50 %, 60 % and the auto-compact point), a prompt-cache countdown ring, rings for the 5-hour and weekly limits with reset times, a focus row with Claude's current step, a guided **Compact** button and **Keep warm**.

Settings are in `hooks/config.ts`: `LANG` (`'en'` or `'de'`) and `NOTES_FILE` (the file the Compact button asks Claude to update). Run `/reload-plugins` after a change.

Full guide and the compact workflow: https://github.com/Vitusalix/neon-hud
