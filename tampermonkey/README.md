# SOLS Calendar userscript

This directory contains the single-file userscript version of SOLS Timetable
to ICS. It runs only on the UOW SOLS "My Timetable" page, adds an export panel
to that page, and generates the ICS file entirely in the browser.

This is an unofficial independent tool. It is not affiliated with, endorsed
by, or supported by UOW.

## Install

1. Install Tampermonkey on Chrome, Edge, Firefox, or Safari on macOS. Use
   build 6180 or later, which supports rejecting redirects before they are
   followed. Other userscript managers are not claimed compatible because
   redirect blocking is part of this project's privacy boundary.
2. If Chrome requests it, enable either **Allow User Scripts** in
   Tampermonkey's extension details (Chrome 138 or later) or Chrome
   **Developer mode**. See
   [Tampermonkey FAQ Q209](https://www.tampermonkey.net/faq.php#Q209).
3. Open the userscript manager's dashboard and install
   `sols-calendar.user.js`.
4. Allow the userscript manager to run on `solss.uow.edu.au` and retrieve
   public dates from `www.uow.edu.au`.
5. Open SOLS **Timetable > My Timetable**. The calendar export panel appears
   immediately above the timetable.

When the exact My Timetable document loads, the script automatically uses
`GM_xmlhttpRequest` with `@connect www.uow.edu.au` once to retrieve the fixed
public URL `https://www.uow.edu.au/student/dates/`. The request contains no
timetable or student data, omits cookies, and rejects redirects. The returned
HTML is parsed only as academic-calendar data; no remote code is executed.

The academic-year control is populated only with years discovered in the live
response whose Autumn, Spring, and Annual teaching calendars are all present
and pass validation. It does not accept an arbitrary year. The current year is
selected when available, otherwise the earliest published future year is
selected; a past year always requires an explicit choice. If the request fails,
the response is invalid, or no complete year is available, the export stops
instead of guessing dates.

A successful validated calendar and available-year list are reused in memory
for the life of the current My Timetable document. The raw HTML is released
after parsing. A failed automatic request does not loop; a later trusted click
on the year control or Export button can retry. Timetable rows are still read
only for the current user-initiated export. None of these values is written to
userscript storage or retained for another page load.

## Development

Install the test dependency and run the smoke tests:

```sh
npm install
npm test
```

The tests use only synthetic timetable and academic-calendar data.
`test/fixture.html` can also be opened locally for a visual preview of the
injected panel; it contains no real student information.

When testing downloads through Playwright, Chrome's download history can show
the automation layer's random GUID instead of the final file name. Verify
Playwright's `suggestedFilename()` value, which must be
`UOW_class_timetable.ics`, or save the download with that value. Playwright
documents that its temporary download path uses a random GUID:
[Download API](https://playwright.dev/docs/api/class-download#download-path).
