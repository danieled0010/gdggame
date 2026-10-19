# GDG Tech Challenge v3 — nickname moderation

All v2 features are preserved. The only behavioral change is server-side screening of the nickname supplied during JOIN.

- Rejects explicit war/conflict/politically provocative references, extremist terms and discriminatory slurs chosen for the event.
- Handles lowercase/uppercase, accents, punctuation/spaces, common leetspeak and some Unicode lookalikes.
- Uses private, editable `nickname-rules.json`, loaded on server startup.
- Rejects presenter/organizer impersonation through a small reserved-name list.
- Shows a polite warning to the participant, never the matching word.
- Does not send the blocked list to phones or log rejected nicknames.
- No new Node dependencies, accounts, cloud services or Internet requirement.

Notes: Neutral identity references in the list are restricted at the event organizer's request to avoid provocative names, not because the terms are abusive. No automated filter catches all creative evasions. Edit the rules judiciously to avoid false positives, then restart the server.
