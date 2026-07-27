/**
 * Firefox popup flow: load UOW's public academic dates, read the active SOLS
 * timetable locally, generate the ICS in the extension popup, and download it.
 */

const TIMETABLE_URL_PREFIX =
    'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable';
const DOWNLOAD_FILENAME = 'UOW_class_timetable.ics';
const yearInput = document.getElementById('yearSelect');

yearInput.value = String(new Date().getFullYear());

function setStatus(status, state, message, showSpinner = false) {
    status.className = `status ${state}`;
    status.replaceChildren();

    if (showSpinner) {
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        status.appendChild(spinner);
    }
    status.appendChild(document.createTextNode(message));
}

function downloadICS(ics) {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = DOWNLOAD_FILENAME;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

document.getElementById('exportBtn').addEventListener('click', async () => {
    const button = document.getElementById('exportBtn');
    const status = document.getElementById('status');
    const year = Number(yearInput.value);

    button.disabled = true;

    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.startsWith(TIMETABLE_URL_PREFIX)) {
            throw new Error('Please navigate to your SOLS My Timetable page first');
        }

        setStatus(status, 'info', 'Loading official UOW academic dates…', true);
        const calendarResult = await loadAcademicCalendarForYear(year);

        setStatus(status, 'info', 'Reading timetable…', true);
        const response = await browser.tabs.sendMessage(tab.id, {
            action: 'parseTimetable'
        });
        if (response?.error) {
            throw new Error(response.error);
        }
        if (!response?.events?.length) {
            throw new Error(
                'No timetable entries found. Make sure you are on the My Timetable page.'
            );
        }

        setStatus(
            status,
            'info',
            `Generating ICS for ${response.events.length} classes…`,
            true
        );
        const ics = generateICS(response.events, year, calendarResult.calendar);
        downloadICS(ics);

        const sourceMessage = calendarResult.source === 'live'
            ? 'using current UOW dates'
            : `using bundled dates verified ${BUNDLED_CALENDAR_VERIFIED_DATE}`;
        setStatus(
            status,
            'success',
            `✓ Exported ${response.events.length} classes ${sourceMessage}.`
        );
    } catch (error) {
        console.error('SOLS Calendar export error:', error);
        setStatus(status, 'error', `✗ ${error.message}`);
    } finally {
        button.disabled = false;
    }
});
