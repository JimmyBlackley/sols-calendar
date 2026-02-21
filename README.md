# 📅 SOLS Timetable → ICS

A browser extension that exports your UOW SOLS timetable to an `.ics` calendar file. Works on **Chrome**, **Edge**, and **Firefox**.

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

## Use

1. Log into [SOLS](https://solss.uow.edu.au/sid/sols_login_ctl.login) and go to **Timetable > My Timetable**
2. Click the extension icon in the toolbar
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
