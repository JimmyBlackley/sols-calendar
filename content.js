/**
 * Content script for SOLSS Timetable to ICS Chrome Extension.
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
        console.error('SOLSS-Cal: Could not find #mobile-version element');
        return events;
    }

    const items = mobileView.querySelectorAll('.list-group-item');
    let currentDay = null;

    for (const item of items) {
        // Check if this is a day header
        const heading = item.querySelector('h4.list-group-item-heading');
        if (!heading) continue;

        const headingText = heading.textContent.trim();

        // Day headers have a specific background style
        if (item.style.backgroundColor || item.getAttribute('style')?.includes('background')) {
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            if (dayNames.includes(headingText)) {
                currentDay = headingText;
                continue;
            }
        }

        // This is a class entry
        if (!currentDay) continue;

        const textEl = item.querySelector('p.list-group-item-text');
        if (!textEl) continue;

        const text = textEl.innerHTML;
        const textContent = textEl.textContent;

        // Parse heading: "Lecture - ISIT307" or "Enrolled - CSIT242"
        const headingMatch = headingText.match(/^(Lecture|Enrolled)\s*-\s*(\w+)/i);
        if (!headingMatch) continue;

        const type = headingMatch[1];
        const subjectCode = headingMatch[2];

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
        if (!timeMatch) continue;
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];

        // Extract location
        const locationMatch = textContent.match(/Location:\s*(.+?)(?:\s*Weeks:|$)/);
        const location = locationMatch ? locationMatch[1].trim() : '';

        // Extract weeks
        const weeksMatch = textContent.match(/Weeks:\s*(.+)/);
        if (!weeksMatch) continue;
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
 * Falls back to "Autumn" if not found.
 */
function detectSession(subjectCode) {
    // Search the desktop table for session info
    const desktopTable = document.querySelector('#desktop-version .timetable');
    if (desktopTable) {
        const cells = desktopTable.querySelectorAll('td.lecture, td.enrolled');
        for (const cell of cells) {
            const text = cell.textContent;
            if (text.includes(subjectCode)) {
                if (/Annual/i.test(text)) return 'Annual';
                if (/Spring/i.test(text)) return 'Spring';
                if (/Autumn/i.test(text)) return 'Autumn';
            }
        }
    }

    // Also check mobile view
    const mobileItems = document.querySelectorAll('#mobile-version .list-group-item p.list-group-item-text');
    // The mobile view doesn't explicitly show the session, but the desktop does
    // If we still haven't found it, default to Autumn
    return 'Autumn';
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'parseTimetable') {
        const events = parseTimetable();
        sendResponse({ events });
    } else if (request.action === 'generateICS') {
        const ics = generateICS(request.events, request.year);
        sendResponse({ ics });
    } else if (request.action === 'downloadICS') {
        // Inject into page's main world so the blob URL is page-scoped
        // (content script blob URLs are extension-scoped and downloads break)
        const script = document.createElement('script');
        script.textContent = `(function() {
            var blob = new Blob([${JSON.stringify(request.icsContent)}], {type: 'text/calendar'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = ${JSON.stringify(request.filename || 'UOW_class_timetable.ics')};
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        })();`;
        document.documentElement.appendChild(script);
        script.remove();
        sendResponse({ success: true });
    }
    return true;
});
