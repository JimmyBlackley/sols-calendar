/**
 * Firefox popup flow: load UOW's public academic dates, read the active SOLS
 * timetable locally, generate the ICS in the extension popup, and download it.
 */

const TIMETABLE_ORIGIN = 'https://solss.uow.edu.au';
const TIMETABLE_PATH = '/sid/sols_tutorial_enrolment.my_timetable';
const DOWNLOAD_FILENAME = 'UOW_class_timetable.ics';
const yearSelect = document.getElementById('yearSelect');
const exportButton = document.getElementById('exportBtn');
const status = document.getElementById('status');
let academicCalendar = null;

function isTimetableUrl(value) {
    try {
        const url = new URL(value);
        return url.origin === TIMETABLE_ORIGIN && url.pathname === TIMETABLE_PATH;
    } catch {
        return false;
    }
}

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

function showUnavailableYearOption(message) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    yearSelect.replaceChildren(option);
}

function populateAcademicYears(calendar) {
    const years = getAvailableAcademicYears(calendar);
    if (years.length === 0) {
        throw new Error('UOW did not publish any complete standard-session calendars');
    }

    const defaultYear = chooseDefaultAcademicYear(years);
    const options = years.map((year) => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        return option;
    });

    if (defaultYear === null) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a past academic year…';
        placeholder.disabled = true;
        placeholder.selected = true;
        options.unshift(placeholder);
    }

    yearSelect.replaceChildren(...options);
    yearSelect.value = defaultYear === null ? '' : String(defaultYear);
}

function updateExportAvailability() {
    const selectedYear = Number(yearSelect.value);
    exportButton.disabled = !academicCalendar?.years?.[selectedYear];
}

async function initializeAcademicYears() {
    yearSelect.disabled = true;
    exportButton.disabled = true;
    showUnavailableYearOption('Loading from UOW…');
    setStatus(status, 'info', 'Loading available academic years from UOW…', true);

    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!isTimetableUrl(tab?.url)) {
            throw new Error('Please navigate to your SOLS My Timetable page first');
        }

        const response = await browser.tabs.sendMessage(tab.id, {
            action: 'getAcademicCalendar'
        });
        if (response?.error) {
            throw new Error(response.error);
        }
        const calendar = response?.calendar;
        populateAcademicYears(calendar);
        academicCalendar = calendar;
        yearSelect.disabled = false;
        updateExportAvailability();
        setStatus(
            status,
            'info',
            yearSelect.value
                ? 'Academic years loaded from UOW.'
                : 'Select an academic year published by UOW.'
        );
    } catch (error) {
        console.error('SOLS Calendar academic-year loading error:', error);
        academicCalendar = null;
        showUnavailableYearOption('Academic years unavailable');
        setStatus(
            status,
            'error',
            `✗ Unable to load available UOW academic years: ${error.message}`
        );
    }
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

exportButton.addEventListener('click', async () => {
    const year = Number(yearSelect.value);

    exportButton.disabled = true;
    yearSelect.disabled = true;

    try {
        if (!academicCalendar?.years?.[year]) {
            throw new Error('Select an academic year published by UOW');
        }

        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!isTimetableUrl(tab?.url)) {
            throw new Error('Please navigate to your SOLS My Timetable page first');
        }

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
        const ics = generateICS(response.events, year, academicCalendar);
        downloadICS(ics);

        setStatus(
            status,
            'success',
            `✓ Exported ${response.events.length} classes using current UOW dates.`
        );
    } catch (error) {
        console.error('SOLS Calendar export error:', error);
        setStatus(status, 'error', `✗ ${error.message}`);
    } finally {
        const canExport = Boolean(academicCalendar);
        yearSelect.disabled = !canExport;
        updateExportAvailability();
    }
});

yearSelect.addEventListener('change', updateExportAvailability);
initializeAcademicYears();
