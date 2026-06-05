---
name: Telegram Markdown injection
description: Escaping rule for user-provided text sent to Telegram sendMessage with parse_mode Markdown
---

Any route that forwards user-submitted text to Telegram `sendMessage` with
`parse_mode: "Markdown"` (e.g. propuesta-evento, contacto, postulación flows)
must escape Markdown special chars (`_ * ` [`) and cap length before
interpolating into the message body.

**Why:** Unescaped user input enables Markdown/link injection in the admin
Telegram channel (spoofed/phishing-style messages, malformed notifications).
Flagged in code review when building the event-proposal route.

**How to apply:** Add a small `escaparMarkdown(s)` helper
(`s.replace(/([_*` + "`" + `\[])/g, "\\$1")`) and `.slice(0, MAX)` on each
user field. If a route only needs plain text, dropping `parse_mode` entirely is
also acceptable.
