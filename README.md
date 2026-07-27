# 📅 SOLS Timetable → ICS

A browser extension and userscript that exports your UOW SOLS timetable to an
`.ics` calendar file. Browser extension packages are available for **Chrome**,
**Edge**, **Firefox**, and **Safari on macOS**; the userscript provides the same
page-embedded export flow through Tampermonkey.

## Install

### Step 1 — Download the extension

1. Go to the [GitHub repo page](https://github.com/JimmyBlackley/sols-calendar)
2. Click the green **Code** button near the top right
3. Click **Download ZIP**
4. Unzip the downloaded file — you'll get a folder called `sols-calendar-main` (keep this somewhere permanent, don't delete it)

### Step 2a — Chrome / Edge

1. Open your browser and go to `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Turn on **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Navigate into the unzipped folder and select the **`chromium`** subfolder
5. The extension icon should now appear in your toolbar

### Step 2b — Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate into the unzipped folder, open the **`firefox`** subfolder, and select the **`manifest.json`** file
4. The extension icon should now appear in your toolbar

> **Note:** Temporary add-ons in Firefox are removed when you close the browser. You'll need to reload it each session until the extension is published on [addons.mozilla.org](https://addons.mozilla.org).

### Step 2c — Safari on macOS

Safari is supplied as a macOS Xcode project until an App Store build is
published. macOS 13 or later, Safari 18.1 or later, and Xcode 26 or later are
required.

1. Open `safari/SOLS Calendar/SOLS Calendar.xcodeproj` in Xcode.
2. Select the project, then choose your Apple development team for the
   **SOLS Calendar** app and extension targets. Change the bundle identifier
   if your team already uses it.
3. Select the **SOLS Calendar** scheme and your Mac, then click **Run**.
4. In Safari, open **Settings > Extensions**, enable **SOLS Calendar**, and
   allow access to `solss.uow.edu.au` and `www.uow.edu.au`.

### Alternative — Tampermonkey userscript

The userscript adds a SOLS-styled export panel directly above **My Timetable**,
so there is no toolbar popup to open.

1. Install Tampermonkey build 6180 or later.
2. Open Tampermonkey's script editor and install
   `tampermonkey/sols-calendar.user.js`.
3. Allow Tampermonkey to run the script on `solss.uow.edu.au` and retrieve
   public dates from `www.uow.edu.au`.
4. Open SOLS **Timetable > My Timetable** and use the **Export to ICS** button
   above the timetable.

The userscript runs only on the exact SOLS timetable URL. Its
`GM_xmlhttpRequest` grant and `@connect www.uow.edu.au` declaration are used
only to retrieve UOW's public academic dates when the user starts an export.
See [`tampermonkey/README.md`](tampermonkey/README.md) for development and test
instructions.

## Use

1. Log into [SOLS](https://solss.uow.edu.au/sid/sols_login_ctl.login) and go to **Timetable > My Timetable**
2. Click the extension icon in the toolbar, or use the page-embedded export
   panel if you installed the userscript
3. Select the academic year and click **Export to ICS**
4. Choose where to save `UOW_class_timetable.ics`
5. Import the file into Google Calendar, Apple Calendar, Outlook, etc.

## Academic calendar dates

When the user starts an export, the software makes a fixed `GET` request to
`https://www.uow.edu.au/student/dates/` and reads the public teaching-week
dates published there. This request does not contain timetable data, a student
number, the selected year, or other query data. Request credentials and cookies
are omitted. As with any ordinary web request, UOW still receives standard
network metadata such as the user's IP address, browser networking details, and
the time of the request.

The returned HTML is handled only as data: bundled code parses the relevant
academic-date tables, and no script or other code from the page is executed.
The retrieved dates and the timetable remain in memory only for the current
export and are not persisted.

If the online request fails or its data does not pass validation, the software
uses its bundled, verified dates for the same academic year. If neither the
online source nor the bundled fallback supports the selected year, the export
stops instead of guessing dates.

The year field defaults to the current year but remains editable. Once UOW
publishes a complete standard-session calendar for a future year, that year can
be used without adding another hard-coded option to the extension.

## Bundled fallback dates

| Year | Session | Week 1 | Mid-session break |
|------|---------|--------|-------------------|
| 2026 | Autumn | 2 Mar | 20–24 Apr (after week 7) |
| 2026 | Spring | 27 Jul | 28 Sep – 2 Oct (after week 9) |
| 2027 | Autumn | 1 Mar | 19–23 Apr (after week 7) |
| 2027 | Spring | 26 Jul | 27 Sep – 1 Oct (after week 9) |

Annual fallback data contains the complete official Week 1–26 teaching
segments for both years.


## TODO:

- [ ] Improve detection of annual-session timetable rows
- [ ] Add support trimester based sessions
- [ ] Add optional label events for week numbers
- [ ] Work on tool to scan subject outlines for assessment dates

## License

MIT
