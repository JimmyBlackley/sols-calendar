# Privacy Policy — SOLS Timetable to ICS

**Last updated:** 27 July 2026

## Overview

SOLS Timetable to ICS ("the Software") is available as a browser extension for
Chromium-based browsers, Firefox, and Safari on macOS, and as a Tampermonkey
userscript. It exports your University of Wollongong (UOW) SOLS timetable into
a standard ICS calendar file. This privacy policy describes how the Software
handles user data.

## Data Collection

The Software reads timetable data **only** from the UOW SOLS "My Timetable" page (`https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*`). The data read includes:

- Subject codes
- Class types (lecture, tutorial, lab, etc.)
- Class times and days
- Room/location information
- Teaching weeks

The browser extension packages retrieve UOW's public academic calendar page
with a fixed `GET` request to `https://www.uow.edu.au/student/dates/` when the
user opens the extension popup. The Tampermonkey userscript makes the same
request only after the user interacts with its academic-year control or clicks
"Export to ICS"; loading the SOLS timetable page alone does not trigger the
request. The Software does not read other browsing activity or inspect the
content of pages other than the two URLs described above.

## Data Usage

All collected timetable data is used **solely** to generate an ICS calendar file on the user's device. Specifically:

- Data is parsed from the page DOM in real time when the user clicks "Export to ICS."
- At the times described above, the Software retrieves public teaching-week
  dates from the fixed UOW academic calendar URL. The request contains no
  timetable data, student number, selected year, or other query data, and
  request credentials and cookies are omitted. Redirects are rejected, so the
  request is not forwarded to another endpoint.
- The returned academic calendar HTML is parsed only as data. The Software does
  not execute scripts or other code from the response.
- An academic year is offered for selection only when the live response
  contains complete Autumn, Spring, and Annual teaching calendars for that
  year and all three pass validation. The Software does not accept an
  arbitrary user-entered year or guess an unpublished calendar.
- The parsed data is converted into ICS format entirely within the browser.
- The resulting `.ics` file is handed directly to the browser's local download
  flow. Chromium-based browser extension builds use the `chrome.downloads`
  API; Firefox, Safari, and the userscript use a temporary in-memory Blob
  download link. The remote academic calendar response is not saved as a file.
- The academic calendar response, validated dates, and available-year list are
  kept only in browser memory while the extension popup or active userscript
  interaction needs them. Timetable data is kept only for the current export.
  **No data is written to extension or userscript storage, cached for later
  sessions, or otherwise persisted** by the Software.
- If the online academic calendar is unavailable or invalid, or no complete
  year is available, the export stops with an error rather than guessing
  dates.

## Data Sharing

The Software **does not** include timetable data, student identifiers, browsing
data, or user-supplied query data in the academic calendar request, and it does
not share, sell, or transfer that data to UOW or any other party. Because the
Software contacts UOW's public website, UOW receives the ordinary network
metadata associated with a web request, such as the user's IP address, browser
networking details, and request time.

## Data Security

Timetable parsing, academic-date parsing, and ICS generation all happen locally
within the browser. The remote response is treated as untrusted data and is
validated before use; remotely supplied code is never executed. No timetable
or academic calendar data is persisted beyond the popup or active interaction
that needs it. The exported `.ics` file includes no identifiers about the
student other than the timetable details needed for its calendar events.

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` (browser extension packages) | Access the current SOLS timetable page when the user clicks the extension icon, to read class information from the page. |
| `downloads` (Chromium package only) | Save only the locally generated ICS calendar file to the user's device via Chrome's local download flow. Firefox, Safari, and the userscript use a temporary in-memory Blob link and do not request this permission. |
| Host access to the specific SOLS timetable URL | Run extension content scripts or the userscript only on `https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*` to parse the timetable HTML. |
| Host access to `https://www.uow.edu.au/*` (browser extension packages) | Allow the Chromium, Firefox, and Safari extension pages to make the fixed request to `https://www.uow.edu.au/student/dates/`. No content script is run on UOW's public website. |
| Tampermonkey `GM_xmlhttpRequest` and `@connect www.uow.edu.au` | Allow Tampermonkey to retrieve that same public academic calendar page despite browser cross-origin restrictions. The userscript's execution scope remains limited to the exact SOLS timetable URL. |

## Limited Use Disclosure

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), including the Limited Use requirements.

## Remote Code

The Software does not execute any remotely hosted code. All executable
JavaScript is bundled locally in the browser extension packages or in the
self-contained userscript. HTML retrieved from UOW is parsed solely as
academic-calendar data and is never inserted as executable content.

## Children's Privacy

The Software does not knowingly collect data from children under 13.

## Changes to This Policy

If this privacy policy is updated, the revised version will be posted at this URL with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at [https://github.com/JimmyBlackley/sols-calendar](https://github.com/JimmyBlackley/sols-calendar).
