'use strict';

importScripts('calendar.js');

const TIMETABLE_ORIGIN = 'https://solss.uow.edu.au';
const TIMETABLE_PATH = '/sid/sols_tutorial_enrolment.my_timetable';
let academicCalendarSourceRequest = null;

function isTimetableContentScript(sender) {
    const senderUrl = sender?.url || sender?.tab?.url || '';
    try {
        const url = new URL(senderUrl);
        return url.origin === TIMETABLE_ORIGIN && url.pathname === TIMETABLE_PATH;
    } catch {
        return false;
    }
}

function requestAcademicCalendarSource() {
    if (!academicCalendarSourceRequest) {
        academicCalendarSourceRequest = fetchAcademicCalendarSource()
            .finally(() => {
                academicCalendarSourceRequest = null;
            });
    }
    return academicCalendarSourceRequest;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action !== 'loadAcademicCalendarSource') {
        return false;
    }
    if (!isTimetableContentScript(sender)) {
        sendResponse({ error: 'Academic calendar request rejected' });
        return false;
    }

    requestAcademicCalendarSource()
        .then((source) => sendResponse({ source }))
        .catch((error) => sendResponse({ error: error.message }));
    return true;
});
