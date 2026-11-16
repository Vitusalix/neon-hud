// Your settings. Change them here, then run /reload-plugins.

/** Language of the band: 'en' or 'de'. */
export const LANG: 'en' | 'de' = 'en'

/**
 * Where the chat keeps its notes before a compact. The Compact button asks
 * Claude to update this file, and the /compact command tells the summary to
 * point there. See docs/compact-workflow.md for the full setup.
 */
export const NOTES_FILE = 'NOTES.md'
