// ==UserScript==
// @name         SOLS Timetable to ICS
// @namespace    https://github.com/JimmyBlackley/sols-calendar
// @version      1.0.0
// @description  Export your UOW SOLS timetable to a local ICS calendar file
// @author       James Blackley
// @license      MIT
// @homepageURL  https://github.com/JimmyBlackley/sols-calendar
// @supportURL   https://github.com/JimmyBlackley/sols-calendar/issues
// @match        https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const PANEL_ID = 'sols-calendar-export';
    const STYLE_ID = 'sols-calendar-export-style';
    const DOWNLOAD_FILENAME = 'UOW_class_timetable.ics';

    /**
     * Academic calendar configuration for UOW.
     * Annual weeks 1-13 map to Autumn; week 14 begins Spring week 1.
     */
    const ACADEMIC_CALENDAR = {
        2026: {
            autumn: {
                week1Start: new Date(2026, 2, 2),
                breaks: [
                    { afterWeek: 7, durationWeeks: 1 }
                ]
            },
            spring: {
                week1Start: new Date(2026, 6, 27),
                breaks: [
                    { afterWeek: 9, durationWeeks: 1 }
                ]
            }
        }
    };

    /**
     * Get the Monday date for an academic week.
     */
    function weekToDate(session, weekNumber, year) {
        const calendar = ACADEMIC_CALENDAR[year];
        if (!calendar) {
            throw new Error(`No calendar config for year ${year}`);
        }

        let effectiveSession = session.toLowerCase();
        let effectiveWeek = weekNumber;

        if (effectiveSession === 'annual') {
            if (weekNumber <= 13) {
                effectiveSession = 'autumn';
            } else {
                effectiveSession = 'spring';
                effectiveWeek = weekNumber - 13;
            }
        }

        const config = calendar[effectiveSession];
        if (!config) {
            throw new Error(`No calendar config for ${effectiveSession} ${year}`);
        }

        let totalOffsetWeeks = effectiveWeek - 1;
        for (const breakConfig of config.breaks) {
            if (effectiveWeek > breakConfig.afterWeek) {
                totalOffsetWeeks += breakConfig.durationWeeks;
            }
        }

        const result = new Date(config.week1Start);
        result.setDate(result.getDate() + totalOffsetWeeks * 7);
        return result;
    }

    function parseWeeks(weekString) {
        const weeks = [];
        const parts = weekString.split(',').map((part) => part.trim());

        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let week = start; week <= end; week += 1) {
                    weeks.push(week);
                }
            } else {
                weeks.push(Number(part));
            }
        }

        return weeks;
    }

    function dayToOffset(day) {
        const offsets = {
            mon: 0,
            monday: 0,
            tue: 1,
            tuesday: 1,
            wed: 2,
            wednesday: 2,
            thu: 3,
            thursday: 3,
            fri: 4,
            friday: 4,
            sat: 5,
            saturday: 5,
            sun: 6,
            sunday: 6
        };

        return offsets[day.toLowerCase()] ?? 0;
    }

    function toICSDateTime(date, time) {
        const [hours, minutes] = time.split(':').map(Number);
        const value = new Date(date);
        value.setHours(hours, minutes, 0, 0);

        const pad = (number) => String(number).padStart(2, '0');
        return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(hours)}${pad(minutes)}00`;
    }

    function generateUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
            const random = Math.random() * 16 | 0;
            const value = character === 'x' ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    }

    function foldLine(line) {
        const parts = [];
        let remainder = line;

        while (remainder.length > 75) {
            parts.push(remainder.substring(0, 75));
            remainder = ` ${remainder.substring(75)}`;
        }

        parts.push(remainder);
        return parts.join('\r\n');
    }

    function generateICS(events, year) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SOLS Timetable to ICS//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:UOW Timetable',
            'X-WR-TIMEZONE:Australia/Sydney',
            'BEGIN:VTIMEZONE',
            'TZID:Australia/Sydney',
            'BEGIN:STANDARD',
            'DTSTART:19700405T030000',
            'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4',
            'TZOFFSETFROM:+1100',
            'TZOFFSETTO:+1000',
            'TZNAME:AEST',
            'END:STANDARD',
            'BEGIN:DAYLIGHT',
            'DTSTART:19701004T020000',
            'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=10',
            'TZOFFSETFROM:+1000',
            'TZOFFSETTO:+1100',
            'TZNAME:AEDT',
            'END:DAYLIGHT',
            'END:VTIMEZONE'
        ];

        const now = new Date();
        const pad = (number) => String(number).padStart(2, '0');
        const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

        for (const event of events) {
            const weeks = parseWeeks(event.weeks);
            const dayOffset = dayToOffset(event.day);

            for (const week of weeks) {
                try {
                    const monday = weekToDate(event.session, week, year);
                    const eventDate = new Date(monday);
                    eventDate.setDate(eventDate.getDate() + dayOffset);

                    const start = toICSDateTime(eventDate, event.startTime);
                    const end = toICSDateTime(eventDate, event.endTime);
                    const summary = `${event.subjectCode} ${event.activityType}`;
                    const description = `${event.type} - ${event.subjectCode}\\n${event.activityDetail || event.activityType}\\nWeek ${week}`;

                    lines.push('BEGIN:VEVENT');
                    lines.push(`UID:${generateUID()}@sols-cal`);
                    lines.push(`DTSTAMP:${timestamp}`);
                    lines.push(foldLine(`DTSTART;TZID=Australia/Sydney:${start}`));
                    lines.push(foldLine(`DTEND;TZID=Australia/Sydney:${end}`));
                    lines.push(foldLine(`SUMMARY:${summary}`));
                    if (event.location) {
                        lines.push(foldLine(`LOCATION:${event.location}`));
                    }
                    lines.push(foldLine(`DESCRIPTION:${description}`));
                    lines.push('END:VEVENT');
                } catch (error) {
                    console.warn(`SOLS Calendar: skipping an invalid entry for week ${week}: ${error.message}`);
                }
            }
        }

        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    function detectSession(subjectCode) {
        const desktopTable = document.querySelector('#desktop-version .timetable');
        if (desktopTable) {
            const cells = desktopTable.querySelectorAll('td.lecture, td.enrolled');
            for (const cell of cells) {
                const text = cell.textContent;
                if (!text.includes(subjectCode)) {
                    continue;
                }
                if (/Annual/i.test(text)) {
                    return 'Annual';
                }
                if (/Spring/i.test(text)) {
                    return 'Spring';
                }
                if (/Autumn/i.test(text)) {
                    return 'Autumn';
                }
            }
        }

        const month = new Date().getMonth();
        return month >= 5 && month <= 11 ? 'Spring' : 'Autumn';
    }

    function parseTimetable() {
        const events = [];
        const mobileView = document.querySelector('#mobile-version');
        if (!mobileView) {
            throw new Error('Could not find the SOLS mobile timetable view');
        }

        const dayNames = [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday'
        ];
        const items = mobileView.querySelectorAll('.list-group-item');
        let currentDay = null;

        for (const item of items) {
            const heading = item.querySelector('h4.list-group-item-heading');
            if (!heading) {
                continue;
            }

            const headingText = heading.textContent.trim();
            if (dayNames.includes(headingText)) {
                currentDay = headingText;
                continue;
            }

            if (!currentDay) {
                continue;
            }

            const textElement = item.querySelector('p.list-group-item-text');
            if (!textElement) {
                continue;
            }

            const headingMatch = headingText.match(/^(Lecture|Enrolled)\s*-\s*(\w+)/i);
            if (!headingMatch) {
                continue;
            }

            const type = headingMatch[1];
            const subjectCode = headingMatch[2];
            const content = textElement.textContent.replace(/\s+/g, ' ').trim();
            const activityMatch = content.match(/^(.+?)(?:\s*Time:)/);
            const activityDetail = activityMatch ? activityMatch[1].trim() : type;

            let activityType = 'Class';
            if (/^Lecture/i.test(activityDetail)) {
                activityType = 'Lecture';
            } else if (/Computer Lab/i.test(activityDetail)) {
                activityType = 'Computer Lab';
            } else if (/^Wksp/i.test(activityDetail)) {
                activityType = 'Workshop';
            } else if (/^Tutorial/i.test(activityDetail)) {
                activityType = 'Tutorial';
            } else if (/^Seminar/i.test(activityDetail)) {
                activityType = 'Seminar';
            }

            const timeMatch = content.match(/Time:\s*\w+,\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
            const weeksMatch = content.match(/Weeks:\s*(.+)/);
            if (!timeMatch || !weeksMatch) {
                continue;
            }

            const locationMatch = content.match(/Location:\s*(.+?)(?:\s*Weeks:|$)/);
            events.push({
                type,
                subjectCode,
                activityType,
                activityDetail,
                day: currentDay.substring(0, 3),
                startTime: timeMatch[1],
                endTime: timeMatch[2],
                location: locationMatch ? locationMatch[1].trim() : '',
                weeks: weeksMatch[1].trim(),
                session: detectSession(subjectCode)
            });
        }

        return events;
    }

    function downloadICS(content) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = DOWNLOAD_FILENAME;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();

        // Give Safari time to take ownership of the Blob before cleanup.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID} {
                margin: 15px 0;
            }

            #${PANEL_ID} .sols-calendar-controls {
                align-items: flex-end;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }

            #${PANEL_ID} .sols-calendar-field {
                margin: 0;
                min-width: 140px;
            }

            #${PANEL_ID} .sols-calendar-field label {
                display: block;
                margin-bottom: 5px;
            }

            #${PANEL_ID} .sols-calendar-year-value[readonly] {
                background-color: #fff;
                cursor: default;
            }

            #${PANEL_ID} .sols-calendar-export-button {
                margin-bottom: 0;
            }

            #${PANEL_ID} .sols-calendar-status {
                align-self: center;
                margin: 0;
                min-height: 20px;
            }

            #${PANEL_ID} .sols-calendar-status[data-state="success"] {
                color: #3c763d;
            }

            #${PANEL_ID} .sols-calendar-status[data-state="error"] {
                color: #a94442;
            }

            @media (max-width: 600px) {
                #${PANEL_ID} .sols-calendar-controls {
                    align-items: stretch;
                    flex-direction: column;
                }

                #${PANEL_ID} .sols-calendar-field,
                #${PANEL_ID} .sols-calendar-field .form-control,
                #${PANEL_ID} .sols-calendar-export-button {
                    width: 100%;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function createPanel() {
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.className = 'panel panel-default';
        panel.setAttribute('aria-labelledby', `${PANEL_ID}-title`);

        const heading = document.createElement('div');
        heading.className = 'panel-heading';

        const title = document.createElement('strong');
        title.id = `${PANEL_ID}-title`;
        title.textContent = 'Export timetable to calendar';
        heading.appendChild(title);

        const body = document.createElement('div');
        body.className = 'panel-body';

        const controls = document.createElement('div');
        controls.className = 'sols-calendar-controls';

        const field = document.createElement('div');
        field.className = 'form-group sols-calendar-field';

        const label = document.createElement('label');
        label.htmlFor = `${PANEL_ID}-year`;
        label.textContent = 'Academic year';

        const years = Object.keys(ACADEMIC_CALENDAR).sort();
        let yearControl;

        if (years.length === 1) {
            yearControl = document.createElement('input');
            yearControl.type = 'text';
            yearControl.readOnly = true;
            yearControl.value = years[0];
            yearControl.setAttribute('aria-readonly', 'true');
        } else {
            yearControl = document.createElement('select');
            for (const year of years) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearControl.appendChild(option);
            }
        }

        yearControl.id = `${PANEL_ID}-year`;
        yearControl.className = 'form-control input-sm sols-calendar-year-value';
        field.append(label, yearControl);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-primary btn-sm sols-calendar-export-button';
        button.textContent = 'Export to ICS';

        const status = document.createElement('p');
        status.className = 'sols-calendar-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        button.addEventListener('click', () => {
            button.disabled = true;
            status.dataset.state = 'working';
            status.textContent = 'Reading timetable…';

            try {
                const events = parseTimetable();
                if (events.length === 0) {
                    throw new Error('No timetable entries were found');
                }

                const year = Number(yearControl.value);
                const ics = generateICS(events, year);
                downloadICS(ics);

                status.dataset.state = 'success';
                status.textContent = `Exported ${events.length} classes to ${DOWNLOAD_FILENAME}`;
            } catch (error) {
                console.error('SOLS Calendar export error:', error);
                status.dataset.state = 'error';
                status.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });

        controls.append(field, button, status);
        body.appendChild(controls);
        panel.append(heading, body);
        return panel;
    }

    function mountPanel() {
        if (document.getElementById(PANEL_ID)) {
            return true;
        }

        const timetable = document.querySelector('#desktop-version, #mobile-version');
        if (!timetable || !timetable.parentNode) {
            return false;
        }

        injectStyles();
        timetable.parentNode.insertBefore(createPanel(), timetable);
        return true;
    }

    if (!mountPanel()) {
        const observer = new MutationObserver(() => {
            if (mountPanel()) {
                observer.disconnect();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
})();
