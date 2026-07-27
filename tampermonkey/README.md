# SOLS Calendar userscript

This directory contains the single-file userscript version of SOLS Timetable
to ICS. It runs only on the UOW SOLS "My Timetable" page, adds an export panel
to that page, and generates the ICS file entirely in the browser.

## Install

1. Install a userscript manager:
   - Chrome, Edge, or Firefox: Tampermonkey.
   - Safari on macOS: Tampermonkey or Userscripts.
2. If Chrome requests it, enable either **Allow User Scripts** in
   Tampermonkey's extension details (Chrome 138 or later) or Chrome
   **Developer mode**. See
   [Tampermonkey FAQ Q209](https://www.tampermonkey.net/faq.php#Q209).
3. Open the userscript manager's dashboard and install
   `sols-calendar.user.js`.
4. Allow the userscript manager to run on `solss.uow.edu.au`.
5. Open SOLS **Timetable > My Timetable**. The calendar export panel appears
   immediately above the timetable.

The script requests no privileged userscript APIs (`@grant none`), loads no
remote code, performs no network requests, and stores no timetable data.

## Development

Install the test dependency and run the smoke tests:

```sh
npm install
npm test
```

The tests use only synthetic timetable entries. `test/fixture.html` can also be
opened locally for a visual preview of the injected panel; it contains no real
student information.

When testing downloads through Playwright, Chrome's download history can show
the automation layer's random GUID instead of the final file name. Verify
Playwright's `suggestedFilename()` value, which must be
`UOW_class_timetable.ics`, or save the download with that value. Playwright
documents that its temporary download path uses a random GUID:
[Download API](https://playwright.dev/docs/api/class-download#download-path).
