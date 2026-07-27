/**
 * Runtime academic-calendar loading, validation, and ICS generation for UOW.
 *
 * The official UOW Key dates page is the sole source of teaching dates.
 */

const ACADEMIC_CALENDAR_URL = 'https://www.uow.edu.au/student/dates/';
const ACADEMIC_CALENDAR_MAX_BYTES = 1_000_000;
const ACADEMIC_CALENDAR_MAX_YEARS = 16;
const ACADEMIC_CALENDAR_MAX_SESSION_ANCHORS = 96;

const SESSION_WEEK_COUNTS = {
    autumn: 13,
    spring: 13,
    annual: 26
};

const MONTH_NUMBERS = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
};

function normalizeCalendarText(value) {
    return String(value)
        .replace(/[\u00a0\s]+/g, ' ')
        .replace(/[–—−]/g, '-')
        .trim();
}

function isoDate(year, month, day) {
    const value = new Date(Date.UTC(year, month - 1, day));
    if (
        value.getUTCFullYear() !== year
        || value.getUTCMonth() !== month - 1
        || value.getUTCDate() !== day
    ) {
        throw new Error(`Invalid calendar date: ${year}-${month}-${day}`);
    }

    const pad = (number) => String(number).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
}

function isoDateParts(value) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        throw new Error(`Invalid ISO calendar date: ${value}`);
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
    };
}

function addDaysToISO(value, days) {
    const parts = isoDateParts(value);
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function isoWeekday(value) {
    const parts = isoDateParts(value);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function daysBetweenISO(start, end) {
    const first = isoDateParts(start);
    const second = isoDateParts(end);
    const firstMs = Date.UTC(first.year, first.month - 1, first.day);
    const secondMs = Date.UTC(second.year, second.month - 1, second.day);
    return (secondMs - firstMs) / 86_400_000;
}

function parseCalendarDateRange(text) {
    const normalized = normalizeCalendarText(text);
    const match = normalized.match(
        /^(\d{1,2}) ([A-Za-z]+)(?: (\d{4}))? - (\d{1,2}) ([A-Za-z]+) (\d{4})$/
    );
    if (!match) {
        throw new Error(`Unrecognized UOW date range: ${normalized}`);
    }

    const startMonth = MONTH_NUMBERS[match[2].toLowerCase()];
    const endMonth = MONTH_NUMBERS[match[5].toLowerCase()];
    if (!startMonth || !endMonth) {
        throw new Error(`Unrecognized month in UOW date range: ${normalized}`);
    }

    const endYear = Number(match[6]);
    const startYear = Number(match[3] || endYear);
    return {
        start: isoDate(startYear, startMonth, Number(match[1])),
        end: isoDate(endYear, endMonth, Number(match[4]))
    };
}

function validateSessionSegments(session, year, inputSegments) {
    const expectedWeeks = SESSION_WEEK_COUNTS[session];
    if (!expectedWeeks) {
        throw new Error(`Unsupported UOW session: ${session}`);
    }
    if (!Array.isArray(inputSegments) || inputSegments.length === 0) {
        throw new Error(`No teaching segments found for ${session} ${year}`);
    }

    const segments = inputSegments
        .map((segment) => ({ ...segment }))
        .sort((left, right) => left.from - right.from);

    let expectedFrom = 1;
    let previousEnd = null;

    for (const segment of segments) {
        if (
            !Number.isInteger(segment.from)
            || !Number.isInteger(segment.to)
            || segment.from !== expectedFrom
            || segment.to < segment.from
            || segment.to > expectedWeeks
        ) {
            throw new Error(`Invalid week coverage for ${session} ${year}`);
        }

        const startParts = isoDateParts(segment.start);
        const endParts = isoDateParts(segment.end);
        if (startParts.year !== year || endParts.year !== year) {
            throw new Error(`Teaching dates fall outside ${session} ${year}`);
        }
        if (isoWeekday(segment.start) !== 1 || isoWeekday(segment.end) !== 5) {
            throw new Error(`Teaching segment is not Monday-to-Friday for ${session} ${year}`);
        }

        const expectedEnd = addDaysToISO(
            segment.start,
            ((segment.to - segment.from) * 7) + 4
        );
        if (segment.end !== expectedEnd) {
            throw new Error(`Teaching-week span mismatch for ${session} ${year}`);
        }

        if (previousEnd) {
            const gapDays = daysBetweenISO(previousEnd, segment.start);
            if (gapDays < 3 || (gapDays - 3) % 7 !== 0) {
                throw new Error(`Invalid recess gap for ${session} ${year}`);
            }
        }

        expectedFrom = segment.to + 1;
        previousEnd = segment.end;
    }

    if (expectedFrom !== expectedWeeks + 1) {
        throw new Error(`Incomplete teaching weeks for ${session} ${year}`);
    }

    return { segments };
}

function parseSessionPanel(panel, session, year) {
    const segments = [];

    for (const row of panel.querySelectorAll('tr')) {
        const cells = Array.from(row.children).filter((child) => (
            child.tagName === 'TD' || child.tagName === 'TH'
        ));
        if (cells.length < 2) {
            continue;
        }

        const activity = normalizeCalendarText(cells[0].textContent);
        const weekMatch = activity.match(
            /^Lectures (?:Commence|Recommence) \(\s*weeks?\s+(\d+)\s*-\s*(\d+)\s*\)$/i
        );
        if (!weekMatch) {
            continue;
        }

        const range = parseCalendarDateRange(cells[1].textContent);
        segments.push({
            from: Number(weekMatch[1]),
            to: Number(weekMatch[2]),
            start: range.start,
            end: range.end
        });
    }

    return validateSessionSegments(session, year, segments);
}

function parseAcademicCalendarYear(documentNode, year, anchors) {
    const sessions = {};

    for (const anchor of anchors) {
        const title = normalizeCalendarText(anchor.textContent);
        const titleMatch = title.match(/^(Autumn|Spring|Annual) Session (\d{4})$/i);
        if (!titleMatch || Number(titleMatch[2]) !== year) {
            continue;
        }

        const session = titleMatch[1].toLowerCase();
        const targetId = anchor.getAttribute('href').slice(1);
        const panel = documentNode.getElementById(targetId);
        if (!panel) {
            throw new Error(`UOW session panel is missing for ${title}`);
        }

        const parsedSession = parseSessionPanel(panel, session, year);
        if (sessions[session]) {
            if (JSON.stringify(sessions[session]) !== JSON.stringify(parsedSession)) {
                throw new Error(`Conflicting UOW session tables for ${title}`);
            }
            continue;
        }

        sessions[session] = parsedSession;
    }

    for (const session of Object.keys(SESSION_WEEK_COUNTS)) {
        if (!sessions[session]) {
            throw new Error(`UOW calendar is missing ${session} ${year}`);
        }
    }

    return sessions;
}

/**
 * Parse the official UOW Key dates HTML into a validated calendar dataset.
 * Remote HTML is read as an inert document and is never inserted into SOLS.
 */
function parseAcademicCalendarHtml(
    html,
    sourceUrl = ACADEMIC_CALENDAR_URL,
    requestedYear = null
) {
    if (typeof html !== 'string' || html.trim().length === 0) {
        throw new Error('UOW returned an empty academic-calendar page');
    }

    const template = document.createElement('template');
    template.innerHTML = html;
    const documentNode = template.content;
    const years = {};
    const anchorsByYear = new Map();
    let recognizedAnchorCount = 0;

    for (const anchor of documentNode.querySelectorAll('a[href^="#tab-"]')) {
        const title = normalizeCalendarText(anchor.textContent);
        const titleMatch = title.match(/^(Autumn|Spring|Annual) Session (\d{4})$/i);
        if (!titleMatch) {
            continue;
        }

        recognizedAnchorCount += 1;
        if (recognizedAnchorCount > ACADEMIC_CALENDAR_MAX_SESSION_ANCHORS) {
            throw new Error('UOW returned too many standard session links');
        }

        const year = Number(titleMatch[2]);
        if (requestedYear !== null && year !== requestedYear) {
            continue;
        }
        if (!anchorsByYear.has(year)) {
            if (anchorsByYear.size >= ACADEMIC_CALENDAR_MAX_YEARS) {
                throw new Error('UOW returned too many academic years');
            }
            anchorsByYear.set(year, []);
        }
        anchorsByYear.get(year).push(anchor);
    }

    if (anchorsByYear.size === 0) {
        throw new Error('No standard UOW session calendars were found');
    }

    const invalidYears = new Map();
    for (const [year, anchors] of anchorsByYear) {
        try {
            years[year] = parseAcademicCalendarYear(documentNode, year, anchors);
        } catch (error) {
            invalidYears.set(year, error);
        }
    }

    if (requestedYear !== null && !years[requestedYear]) {
        throw invalidYears.get(requestedYear)
            || new Error(`UOW has not published standard session dates for ${requestedYear}`);
    }
    if (Object.keys(years).length === 0) {
        throw new Error('No complete UOW session calendars were found');
    }

    const editDate = documentNode.querySelector('meta[name="edit.date"]')
        ?.getAttribute('content') || null;

    return {
        source: {
            type: 'live',
            url: sourceUrl,
            editDate
        },
        years
    };
}

async function fetchAcademicCalendar(fetchImplementation = fetch, requestedYear = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetchImplementation(ACADEMIC_CALENDAR_URL, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
        });

        if (!response || response.status !== 200 || !response.ok) {
            throw new Error(`UOW calendar request failed with HTTP ${response?.status ?? 'unknown'}`);
        }
        if (response.url !== ACADEMIC_CALENDAR_URL) {
            throw new Error('UOW calendar request ended at an unexpected URL');
        }

        const contentType = response.headers?.get('content-type') || '';
        if (!/^text\/html(?:;|$)/i.test(contentType)) {
            throw new Error('UOW calendar response was not HTML');
        }

        const html = await response.text();
        const byteLength = new TextEncoder().encode(html).byteLength;
        if (byteLength === 0 || byteLength > ACADEMIC_CALENDAR_MAX_BYTES) {
            throw new Error('UOW calendar response had an invalid size');
        }

        return parseAcademicCalendarHtml(html, response.url, requestedYear);
    } finally {
        clearTimeout(timeout);
    }
}

function getAvailableAcademicYears(calendar) {
    return Object.keys(calendar?.years || {})
        .map(Number)
        .filter(Number.isInteger)
        .sort((left, right) => left - right);
}

function chooseDefaultAcademicYear(years, currentYear = new Date().getFullYear()) {
    const sortedYears = Array.from(new Set(years))
        .filter(Number.isInteger)
        .sort((left, right) => left - right);

    if (sortedYears.includes(currentYear)) {
        return currentYear;
    }

    const earliestFutureYear = sortedYears.find((year) => year > currentYear);
    return earliestFutureYear ?? null;
}

function weekToISODate(sessionName, weekNumber, year, calendar) {
    const session = String(sessionName || '').toLowerCase();
    const maxWeeks = SESSION_WEEK_COUNTS[session];
    if (!maxWeeks) {
        throw new Error(`Unsupported or unknown session: ${sessionName || 'missing'}`);
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > maxWeeks) {
        throw new Error(`Invalid ${session} teaching week: ${weekNumber}`);
    }

    const sessionCalendar = calendar?.years?.[year]?.[session];
    if (!sessionCalendar) {
        throw new Error(`No verified calendar for ${session} ${year}`);
    }

    const segment = sessionCalendar.segments.find((candidate) => (
        weekNumber >= candidate.from && weekNumber <= candidate.to
    ));
    if (!segment) {
        throw new Error(`No date mapping for ${session} week ${weekNumber} in ${year}`);
    }

    return addDaysToISO(segment.start, (weekNumber - segment.from) * 7);
}

/**
 * Parse a week string such as "1-13" or "3,5,7,9,11,13".
 */
function parseWeeks(weekString) {
    const normalized = normalizeCalendarText(weekString);
    const maximumSupportedWeek = Math.max(...Object.values(SESSION_WEEK_COUNTS));
    if (!/^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test(normalized)) {
        throw new Error(`Invalid teaching weeks: ${weekString}`);
    }

    const weeks = [];
    const seen = new Set();
    for (const part of normalized.split(',').map((value) => value.trim())) {
        const bounds = part.split('-').map((value) => Number(value.trim()));
        const start = bounds[0];
        const end = bounds.length === 2 ? bounds[1] : start;
        if (
            !Number.isInteger(start)
            || !Number.isInteger(end)
            || start < 1
            || end < start
            || end > maximumSupportedWeek
        ) {
            throw new Error(`Invalid teaching-week range: ${part}`);
        }

        for (let week = start; week <= end; week += 1) {
            if (seen.has(week)) {
                throw new Error(`Duplicate teaching week: ${week}`);
            }
            seen.add(week);
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
    const offset = offsets[String(day || '').toLowerCase()];
    if (offset === undefined) {
        throw new Error(`Invalid class day: ${day || 'missing'}`);
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
    const parts = isoDateParts(date);
    const parsedTime = parseTime(time);
    const pad = (number) => String(number).padStart(2, '0');
    return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parsedTime.hours)}${pad(parsedTime.minutes)}00`;
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

/**
 * Generate a complete ICS file. All occurrences are validated before any
 * calendar output is produced, so an unsupported week cannot silently vanish.
 */
function generateICS(events, year, calendar) {
    if (!Array.isArray(events) || events.length === 0) {
        throw new Error('No timetable entries were provided');
    }
    if (!calendar?.years?.[year]) {
        throw new Error(`No verified academic calendar for ${year}`);
    }

    const occurrences = [];
    for (const event of events) {
        const weeks = parseWeeks(event.weeks);
        const dayOffset = dayToOffset(event.day);
        const startTime = parseTime(event.startTime);
        const endTime = parseTime(event.endTime);
        if (endTime.totalMinutes <= startTime.totalMinutes) {
            throw new Error(`Class end time is not after its start time for ${event.subjectCode}`);
        }

        for (const week of weeks) {
            const monday = weekToISODate(event.session, week, year, calendar);
            occurrences.push({
                date: addDaysToISO(monday, dayOffset),
                week,
                event
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
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    for (const occurrence of occurrences) {
        const event = occurrence.event;
        const summary = `${event.subjectCode} ${event.activityType}`;
        const description = `${event.type} - ${event.subjectCode}\n${event.activityDetail || event.activityType}\nWeek ${occurrence.week}`;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${generateUID()}@sols-cal`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(foldLine(`DTSTART;TZID=Australia/Sydney:${toICSDateTime(occurrence.date, event.startTime)}`));
        lines.push(foldLine(`DTEND;TZID=Australia/Sydney:${toICSDateTime(occurrence.date, event.endTime)}`));
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
