# 📅 SOLS Timetable → ICS

A Chrome extension that exports your UOW class timetable to an `.ics` calendar file.

## Install

1. Clone or download this repo
2. Open **chrome://extensions** in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select this folder

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
