# AI Booking

Multi-business appointment system where the customer books by talking to an assistant (gpt-oss-120b via Groq + tool use), or with a regular form. The interface is in Spanish (Mexico).

## Getting started

```bash
cp .env.example .env.local   # DATABASE_URL, GROQ_API_KEY (console.groq.com) and ADMIN_PASSWORD
npm install
createdb reservas            # or create the database however you prefer
npm run db:setup             # tables + demo data (safe to run several times)
npm run dev
```

- `/demo`: public page of the demo business, with chat and form.
- `/dashboard`: upcoming appointments (password = `ADMIN_PASSWORD`).
- `/dashboard/demo`: edit services, staff and the weekly schedule.
- `npm test`: schedule and double-booking tests (the DB ones are skipped if there is no `DATABASE_URL`).

`GROQ_MODEL` is optional (default `openai/gpt-oss-120b`). To see which models your key has: `curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`.

## How it works

- `lib/slots.ts`: pure calculation of free time slots (business time zone, overlaps).
- `lib/booking.ts`: queries and `createAppointment`. The form and the AI use it **identically**.
- `db/schema.sql`: the `EXCLUDE` constraint prevents two overlapping appointments for the same person, even when they arrive at the same time.
- `app/api/chat/route.ts`: the model receives the catalog and a 14-day calendar in the prompt, and uses 2 tools: `get_available_slots` and `book_appointment`. It asks for confirmation before booking. If Groq returns 429 (free quota exhausted), the chat says so and suggests the form.
