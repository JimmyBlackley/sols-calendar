/**
 * Popup script for SOLS Timetable to ICS Chrome Extension.
 * Sends a message to the content script → receives events → generates ICS → downloads.
 */

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
        if (!tab.url.includes('solss.uow.edu.au')) {
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

        // Create a blob and download via chrome.downloads API
        const blob = new Blob([icsResponse.ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        await chrome.downloads.download({
            url: url,
            filename: 'UOW_class_timetable.ics',
            saveAs: true
        });
        URL.revokeObjectURL(url);

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
