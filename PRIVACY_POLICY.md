# Privacy Policy — SOLS Timetable to ICS

**Last updated:** 27 July 2026

## Overview

SOLS Timetable to ICS ("the Software") is available as a browser extension for
Chromium-based browsers, Firefox, and Safari on macOS, and as a userscript for
compatible userscript managers. It exports your University of Wollongong (UOW)
SOLS timetable into a standard ICS calendar file. This privacy policy describes
how the Software handles user data.

## Data Collection

The Software reads timetable data **only** from the UOW SOLS "My Timetable" page (`https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*`). The data read includes:

- Subject codes
- Class types (lecture, tutorial, lab, etc.)
- Class times and days
- Room/location information
- Teaching weeks

**No other web browsing activity or page content is collected.**

## Data Usage

All collected timetable data is used **solely** to generate an ICS calendar file on the user's device. Specifically:

- Data is parsed from the page DOM in real time when the user clicks "Export to ICS."
- The parsed data is converted into ICS format entirely within the browser.
- The resulting `.ics` file is handed directly to the browser's local download flow. Chromium-based browser extension builds use the `chrome.downloads` API; Firefox, Safari, and the userscript use a temporary in-memory Blob download link. No files are downloaded from any external source.
- **No data is stored, cached, or persisted** by the Software after the export is complete.

## Data Sharing

The Software **does not** share, transmit, sell, or transfer any user data to any third party, remote server, or external service. All processing occurs locally within the user's browser.

## Data Security

Because all data processing happens locally within the browser and no data is transmitted externally, there is no risk of data interception during transfer. No user data is stored beyond the duration of a single export action. The exported .ics file also includes no identifiers about the student other than their timetable data.

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` (browser extension packages) | Access the current SOLS timetable page when the user clicks the extension icon, to read class information from the page. |
| `downloads` (Chromium and Firefox packages) | Save the generated ICS calendar file to the user's device via the browser's local download flow. Safari does not request this permission. No files are downloaded from external sources. |
| Host access to the specific SOLS timetable URL | Run extension content scripts or the userscript only on `https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*` to parse the timetable HTML. |
| Userscript `@grant none` | The userscript does not request any privileged userscript-manager APIs. |

## Limited Use Disclosure

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), including the Limited Use requirements.

## Remote Code

The Software does not execute any remotely hosted code. All JavaScript is
bundled locally in the browser extension packages or in the self-contained
userscript.

## Children's Privacy

The Software does not knowingly collect data from children under 13.

## Changes to This Policy

If this privacy policy is updated, the revised version will be posted at this URL with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at [https://github.com/JimmyBlackley/sols-calendar](https://github.com/JimmyBlackley/sols-calendar).
