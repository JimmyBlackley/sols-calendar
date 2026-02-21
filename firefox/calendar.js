/**
 * Academic calendar configuration and ICS generation for UOW.
 * Handles week-to-date mapping with mid-semester break awareness.
 *
 * Annual sessions simply span both semesters:
 *   weeks 1-13 use the Autumn calendar, weeks 14+ use Spring
 *   (week 14 = Spring week 1).
 *  Hardcoded dates for 2026 at the moment. TODO: make this dynamic.
 */

const ACADEMIC_CALENDAR = {
    2026: {
        autumn: {
            // Monday of Week 1
            week1Start: new Date(2026, 2, 2), // 2 Mar 2026
            // Weeks run 1-7, then 1-week mid-session recess, then 8-13
            breaks: [
                { afterWeek: 7, durationWeeks: 1 }
            ]
        },
        spring: {
            week1Start: new Date(2026, 6, 27), // 27 Jul 2026
            // Weeks run 1-9, then 1-week mid-session recess, then 10-13
            breaks: [
                { afterWeek: 9, durationWeeks: 1 }
            ]
        }
        // No separate "annual" config — handled in weekToDate
    }
};

/**
 * Get the Monday date for a given academic week number.
 *
 * For "annual" sessions, weeks 1-13 map to Autumn and weeks 14+
 * map to Spring (week 14 = Spring week 1).
 *
 * @param {string} session - "autumn", "spring", or "annual"
 * @param {number} weekNumber - The academic week number (1-based)
 * @param {number} year - Calendar year
 * @returns {Date} The Monday of that academic week
 */
function weekToDate(session, weekNumber, year) {
    const cal = ACADEMIC_CALENDAR[year];
    if (!cal) {
        throw new Error(`No calendar config for year ${year}`);
    }

    // Annual: redirect to the appropriate semester
    let effectiveSession = session.toLowerCase();
    let effectiveWeek = weekNumber;

    if (effectiveSession === 'annual') {
        if (weekNumber <= 13) {
            effectiveSession = 'autumn';
            effectiveWeek = weekNumber;
        } else {
            effectiveSession = 'spring';
            effectiveWeek = weekNumber - 13; // week 14 → spring week 1
        }
    }

    const config = cal[effectiveSession];
    if (!config) {
        throw new Error(`No calendar config for ${effectiveSession} ${year}`);
    }

    const week1Monday = new Date(config.week1Start);
    // Week 1 = offset 0, Week 2 = offset 1 week, etc.
    let totalOffsetWeeks = effectiveWeek - 1;

    // Add break weeks for any breaks that occur before this week number
    for (const brk of config.breaks) {
        if (effectiveWeek > brk.afterWeek) {
            totalOffsetWeeks += brk.durationWeeks;
        }
    }

    const result = new Date(week1Monday);
    result.setDate(result.getDate() + totalOffsetWeeks * 7);
    return result;
}

/**
 * Parse a week string like "1-13", "3,5,7,9,11,13", or "1-3,14,21,24"
 * into an array of individual week numbers.
 * @param {string} weekStr
 * @returns {number[]}
 */
function parseWeeks(weekStr) {
    const weeks = [];
    const parts = weekStr.split(',').map(s => s.trim());
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                weeks.push(i);
            }
        } else {
            weeks.push(Number(part));
        }
    }
    return weeks;
}

/**
 * Map a day abbreviation/name to a day-of-week offset (0=Mon, 1=Tue, ..., 4=Fri).
 */
function dayToOffset(day) {
    const map = {
        'mon': 0, 'monday': 0,
        'tue': 1, 'tuesday': 1,
        'wed': 2, 'wednesday': 2,
        'thu': 3, 'thursday': 3,
        'fri': 4, 'friday': 4,
        'sat': 5, 'saturday': 5,
        'sun': 6, 'sunday': 6
    };
    return map[day.toLowerCase()] ?? 0;
}

/**
 * Format a Date + time string (HH:MM) into ICS datetime format.
 * Returns YYYYMMDDTHHMMSS
 */
function toICSDateTime(date, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hours)}${pad(minutes)}00`;
}

/**
 * Generate a UUID for ICS event UIDs.
 */
function generateUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Fold long ICS lines at 75 octets per RFC 5545.
 */
function foldLine(line) {
    const parts = [];
    while (line.length > 75) {
        parts.push(line.substring(0, 75));
        line = ' ' + line.substring(75);
    }
    parts.push(line);
    return parts.join('\r\n');
}

/**
 * Generate a complete ICS file string from parsed timetable events.
 * @param {Array} events - Parsed class events from the content script
 * @param {number} year - The calendar year
 * @returns {string} ICS file content
 */
function generateICS(events, year) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SOLS Timetable to ICS//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:UOW Timetable',
        'X-WR-TIMEZONE:Australia/Sydney',
        // VTIMEZONE for Australia/Sydney
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
    const pad = (n) => String(n).padStart(2, '0');
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    for (const event of events) {
        const session = event.session.toLowerCase();
        const weeks = parseWeeks(event.weeks);
        const dayOffset = dayToOffset(event.day);

        for (const week of weeks) {
            try {
                const mondayOfWeek = weekToDate(session, week, year);
                const eventDate = new Date(mondayOfWeek);
                eventDate.setDate(eventDate.getDate() + dayOffset);

                const dtstart = toICSDateTime(eventDate, event.startTime);
                const dtend = toICSDateTime(eventDate, event.endTime);
                const summary = `${event.subjectCode} ${event.activityType}`;
                const location = event.location || '';
                const description = `${event.type} - ${event.subjectCode}\\n${event.activityDetail || event.activityType}\\nWeek ${week}`;

                lines.push('BEGIN:VEVENT');
                lines.push(`UID:${generateUID()}@sols-cal`);
                lines.push(`DTSTAMP:${dtstamp}`);
                lines.push(foldLine(`DTSTART;TZID=Australia/Sydney:${dtstart}`));
                lines.push(foldLine(`DTEND;TZID=Australia/Sydney:${dtend}`));
                lines.push(foldLine(`SUMMARY:${summary}`));
                if (location) {
                    lines.push(foldLine(`LOCATION:${location}`));
                }
                lines.push(foldLine(`DESCRIPTION:${description}`));
                lines.push('END:VEVENT');
            } catch (e) {
                console.warn(`Skipping week ${week} for ${event.subjectCode}: ${e.message}`);
            }
        }
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}
