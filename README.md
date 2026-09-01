# Swift Connect CRM

Create a lightweight, ultra-fast, spreadsheet-style Cold Calling CRM application designed for high-efficiency outbound sales calling.

### 1. AUTHENTICATION & ACCESS

- Simple authentication screen (Email + Password login).

- Simple session management so the user stays logged in.

### 2. CORE CONCEPT & UI/UX DESIGN

- The main view must look and behave like a modern spreadsheet table (similar to Airtable / Excel).

- High-speed row-by-row data entry: Clicking any cell allows inline editing immediately (like an Excel sheet) with keyboard navigation support (Enter / Tab to move to next cell).

- Modern, clean, minimal, high-contrast dark/light UI to reduce cognitive fatigue during calling marathons.

### 3. DATA SCHEMA (Lead / Contact Entity)

Each row represents a lead with the following fields:

1. Legal Company Name (`company_name`) - Text, Inline Editable (usually imported via CSV).

2. Website URL (`website_url`) - Text/URL, Inline Editable (usually imported via CSV).

3. Owner / Contact Name (`contact_name`) - Text, Inline Editable (manually added/edited).

4. Phone Number (`phone`) - Text, Inline Editable (manually added/edited).

5. Email Address (`email`) - Text, Inline Editable (manually added/edited).

6. Call Picked Up (`call_answered`) - Boolean Switch / Toggle (Yes / No). Default: No.

7. Lead Status (`status`) - Single Select Dropdown with options:

   - "Nevoláno" (Default)

   - "Zavolat později"

   - "Domluvená schůzka"

   - "Odmítnul"

8. Call Note (`note`) - Textarea / Expandable cell for quick notes taken during the call.

9. Follow-up Date & Time (`followup_at`) - Date-time picker (Active only when status is "Zavolat později").

### 4. KEY FUNCTIONALITIES

#### A. CSV Import (Merk Export Compatibility)

- "Import CSV" button at the top.

- CSV Mapper modal allowing the user to map columns from their Merk CSV export to internal fields (`company_name`, `website_url`, etc.).

- Fast batch insertion into the local database/state.

#### B. Inline Editing & Data Flow

- Ability to quickly click into "Owner Name", "Phone", and "Email" cells and type right away.

- One-click toggle for `Call Answered` (Dovolal se / Nedovolal se).

#### C. Google Calendar Integration ("Zavolat později")

- When the status is changed to "Zavolat později", prompt the user to pick a date and time (`followup_at`).

- Provide an automatic Google Calendar integration (via Google Calendar API or direct URL redirect / `.ics` event creation) that schedules a reminder event:

  - **Event Title:** "Zavolat: [Contact Name / Company Name]"

  - **Description:** Included notes from the call + Phone number.

  - **Start Time:** Selected `followup_at`.

#### D. Filtering & Quick Views

- Quick filter tabs or dropdown at the top:

  - "Všechny kontakty" (All)

  - "Nevoláno" (Uncalled)

  - "Zavolat později" (Scheduled callback)

  - "Domluvené schůzky" (Won / Scheduled meeting)

  - "Odmítnuto" (Rejected)

- Quick search bar (searches company name, contact name, phone, email).

### 5. TECHNICAL REQUIREMENTS

- Responsive, clean layout optimized for desktop screens (where cold calling happens).

- Real-time auto-saving of row edits (no need to click a manual "Save" button for every cell).

Jméno Firmy: Kylio

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://crm-kylio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d78a8328-d45c-4490-8cab-c96397a5e0c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
