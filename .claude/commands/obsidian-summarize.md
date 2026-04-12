Summarize this conversation and save it to the Obsidian vault.

Steps:
1. Read OBSIDIAN_HOST and OBSIDIAN_API_KEY from `.env`
2. Identify the main topic of this conversation (2–5 words, suitable for a filename)
3. Write a summary with these sections:
   - **What we discussed** — key topics covered
   - **Decisions made** — architectural, design, or implementation decisions
   - **Open questions** — unresolved issues or follow-ups
   - **Next steps** — concrete actions to take
4. Save via curl:
   - File path in vault: `Job/Projects/ScheduleCore/Sessions/YYYY-MM-DD - <topic>.md`
   - Use today's date (available in system context as currentDate)
   - URL-encode the filename (spaces → %20) in the curl URL
   - PUT request with Content-Type: text/markdown; charset=utf-8
5. Confirm the note was saved and display the filename.
