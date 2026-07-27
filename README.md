# 📅 SOLS Timetable → ICS

A browser extension and userscript that exports your UOW SOLS timetable to an
`.ics` calendar file. Browser extension packages are available for **Chrome**,
**Edge**, **Firefox**, and **Safari on macOS**; the userscript provides the same
page-embedded export flow through a compatible userscript manager.

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
   allow access to `solss.uow.edu.au`.

### Alternative — Tampermonkey userscript

The userscript adds a SOLS-styled export panel directly above **My Timetable**,
so there is no toolbar popup to open.

1. Install a compatible userscript manager, such as Tampermonkey.
2. Open the manager's script editor and install
   `tampermonkey/sols-calendar.user.js`.
3. Allow the manager to run the script on `solss.uow.edu.au`.
4. Open SOLS **Timetable > My Timetable** and use the **Export to ICS** button
   above the timetable.

The userscript is limited to the exact SOLS timetable URL, requests no
privileged userscript APIs, performs no network requests, and stores no
timetable data. See [`tampermonkey/README.md`](tampermonkey/README.md) for
development and test instructions.

## Use

1. Log into [SOLS](https://solss.uow.edu.au/sid/sols_login_ctl.login) and go to **Timetable > My Timetable**
2. Click the extension icon in the toolbar, or use the page-embedded export
   panel if you installed the userscript
3. Select the academic year and click **Export to ICS**
4. Choose where to save `UOW_class_timetable.ics`
5. Import the file into Google Calendar, Apple Calendar, Outlook, etc.


## Supported sessions (2026)

| Session | Week 1 | Mid-session break |
|---------|--------|-------------------|
| Autumn  | 2 Mar  | 20–24 Apr (after week 7) |
| Spring  | 27 Jul | 28 Sep – 2 Oct (after week 9) |
| Annual  | Autumn weeks 1–13, Spring weeks 14–26 |


## TODO:

- [ ] Add better support for annual subjects
- [ ] Add support for polling mid session breaks automatically from uow website
- [ ] Add support trimester based sessions
- [ ] Add optional label events for week numbers
- [ ] Work on tool to scan subject outlines for assessment dates

## License

MIT
