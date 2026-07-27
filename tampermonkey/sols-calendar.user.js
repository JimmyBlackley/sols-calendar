// ==UserScript==
// @name         SOLS Timetable to ICS
// @namespace    https://github.com/JimmyBlackley/sols-calendar
// @version      1.1.1
// @description  Export your UOW SOLS timetable to a local ICS calendar file
// @author       James Blackley
// @license      MIT
// @homepageURL  https://github.com/JimmyBlackley/sols-calendar
// @supportURL   https://github.com/JimmyBlackley/sols-calendar/issues
// @match        https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      www.uow.edu.au
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const PANEL_ID = 'sols-calendar-export';
    const STYLE_ID = 'sols-calendar-export-style';
    const DOWNLOAD_FILENAME = 'UOW_class_timetable.ics';
    const UOW_KEY_DATES_URL = 'https://www.uow.edu.au/student/dates/';
    const UOW_KEY_DATES_TIMEOUT_MS = 10_000;
    const MAX_ACADEMIC_CALENDAR_HTML_SIZE = 1_000_000;
    const MAX_ACADEMIC_CALENDAR_YEARS = 16;
    const MAX_ACADEMIC_SESSION_ANCHORS = 96;
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const WEEK_IN_MS = 7 * DAY_IN_MS;
    const SESSION_WEEK_COUNTS = {
        autumn: 13,
        spring: 13,
        annual: 26
    };
    const MONTHS = {
        jan: 0,
        january: 0,
        feb: 1,
        february: 1,
        mar: 2,
        march: 2,
        apr: 3,
        april: 3,
        may: 4,
        jun: 5,
        june: 5,
        jul: 6,
        july: 6,
        aug: 7,
        august: 7,
        sep: 8,
        sept: 8,
        september: 8,
        oct: 9,
        october: 9,
        nov: 10,
        november: 10,
        dec: 11,
        december: 11
    };

    function normalizeText(value) {
        return String(value)
            .replace(/\u00a0/g, ' ')
            .replace(/[–—−]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseISODateUTC(value, context) {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
            throw new Error(`Invalid date for ${context}`);
        }

        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const timestamp = Date.UTC(year, month, day);
        const date = new Date(timestamp);

        if (
            date.getUTCFullYear() !== year
            || date.getUTCMonth() !== month
            || date.getUTCDate() !== day
        ) {
            throw new Error(`Invalid date for ${context}`);
        }

        return timestamp;
    }

    function formatISODateUTC(timestamp) {
        const date = new Date(timestamp);
        const pad = (number) => String(number).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }

    function parseOfficialDateRange(value, context) {
        const normalized = normalizeText(value);
        const match = normalized.match(
            /^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?\s+-\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
        );
        if (!match) {
            throw new Error(`Could not parse the teaching dates for ${context}`);
        }

        const startMonth = MONTHS[match[2].toLowerCase()];
        const endMonth = MONTHS[match[5].toLowerCase()];
        const endYear = Number(match[6]);
        if (startMonth === undefined || endMonth === undefined) {
            throw new Error(`Could not parse the teaching dates for ${context}`);
        }

        const startYear = match[3]
            ? Number(match[3])
            : endYear - (startMonth > endMonth ? 1 : 0);
        const startDate = [
            startYear,
            String(startMonth + 1).padStart(2, '0'),
            String(Number(match[1])).padStart(2, '0')
        ].join('-');
        const endDate = [
            endYear,
            String(endMonth + 1).padStart(2, '0'),
            String(Number(match[4])).padStart(2, '0')
        ].join('-');

        parseISODateUTC(startDate, context);
        parseISODateUTC(endDate, context);
        return { startDate, endDate };
    }

    function validateSessionSegments(year, session, inputSegments) {
        const expectedWeekCount = SESSION_WEEK_COUNTS[session];
        if (!expectedWeekCount || !Array.isArray(inputSegments) || inputSegments.length === 0) {
            throw new Error(`Missing ${session} teaching periods for ${year}`);
        }

        const segments = inputSegments
            .map((segment) => ({ ...segment }))
            .sort((left, right) => left.startWeek - right.startWeek);
        const weeks = {};
        let expectedStartWeek = 1;
        let previousStartTimestamp = null;
        let previousTeachingWeekCount = null;

        for (const segment of segments) {
            const context = `${session} ${year} weeks ${segment.startWeek}-${segment.endWeek}`;
            if (
                !Number.isInteger(segment.startWeek)
                || !Number.isInteger(segment.endWeek)
                || segment.startWeek !== expectedStartWeek
                || segment.endWeek < segment.startWeek
                || segment.endWeek > expectedWeekCount
            ) {
                throw new Error(`Invalid or non-contiguous teaching weeks for ${context}`);
            }

            const startTimestamp = parseISODateUTC(segment.startDate, context);
            const endTimestamp = parseISODateUTC(segment.endDate, context);
            const startDate = new Date(startTimestamp);
            const endDate = new Date(endTimestamp);
            if (
                startDate.getUTCFullYear() !== Number(year)
                || endDate.getUTCFullYear() !== Number(year)
                || startDate.getUTCDay() !== 1
                || endDate.getUTCDay() !== 5
            ) {
                throw new Error(`Teaching periods must run Monday to Friday within ${year}`);
            }

            const teachingWeekCount = segment.endWeek - segment.startWeek + 1;
            const expectedEndTimestamp =
                startTimestamp + ((teachingWeekCount - 1) * WEEK_IN_MS) + (4 * DAY_IN_MS);
            if (endTimestamp !== expectedEndTimestamp) {
                throw new Error(`Teaching date range does not match ${context}`);
            }

            if (previousStartTimestamp !== null) {
                const breakDuration =
                    (startTimestamp - (previousStartTimestamp + previousTeachingWeekCount * WEEK_IN_MS))
                    / WEEK_IN_MS;
                if (!Number.isInteger(breakDuration) || breakDuration < 0) {
                    throw new Error(`Invalid recess placement before ${context}`);
                }
            }

            for (let week = segment.startWeek; week <= segment.endWeek; week += 1) {
                weeks[week] = formatISODateUTC(
                    startTimestamp + ((week - segment.startWeek) * WEEK_IN_MS)
                );
            }

            expectedStartWeek = segment.endWeek + 1;
            previousStartTimestamp = startTimestamp;
            previousTeachingWeekCount = teachingWeekCount;
        }

        if (expectedStartWeek !== expectedWeekCount + 1) {
            throw new Error(`Incomplete ${session} teaching weeks for ${year}`);
        }

        return { weeks };
    }

    function parseAcademicCalendarYear(parsedDocument, requestedYear, anchors) {
        const requestedYearText = String(requestedYear);
        const sessions = {};
        let recognizedSessionCount = 0;

        for (const tab of anchors) {
            const title = normalizeText(tab.textContent);
            const titleMatch = title.match(/^(Autumn|Spring|Annual)\s+Session\s+(\d{4})$/i);
            if (!titleMatch) {
                continue;
            }

            const session = titleMatch[1].toLowerCase();
            const year = titleMatch[2];
            if (year !== requestedYearText) {
                continue;
            }
            const panelId = tab.getAttribute('href').slice(1);
            const panel = parsedDocument.getElementById(panelId);
            if (!panel) {
                throw new Error(`Missing UOW calendar panel for ${title}`);
            }

            const segments = [];
            for (const row of panel.querySelectorAll('tr')) {
                const cells = Array.from(row.children).filter((element) =>
                    element.tagName === 'TD' || element.tagName === 'TH'
                );
                if (cells.length < 2) {
                    continue;
                }

                const activity = normalizeText(cells[0].textContent);
                const activityMatch = activity.match(
                    /^Lectures (?:Commence|Recommence) \(\s*weeks?\s+(\d+)\s*-\s*(\d+)\s*\)$/i
                );
                if (!activityMatch) {
                    continue;
                }

                const context = `${session} ${year} weeks ${activityMatch[1]}-${activityMatch[2]}`;
                const dateRange = parseOfficialDateRange(cells[1].textContent, context);
                segments.push({
                    startWeek: Number(activityMatch[1]),
                    endWeek: Number(activityMatch[2]),
                    ...dateRange
                });
            }

            const parsedSession = validateSessionSegments(year, session, segments);
            if (sessions[session]) {
                if (JSON.stringify(sessions[session]) !== JSON.stringify(parsedSession)) {
                    throw new Error(`Conflicting UOW calendar panels for ${title}`);
                }
                continue;
            }

            sessions[session] = parsedSession;
            recognizedSessionCount += 1;
        }

        if (recognizedSessionCount === 0) {
            throw new Error(
                `The UOW Key dates page did not contain teaching periods for ${requestedYearText}`
            );
        }

        for (const session of Object.keys(SESSION_WEEK_COUNTS)) {
            if (!sessions[session]) {
                throw new Error(`Missing ${session} teaching periods for ${requestedYearText}`);
            }
        }

        return {
            [requestedYearText]: sessions
        };
    }

    function parseAcademicCalendars(html, requestedYear = null) {
        const template = document.createElement('template');
        template.innerHTML = html;
        const parsedDocument = template.content;
        const anchorsByYear = new Map();
        let recognizedAnchorCount = 0;

        for (const tab of parsedDocument.querySelectorAll('a[href^="#tab-"]')) {
            const title = normalizeText(tab.textContent);
            const titleMatch = title.match(/^(Autumn|Spring|Annual)\s+Session\s+(\d{4})$/i);
            if (!titleMatch) {
                continue;
            }

            recognizedAnchorCount += 1;
            if (recognizedAnchorCount > MAX_ACADEMIC_SESSION_ANCHORS) {
                throw new Error('UOW returned too many standard session links');
            }

            const year = Number(titleMatch[2]);
            if (requestedYear !== null && year !== Number(requestedYear)) {
                continue;
            }
            if (!anchorsByYear.has(year)) {
                if (anchorsByYear.size >= MAX_ACADEMIC_CALENDAR_YEARS) {
                    throw new Error('UOW returned too many academic years');
                }
                anchorsByYear.set(year, []);
            }
            anchorsByYear.get(year).push(tab);
        }

        if (requestedYear !== null) {
            const requestedYearNumber = Number(requestedYear);
            const anchors = anchorsByYear.get(requestedYearNumber);
            if (!anchors) {
                throw new Error(
                    `The UOW Key dates page did not contain teaching periods for ${requestedYear}`
                );
            }
            return parseAcademicCalendarYear(
                parsedDocument,
                requestedYearNumber,
                anchors
            );
        }

        const calendars = {};
        const validationErrors = [];
        const sortedYears = Array.from(anchorsByYear).sort(
            ([leftYear], [rightYear]) => leftYear - rightYear
        );

        for (const [year, anchors] of sortedYears) {
            try {
                Object.assign(
                    calendars,
                    parseAcademicCalendarYear(parsedDocument, year, anchors)
                );
            } catch (error) {
                validationErrors.push(error);
            }
        }

        if (Object.keys(calendars).length === 0) {
            const detail = validationErrors[0]?.message;
            throw new Error(
                detail
                    ? `The UOW Key dates page contained no complete academic calendar: ${detail}`
                    : 'The UOW Key dates page did not contain teaching periods'
            );
        }

        return calendars;
    }

    function getResponseHeader(responseHeaders, name) {
        const expectedName = name.toLowerCase();
        for (const line of String(responseHeaders || '').split(/\r?\n/)) {
            const separator = line.indexOf(':');
            if (separator === -1) {
                continue;
            }
            if (line.slice(0, separator).trim().toLowerCase() === expectedName) {
                return line.slice(separator + 1).trim();
            }
        }
        return null;
    }

    function requestLiveAcademicCalendars(requestedYear = null) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: UOW_KEY_DATES_URL,
                anonymous: true,
                nocache: true,
                timeout: UOW_KEY_DATES_TIMEOUT_MS,
                redirect: 'error',
                headers: {
                    Accept: 'text/html'
                },
                onload(response) {
                    try {
                        if (response.status !== 200) {
                            throw new Error('UOW Key dates returned an unexpected status');
                        }
                        if (response.finalUrl !== UOW_KEY_DATES_URL) {
                            throw new Error('UOW Key dates redirected unexpectedly');
                        }

                        const contentType = getResponseHeader(
                            response.responseHeaders,
                            'content-type'
                        );
                        if (!contentType || !/^text\/html(?:;|$)/i.test(contentType)) {
                            throw new Error('UOW Key dates returned an unexpected content type');
                        }

                        const html = response.responseText;
                        const byteLength = typeof html === 'string'
                            ? new TextEncoder().encode(html).byteLength
                            : 0;
                        if (
                            byteLength === 0
                            || byteLength > MAX_ACADEMIC_CALENDAR_HTML_SIZE
                        ) {
                            throw new Error('UOW Key dates returned an invalid response size');
                        }

                        resolve(parseAcademicCalendars(html, requestedYear));
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror() {
                    reject(new Error('Could not access the UOW Key dates page'));
                },
                ontimeout() {
                    reject(new Error('The UOW Key dates request timed out'));
                },
                onabort() {
                    reject(new Error('The UOW Key dates request was cancelled'));
                }
            });
        });
    }

    /**
     * Get the Monday date for an academic week.
     */
    function weekToISODate(calendars, session, weekNumber, year) {
        const normalizedSession = String(session || '').toLowerCase();
        const maximumWeek = SESSION_WEEK_COUNTS[normalizedSession];
        if (!maximumWeek) {
            throw new Error(`Unsupported or unknown session: ${session || 'missing'}`);
        }
        if (
            !Number.isInteger(weekNumber)
            || weekNumber < 1
            || weekNumber > maximumWeek
        ) {
            throw new Error(`Invalid ${normalizedSession} teaching week: ${weekNumber}`);
        }

        const isoDate = calendars[year]?.[normalizedSession]?.weeks?.[weekNumber];
        if (!isoDate) {
            throw new Error(`No calendar date for ${session} ${year} week ${weekNumber}`);
        }
        return isoDate;
    }

    function addDaysToISO(value, days) {
        return formatISODateUTC(
            parseISODateUTC(value, 'timetable event') + (days * DAY_IN_MS)
        );
    }

    function parseWeeks(weekString) {
        const weeks = [];
        const seenWeeks = new Set();
        const maximumSupportedWeek = Math.max(...Object.values(SESSION_WEEK_COUNTS));
        const normalized = normalizeText(String(weekString));
        if (!normalized) {
            throw new Error('A timetable entry has no teaching weeks');
        }

        const parts = normalized.split(',').map((part) => part.trim());

        for (const part of parts) {
            const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
            if (!match) {
                throw new Error(`Invalid teaching weeks: ${weekString}`);
            }

            const start = Number(match[1]);
            const end = match[2] ? Number(match[2]) : start;
            if (start < 1 || end < start || end > maximumSupportedWeek) {
                throw new Error(`Invalid teaching weeks: ${weekString}`);
            }

            for (let week = start; week <= end; week += 1) {
                if (seenWeeks.has(week)) {
                    throw new Error(`Duplicate teaching week ${week}`);
                }
                seenWeeks.add(week);
                weeks.push(week);
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

        const offset = offsets[String(day).toLowerCase()];
        if (offset === undefined) {
            throw new Error(`Invalid timetable day: ${day}`);
        }
        return offset;
    }

    function parseTime(time) {
        const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
            throw new Error(`Invalid class time: ${time || 'missing'}`);
        }

        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (hours > 23 || minutes > 59) {
            throw new Error(`Invalid class time: ${time}`);
        }

        return {
            hours,
            minutes,
            totalMinutes: (hours * 60) + minutes
        };
    }

    function toICSDateTime(date, time) {
        const dateMatch = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
            throw new Error(`Invalid timetable event date: ${date}`);
        }
        const parsedTime = parseTime(time);
        const pad = (number) => String(number).padStart(2, '0');
        return `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}T${pad(parsedTime.hours)}${pad(parsedTime.minutes)}00`;
    }

    function generateUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
            const random = Math.random() * 16 | 0;
            const value = character === 'x' ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    }

    function foldLine(line) {
        const encoder = new TextEncoder();
        const parts = [];
        let current = '';

        for (const character of String(line)) {
            if (encoder.encode(current + character).byteLength > 75) {
                parts.push(current);
                current = ` ${character}`;
            } else {
                current += character;
            }
        }

        parts.push(current);
        return parts.join('\r\n');
    }

    function escapeICSText(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/\r?\n/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function generateICS(events, year, calendars) {
        if (!Array.isArray(events) || events.length === 0) {
            throw new Error('No timetable entries were provided');
        }
        if (!calendars?.[year]) {
            throw new Error(`No verified academic calendar for ${year}`);
        }

        const occurrences = [];
        for (const event of events) {
            const weeks = parseWeeks(event.weeks);
            const dayOffset = dayToOffset(event.day);
            const startTime = parseTime(event.startTime);
            const endTime = parseTime(event.endTime);
            if (endTime.totalMinutes <= startTime.totalMinutes) {
                throw new Error(
                    `Class end time is not after its start time for ${event.subjectCode}`
                );
            }

            for (const week of weeks) {
                const monday = weekToISODate(
                    calendars,
                    event.session,
                    week,
                    year
                );
                occurrences.push({
                    date: addDaysToISO(monday, dayOffset),
                    event,
                    week
                });
            }
        }

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

        for (const occurrence of occurrences) {
            const { event, week } = occurrence;
            const start = toICSDateTime(occurrence.date, event.startTime);
            const end = toICSDateTime(occurrence.date, event.endTime);
            const summary = `${event.subjectCode} ${event.activityType}`;
            const description =
                `${event.type} - ${event.subjectCode}\n`
                + `${event.activityDetail || event.activityType}\nWeek ${week}`;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${generateUID()}@sols-cal`);
            lines.push(`DTSTAMP:${timestamp}`);
            lines.push(foldLine(`DTSTART;TZID=Australia/Sydney:${start}`));
            lines.push(foldLine(`DTEND;TZID=Australia/Sydney:${end}`));
            lines.push(foldLine(`SUMMARY:${escapeICSText(summary)}`));
            if (event.location) {
                lines.push(foldLine(`LOCATION:${escapeICSText(event.location)}`));
            }
            lines.push(foldLine(`DESCRIPTION:${escapeICSText(description)}`));
            lines.push('END:VEVENT');
        }

        lines.push('END:VCALENDAR');
        return `${lines.join('\r\n')}\r\n`;
    }

    function getSearchableCellText(element) {
        const renderedText = typeof element.innerText === 'string'
            ? element.innerText
            : '';

        const readNode = (node) => {
            if (node.nodeType === 3) {
                return node.textContent || '';
            }
            return ` ${Array.from(node.childNodes, readNode).join(' ')} `;
        };
        const structuredText = readNode(element);
        return `${renderedText} ${structuredText}`.trim();
    }

    function detectSession(subjectCode) {
        const desktopTable = document.querySelector('#desktop-version .timetable');
        if (desktopTable) {
            const cells = desktopTable.querySelectorAll('td.lecture, td.enrolled');
            for (const cell of cells) {
                const text = getSearchableCellText(cell);
                const subjectTokens = text.toLowerCase().split(/\W+/);
                if (!subjectTokens.includes(subjectCode.toLowerCase())) {
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

        return null;
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
            const textElement = item.querySelector('p.list-group-item-text');
            if (!heading) {
                if (textElement && /\b(?:Time|Weeks):/i.test(textElement.textContent)) {
                    throw new Error('Could not read a SOLS class heading');
                }
                continue;
            }

            const headingText = heading.textContent.trim();
            if (dayNames.includes(headingText)) {
                currentDay = headingText;
                continue;
            }

            const headingMatch = headingText.match(
                /^(Lecture|Enrolled)\s*-\s*(\w+)\s*$/i
            );
            const looksLikeClass = /^(Lecture|Enrolled)\b/i.test(headingText)
                || (textElement && /\b(?:Time|Weeks):/i.test(textElement.textContent));
            if (!headingMatch) {
                if (looksLikeClass) {
                    throw new Error('Could not read a SOLS class heading');
                }
                continue;
            }

            const type = headingMatch[1];
            const subjectCode = headingMatch[2];
            if (!currentDay) {
                throw new Error(`Could not determine the class day for ${subjectCode}`);
            }
            if (!textElement) {
                throw new Error(`Could not read class details for ${subjectCode}`);
            }

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
            if (!timeMatch) {
                throw new Error(`Could not read class time for ${subjectCode}`);
            }
            if (!weeksMatch) {
                throw new Error(`Could not read teaching weeks for ${subjectCode}`);
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

    function chooseDefaultAcademicYear(availableYears) {
        const currentYear = new Date().getFullYear();
        if (availableYears.includes(currentYear)) {
            return currentYear;
        }

        return availableYears.find((year) => year > currentYear)
            ?? null;
    }

    function populateAcademicYearSelect(yearControl, calendars) {
        const availableYears = Object.keys(calendars)
            .map(Number)
            .filter(Number.isInteger)
            .sort((left, right) => left - right);
        if (availableYears.length === 0) {
            throw new Error('UOW has not published a complete academic calendar');
        }

        const previousYear = Number(yearControl.value);
        yearControl.replaceChildren();
        const selectedYear = availableYears.includes(previousYear)
            ? previousYear
            : chooseDefaultAcademicYear(availableYears);

        if (selectedYear === null) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a past academic year…';
            placeholder.disabled = true;
            placeholder.selected = true;
            yearControl.appendChild(placeholder);
        }

        for (const year of availableYears) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearControl.appendChild(option);
        }

        yearControl.value = selectedYear === null ? '' : String(selectedYear);
        yearControl.dataset.loaded = 'true';
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

        const yearControl = document.createElement('select');
        yearControl.id = `${PANEL_ID}-year`;
        yearControl.className = 'form-control input-sm sols-calendar-year-value';
        const yearPlaceholder = document.createElement('option');
        yearPlaceholder.value = '';
        yearPlaceholder.textContent = 'Load from UOW…';
        yearControl.appendChild(yearPlaceholder);
        field.append(label, yearControl);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-primary btn-sm sols-calendar-export-button';
        button.textContent = 'Export to ICS';

        const status = document.createElement('p');
        status.className = 'sols-calendar-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        let pendingAcademicCalendars = null;
        let academicCalendarRequest = null;
        let yearOptionsLoaded = false;

        const loadAvailableAcademicCalendars = async () => {
            if (pendingAcademicCalendars) {
                return pendingAcademicCalendars;
            }
            if (academicCalendarRequest) {
                return academicCalendarRequest;
            }

            academicCalendarRequest = requestLiveAcademicCalendars();
            try {
                const calendars = await academicCalendarRequest;
                populateAcademicYearSelect(yearControl, calendars);
                pendingAcademicCalendars = calendars;
                yearOptionsLoaded = true;
                return calendars;
            } catch (error) {
                pendingAcademicCalendars = null;
                throw error;
            } finally {
                academicCalendarRequest = null;
            }
        };

        const loadYearsFromControl = async (event) => {
            if (!event?.isTrusted) {
                return;
            }
            if (yearOptionsLoaded || pendingAcademicCalendars || academicCalendarRequest) {
                return;
            }

            button.disabled = true;
            status.dataset.state = 'working';
            status.textContent = 'Loading UOW academic years…';
            try {
                await loadAvailableAcademicCalendars();
                status.dataset.state = 'ready';
                status.textContent = 'Select an academic year';
            } catch (error) {
                console.error('SOLS Calendar academic-year error:', error);
                status.dataset.state = 'error';
                status.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        };

        yearControl.addEventListener('pointerdown', loadYearsFromControl);
        yearControl.addEventListener('keydown', loadYearsFromControl);
        yearControl.addEventListener('click', loadYearsFromControl);

        button.addEventListener('click', async (event) => {
            if (!event.isTrusted) {
                return;
            }
            button.disabled = true;
            yearControl.disabled = true;
            status.dataset.state = 'working';
            status.textContent = 'Loading UOW academic calendar…';

            try {
                let calendars = pendingAcademicCalendars;
                if (!calendars) {
                    const selectedYear = Number(yearControl.value);
                    calendars = yearOptionsLoaded && Number.isInteger(selectedYear)
                        ? await requestLiveAcademicCalendars(selectedYear)
                        : await loadAvailableAcademicCalendars();
                }

                const year = Number(yearControl.value);
                if (!Number.isInteger(year) || !calendars[year]) {
                    throw new Error('Select an academic year published by UOW');
                }

                status.textContent = 'Reading timetable…';
                const events = parseTimetable();
                if (events.length === 0) {
                    throw new Error('No timetable entries were found');
                }

                const ics = generateICS(events, year, calendars);
                downloadICS(ics);

                status.dataset.state = 'success';
                status.textContent =
                    `Exported ${events.length} classes to ${DOWNLOAD_FILENAME}`;
            } catch (error) {
                console.error('SOLS Calendar export error:', error);
                status.dataset.state = 'error';
                status.textContent = error.message;
            } finally {
                pendingAcademicCalendars = null;
                button.disabled = false;
                yearControl.disabled = false;
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
