# 📅 SOLS Timetable → ICS

A browser extension and userscript that exports your UOW SOLS timetable to an
`.ics` calendar file. Browser extension packages are available for **Chrome**,
**Edge**, **Firefox**, and **Safari on macOS**; the userscript provides the same
page-embedded export flow through Tampermonkey.

> **Unofficial project:** This independent tool is not affiliated with,
> endorsed by, or supported by the University of Wollongong.

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
only to retrieve UOW's public academic dates once when My Timetable loads.
See [`tampermonkey/README.md`](tampermonkey/README.md) for development and test
instructions.

## Use

1. Log into [SOLS](https://solss.uow.edu.au/sid/sols_login_ctl.login) and go to **Timetable > My Timetable**
2. Click the extension icon in the toolbar, or use the page-embedded export
   panel if you installed the userscript
3. Select one of the academic years currently published by UOW and click
   **Export to ICS**
4. Choose where to save `UOW_class_timetable.ics`
5. Import the file into Google Calendar, Apple Calendar, Outlook, etc.

## Academic calendar dates

When the exact SOLS My Timetable document loads, each browser extension and the
Tampermonkey userscript automatically makes one fixed `GET` request to
`https://www.uow.edu.au/student/dates/`. This lets the academic-year selector
be ready without a separate click.

The request does not contain timetable data, a student number, the selected
year, or other query data. Request credentials and cookies are omitted. As with
any ordinary web request, UOW still receives standard network metadata such as
the user's IP address, browser networking details, and the time of the request.

The returned HTML is handled only as data: locally installed code parses the
academic-date tables, and no script or other code from the page is executed.
The year selector contains only years found in that live response for which
the complete Autumn, Spring, and Annual teaching calendars pass validation.
Users cannot enter an arbitrary year. The current year is selected when
available; otherwise the earliest published future year is selected. If only
past years remain, the user must choose one explicitly so an old calendar is
never applied silently.

If the request fails, the response is invalid, or no complete academic year is
available, the export stops with an error. The software does not guess dates.
There is no automatic retry loop. After a failure, opening the native popup or
using the userscript's year control or Export button may retry the request.
A successful validated calendar is reused for the life of the current
My Timetable document. The raw response is released after parsing, and neither
the calendar nor timetable is written to extension or userscript storage.
Timetable rows are still read only when the user clicks Export.

The generated ICS is intentionally saved to the user's device. UOW's
[Acceptable Use of IT Resources Policy](https://policies.uow.edu.au/document/view-current.php?id=68)
contains broad wording about storing University data on personally owned
devices. It is unclear whether that wording is intended to cover a student's
own minimal timetable export. Users who require a formal compliance
determination should seek written guidance from UOW IMTS or Student Systems.
This project does not provide legal or UOW policy advice.

UOW's
[Brand Approvals Procedure](https://policies.uow.edu.au/document/view-current.php?id=257)
also regulates third-party use of the University name. The generic icon and
unofficial-project disclaimer reduce the chance of mistaken endorsement, but
they are not UOW approval. Anyone distributing the project publicly should
seek UOW's written brand guidance.

## TODO:

- [ ] Improve detection of annual-session timetable rows
- [ ] Add support trimester based sessions
- [ ] Add optional label events for week numbers
- [ ] Work on tool to scan subject outlines for assessment dates

## License

MIT
