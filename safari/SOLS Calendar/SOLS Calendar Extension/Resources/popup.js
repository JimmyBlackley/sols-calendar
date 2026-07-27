/**
 * Popup script for SOLS Timetable to ICS Safari Web Extension.
 * Sends a message to the content script → receives events → generates ICS → downloads.
 */

const TIMETABLE_URL_PREFIX =
    'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable';

document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    const status = document.getElementById('status');
    const year = parseInt(document.getElementById('yearSelect').value, 10);

    btn.disabled = true;
    status.className = 'status info';
    status.innerHTML = '<span class="spinner"></span> Parsing timetable…';

    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error('No active tab found');
        }

        // Check if we're on the right page
        if (!tab.url || !tab.url.startsWith(TIMETABLE_URL_PREFIX)) {
            throw new Error('Please navigate to your SOLS My Timetable page first');
        }

        // Send message to content script to parse the timetable
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'parseTimetable' });

        if (!response || !response.events || response.events.length === 0) {
            throw new Error('No timetable entries found. Make sure you are on the My Timetable page.');
        }

        status.innerHTML = `<span class="spinner"></span> Generating ICS for ${response.events.length} classes…`;

        // We need to load calendar.js functions. Since it's a content script,
        // we need to ask the content script to generate the ICS too, or duplicate the logic.
        // Let's inject and execute the generation in the content script context.
        const icsResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'generateICS',
            events: response.events,
            year: year
        });

        if (!icsResponse || !icsResponse.ics) {
            throw new Error('Failed to generate ICS file');
        }

        // Safari doesn't implement the WebExtensions downloads API. Use a
        // local Blob URL instead; no timetable data leaves the browser.
        const blob = new Blob([icsResponse.ics], {
            type: 'text/calendar;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'UOW_class_timetable.ics';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        // Revoking immediately can race Safari's download hand-off.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);

        status.className = 'status success';
        status.textContent = `✓ Exported ${response.events.length} classes!`;
    } catch (err) {
        console.error('SOLS-Cal export error:', err);
        status.className = 'status error';
        status.textContent = `✗ ${err.message}`;
    } finally {
        btn.disabled = false;
    }
});
