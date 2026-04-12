Save an idea to the Obsidian vault.

Arguments: $ARGUMENTS (the idea title)

Steps:
1. Read OBSIDIAN_HOST and OBSIDIAN_API_KEY from `.env`
2. Use $ARGUMENTS as the note title. If empty, ask the user for a title.
3. Create a note with this structure:
   ```
   **Date:** YYYY-MM-DD
   **Status:** Raw

   ## Description


   ## Why it matters


   ## Open questions

   ```
4. Save via curl PUT to: `Job/Projects/ScheduleCore/Ideas/<title>.md`
   - URL-encode the filename (spaces → %20) in the curl URL
   - Use Content-Type: text/markdown; charset=utf-8
5. Confirm the note was saved.
