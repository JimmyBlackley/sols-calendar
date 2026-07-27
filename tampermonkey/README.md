# SOLS Calendar userscript

This directory contains the single-file userscript version of SOLS Timetable
to ICS. It runs only on the UOW SOLS "My Timetable" page, adds an export panel
to that page, and generates the ICS file entirely in the browser.

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

When the user clicks **Export to ICS**, the script uses
`GM_xmlhttpRequest` with `@connect www.uow.edu.au` to retrieve the fixed public
URL `https://www.uow.edu.au/student/dates/`. The request contains no timetable
or student data, omits cookies, and rejects redirects. The returned HTML is
parsed only as academic-calendar data; no remote code is executed.

The online data is validated before use. If the request fails, the script uses
bundled, verified dates for the same year; an unsupported year stops the
export instead of being guessed. Calendar and timetable data are kept in
memory only and are not persisted.

The academic-year field defaults to the current year and accepts future years.
No script update is needed once UOW publishes a complete standard-session
calendar for that year.

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
