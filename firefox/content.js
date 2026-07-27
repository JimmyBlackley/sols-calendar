/**
 * Content script for SOLS Timetable to ICS Chrome Extension.
 * Parses the mobile list view of the "My Timetable" page.
 */

/**
 * Parse the mobile list view to extract timetable events.
 * @returns {Array} Array of event objects
 */
function parseTimetable() {
    const events = [];
    const mobileView = document.querySelector('#mobile-version');
    if (!mobileView) {
        throw new Error('Could not find the SOLS mobile timetable view');
    }

    const items = mobileView.querySelectorAll('.list-group-item');
    let currentDay = null;
    const dayNames = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
    ];

    for (const item of items) {
        const heading = item.querySelector('h4.list-group-item-heading');
        const textEl = item.querySelector('p.list-group-item-text');
        if (!heading) {
            if (textEl && /\b(?:Time|Weeks):/i.test(textEl.textContent)) {
                throw new Error('Could not read a SOLS class heading');
            }
            continue;
        }

        const headingText = heading.textContent.trim();
        if (dayNames.includes(headingText)) {
            currentDay = headingText;
            continue;
        }

        // Parse heading: "Lecture - ISIT307" or "Enrolled - CSIT242"
        const headingMatch = headingText.match(
            /^(Lecture|Enrolled)\s*-\s*(\w+)\s*$/i
        );
        const looksLikeClass = /^(Lecture|Enrolled)\b/i.test(headingText)
            || (textEl && /\b(?:Time|Weeks):/i.test(textEl.textContent));
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
        if (!textEl) {
            throw new Error(`Could not read class details for ${subjectCode}`);
        }

        const textContent = textEl.textContent.replace(/\s+/g, ' ').trim();

        // Parse the text content for details
        // Format varies:
        //   Lecture<br>Time: Mon, 11:30 - 13:30<br>Location: 25-107<br>Weeks: 1-13
        //   Computer Lab:WG-OC-CL/04<br>Time: Mon, 14:30 - 16:30<br>Location: 3-126<br>Weeks: 3,5,7,9,11,13

        // Extract activity type (first line before Time:)
        const activityMatch = textContent.match(/^(.+?)(?:\s*Time:)/);
        const activityDetail = activityMatch ? activityMatch[1].trim() : type;

        // Simplify activity type for the summary
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

        // Extract time
        const timeMatch = textContent.match(/Time:\s*\w+,\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (!timeMatch) {
            throw new Error(`Could not read class time for ${subjectCode}`);
        }
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];

        // Extract location
        const locationMatch = textContent.match(/Location:\s*(.+?)(?:\s*Weeks:|$)/);
        const location = locationMatch ? locationMatch[1].trim() : '';

        // Extract weeks
        const weeksMatch = textContent.match(/Weeks:\s*(.+)/);
        if (!weeksMatch) {
            throw new Error(`Could not read teaching weeks for ${subjectCode}`);
        }
        const weeks = weeksMatch[1].trim();

        // Determine session (Autumn/Spring/Annual) from the desktop table
        // The desktop table contains this info in the cell text (e.g. "Autumn - CSIT242")
        const session = detectSession(subjectCode);

        // Map full day name to abbreviation
        const dayAbbrev = currentDay.substring(0, 3);

        events.push({
            type,
            subjectCode,
            activityType,
            activityDetail,
            day: dayAbbrev,
            startTime,
            endTime,
            location,
            weeks,
            session
        });
    }

    return events;
}

/**
 * Detect the session type for a subject by checking the desktop table.
 * Returns null rather than guessing when SOLS does not expose the session.
 */
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
    // Search the desktop table for session info
    const desktopTable = document.querySelector('#desktop-version .timetable');
    if (desktopTable) {
        const cells = desktopTable.querySelectorAll('td.lecture, td.enrolled');
        for (const cell of cells) {
            const text = getSearchableCellText(cell);
            const subjectTokens = text.toLowerCase().split(/\W+/);
            if (subjectTokens.includes(subjectCode.toLowerCase())) {
                if (/Annual/i.test(text)) return 'Annual';
                if (/Spring/i.test(text)) return 'Spring';
                if (/Autumn/i.test(text)) return 'Autumn';
            }
        }
    }

    return null;
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'parseTimetable') {
        try {
            return Promise.resolve({ events: parseTimetable() });
        } catch (error) {
            return Promise.resolve({ error: error.message });
        }
    }
});
