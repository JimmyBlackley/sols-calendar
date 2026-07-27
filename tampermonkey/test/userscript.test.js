const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const solsFixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const userscript = fs.readFileSync(path.join(root, 'sols-calendar.user.js'), 'utf8');
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const keyDatesUrl = 'https://www.uow.edu.au/student/dates/';

const teachingPeriods = {
    2026: {
        autumn: [
            ['Lectures Commence (weeks 1 – 7)', '02 Mar – 17 Apr 2026'],
            ['Lectures Recommence (weeks 8 – 13)', '27 Apr – 05 Jun 2026']
        ],
        spring: [
            ['Lectures Commence (weeks 1 – 9)', '27 Jul – 25 Sep 2026'],
            ['Lectures Recommence (weeks 10 – 13)', '05 Oct – 30 Oct 2026']
        ],
        annual: [
            ['Lectures Commence (weeks 1 – 7)', '02 Mar – 17 Apr 2026'],
            ['Lectures Recommence (weeks 8 – 13)', '27 Apr – 05 Jun 2026'],
            ['Lectures Recommence (weeks 14 – 22)', '27 Jul – 25 Sep 2026'],
            ['Lectures Recommence (weeks 23 – 26)', '05 Oct – 30 Oct 2026']
        ]
    },
    2027: {
        autumn: [
            ['Lectures Commence (weeks 1 – 7)', '01 Mar – 16 Apr 2027'],
            ['Lectures Recommence (weeks 8 – 13)', '26 Apr – 04 Jun 2027']
        ],
        spring: [
            ['Lectures Commence (weeks 1 – 9)', '26 Jul – 24 Sep 2027'],
            ['Lectures Recommence (weeks 10 – 13)', '04 Oct – 29 Oct 2027']
        ],
        annual: [
            ['Lectures Commence (weeks 1 – 7)', '01 Mar – 16 Apr 2027'],
            ['Lectures Recommence (weeks 8 – 13)', '26 Apr – 04 Jun 2027'],
            ['Lectures Recommence (weeks 14 – 22)', '26 Jul – 24 Sep 2027'],
            ['Lectures Recommence (weeks 23 – 26)', '04 Oct – 29 Oct 2027']
        ]
    }
};

function buildAcademicCalendarFixture(periods = teachingPeriods) {
    const tabs = [];
    const panels = [];

    for (const [year, sessions] of Object.entries(periods)) {
        for (const [session, rows] of Object.entries(sessions)) {
            const panelId = `tab-fixture-${session}-${year}`;
            const title = `${session[0].toUpperCase()}${session.slice(1)} Session ${year}`;
            tabs.push(`<li><a href="#${panelId}">${title}</a></li>`);
            panels.push(`
                <div class="tabs-panel" id="${panelId}">
                    <table>
                        <thead><tr><th>Activity</th><th>Date</th></tr></thead>
                        <tbody>
                            ${rows.map(([activity, dates]) => `
                                <tr><td>${activity}</td><td>${dates}</td></tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `);
        }
    }

    return `<!doctype html>
        <html>
            <head>
                <meta http-equiv="last-modified" content="2026-07-09">
                <script>window.__uowRemoteScriptRan = true;</script>
            </head>
            <body>
                <h1>Key dates</h1>
                <ul class="tabs">${tabs.join('')}</ul>
                <div class="tabs-content">${panels.join('')}</div>
            </body>
        </html>`;
}

const validAcademicCalendarHtml = buildAcademicCalendarFixture();

function successfulResponse(responseText = validAcademicCalendarHtml, overrides = {}) {
    return {
        status: 200,
        finalUrl: keyDatesUrl,
        responseHeaders: 'content-type: text/html; charset=UTF-8\r\n',
        responseText,
        ...overrides
    };
}

function createEnvironment(options = {}) {
    const dom = new JSDOM(options.solsFixture || solsFixture, {
        runScripts: 'outside-only',
        url: 'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable'
    });
    const { window } = dom;
    const downloads = [];
    const blobs = [];
    const revoked = [];
    const requests = [];
    const errors = [];

    window.Blob = class TestBlob {
        constructor(parts, blobOptions) {
            this.parts = parts;
            this.type = blobOptions?.type;
            blobs.push(this);
        }
    };
    window.TextEncoder = TextEncoder;
    window.URL.createObjectURL = () => `blob:test-${blobs.length}`;
    window.URL.revokeObjectURL = (url) => revoked.push(url);
    window.HTMLAnchorElement.prototype.click = function click() {
        downloads.push({
            download: this.download,
            href: this.href
        });
    };
    window.setTimeout = (callback, delay) => {
        assert.equal(delay, 60_000);
        callback();
        return 1;
    };
    window.console.error = (...args) => errors.push(args);
    window.GM_xmlhttpRequest = (details) => {
        requests.push(details);
        window.queueMicrotask(() => {
            if (options.gmHandler) {
                options.gmHandler(details, window);
            } else {
                details.onload(successfulResponse(options.academicCalendarHtml));
            }
        });
        return { abort() {} };
    };

    window.eval(userscript);
    return { blobs, dom, downloads, errors, requests, revoked, window };
}

async function clickExportAndWait(window) {
    const button = window.document.querySelector('#sols-calendar-export button');
    const status = window.document.querySelector('.sols-calendar-status');
    button.click();

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!button.disabled && status.dataset.state !== 'working') {
            return;
        }
    }

    throw new Error('Timed out waiting for the userscript export');
}

function getICS(blobs) {
    assert.equal(blobs.length, 1);
    return blobs[0].parts.join('');
}

test('metadata keeps execution page-scoped and grants only the UOW calendar request', () => {
    assert.match(userscript, /@version\s+1\.1\.0/);
    assert.equal(packageManifest.version, '1.1.0');
    assert.equal(packageLock.version, '1.1.0');
    assert.equal(packageLock.packages[''].version, '1.1.0');
    assert.match(
        userscript,
        /@match\s+https:\/\/solss\.uow\.edu\.au\/sid\/sols_tutorial_enrolment\.my_timetable\*/
    );
    assert.match(userscript, /@grant\s+GM_xmlhttpRequest/);
    assert.match(userscript, /@connect\s+www\.uow\.edu\.au/);
    assert.match(userscript, /@noframes/);
    assert.doesNotMatch(userscript, /@grant\s+none/);
    assert.doesNotMatch(userscript, /@require\b|@resource\b/);
    assert.doesNotMatch(
        userscript,
        /fetch\s*\(|\bXMLHttpRequest\b|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB/
    );
});

test('injects a SOLS-style panel without making a request before user action', () => {
    const { dom, requests, window } = createEnvironment();
    const panel = window.document.getElementById('sols-calendar-export');
    const timetable = window.document.getElementById('mobile-version');

    assert(panel);
    assert(panel.classList.contains('panel'));
    assert(panel.classList.contains('panel-default'));
    assert.equal(panel.nextElementSibling, timetable);
    assert.equal(panel.querySelector('button').textContent, 'Export to ICS');

    const yearControl = panel.querySelector('#sols-calendar-export-year');
    assert.equal(yearControl.tagName, 'INPUT');
    assert.equal(yearControl.type, 'number');
    assert.equal(yearControl.min, '2000');
    assert.equal(yearControl.max, '2100');
    assert.equal(yearControl.step, '1');
    assert.equal(yearControl.value, String(new Date().getFullYear()));
    assert.equal(window.getComputedStyle(panel.querySelector('button')).marginBottom, '0px');
    assert.equal(requests.length, 0);

    window.eval(userscript);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export').length, 1);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export-style').length, 1);

    dom.window.close();
});

test('uses valid live UOW dates and sends a fixed anonymous request before parsing', async () => {
    let requestObservedWhileLoading = false;
    const environment = createEnvironment({
        gmHandler(details, window) {
            requestObservedWhileLoading =
                window.document.querySelector('.sols-calendar-status').textContent
                === 'Loading UOW academic calendar…';
            details.onload(successfulResponse());
        }
    });
    const { blobs, dom, downloads, requests, revoked, window } = environment;

    await clickExportAndWait(window);

    assert.equal(requestObservedWhileLoading, true);
    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.equal(request.method, 'GET');
    assert.equal(request.url, keyDatesUrl);
    assert.equal(request.anonymous, true);
    assert.equal(request.timeout, 10_000);
    assert.equal(request.redirect, 'error');
    assert.deepEqual(Object.keys(request.headers), ['Accept']);
    assert.equal(request.headers.Accept, 'text/html');
    assert.equal(request.data, undefined);
    assert.equal(request.cookie, undefined);
    assert.equal(request.headers.Cookie, undefined);
    assert.equal(request.headers.Referer, undefined);
    assert.doesNotMatch(JSON.stringify(request), /CSIT101|ISIT202|25-107|3-126/);

    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].download, 'UOW_class_timetable.ics');
    assert.match(downloads[0].href, /^blob:test-/);
    assert.equal(blobs[0].type, 'text/calendar;charset=utf-8');

    const ics = getICS(blobs);
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /SUMMARY:CSIT101 Lecture/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260302T100000/);
    assert.match(ics, /SUMMARY:ISIT202 Computer Lab/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260812T143000/);
    assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);

    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'success');
    assert.match(status.textContent, /Exported 2 classes/);
    assert.doesNotMatch(status.textContent, /bundled/i);
    assert.equal(window.__uowRemoteScriptRan, undefined);
    assert.deepEqual(revoked, ['blob:test-1']);
    assert.equal(window.document.querySelector('a[download]'), null);

    dom.window.close();
});

test('uses live 2027 teaching periods', async () => {
    const { blobs, dom, window } = createEnvironment();
    window.document.querySelector('#sols-calendar-export-year').value = '2027';

    await clickExportAndWait(window);

    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270301T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270811T143000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.doesNotMatch(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled/i
    );

    dom.window.close();
});

test('accepts a future year published by UOW without a script update', async () => {
    const futurePeriods = {
        2030: {
            autumn: [
                ['Lectures Commence (weeks 1 – 7)', '04 Mar – 19 Apr 2030'],
                ['Lectures Recommence (weeks 8 – 13)', '29 Apr – 07 Jun 2030']
            ],
            spring: [
                ['Lectures Commence (weeks 1 – 9)', '29 Jul – 27 Sep 2030'],
                ['Lectures Recommence (weeks 10 – 13)', '07 Oct – 01 Nov 2030']
            ],
            annual: [
                ['Lectures Commence (weeks 1 – 7)', '04 Mar – 19 Apr 2030'],
                ['Lectures Recommence (weeks 8 – 13)', '29 Apr – 07 Jun 2030'],
                ['Lectures Recommence (weeks 14 – 22)', '29 Jul – 27 Sep 2030'],
                ['Lectures Recommence (weeks 23 – 26)', '07 Oct – 01 Nov 2030']
            ]
        }
    };
    const { blobs, dom, window } = createEnvironment({
        academicCalendarHtml: buildAcademicCalendarFixture(futurePeriods)
    });
    window.document.querySelector('#sols-calendar-export-year').value = '2030';

    await clickExportAndWait(window);

    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20300304T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20300814T143000/);
    assert.doesNotMatch(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled/i
    );

    dom.window.close();
});

test('uses Annual dates as published instead of reconstructing them from other sessions', async () => {
    const independentAnnualPeriods = structuredClone(teachingPeriods);
    independentAnnualPeriods[2026].annual = [
        ['Lectures Commence (weeks 1 – 7)', '09 Mar – 24 Apr 2026'],
        ['Lectures Recommence (weeks 8 – 13)', '04 May – 12 Jun 2026'],
        ['Lectures Recommence (weeks 14 – 22)', '03 Aug – 02 Oct 2026'],
        ['Lectures Recommence (weeks 23 – 26)', '12 Oct – 06 Nov 2026']
    ];
    const annualSolsFixture = solsFixture.replace(
        'Autumn - CSIT101',
        'Annual - CSIT101'
    );
    const { blobs, dom, window } = createEnvironment({
        academicCalendarHtml: buildAcademicCalendarFixture(independentAnnualPeriods),
        solsFixture: annualSolsFixture
    });

    await clickExportAndWait(window);

    assert.match(
        getICS(blobs),
        /DTSTART;TZID=Australia\/Sydney:20260309T100000/
    );

    dom.window.close();
});

test('ignores an incomplete unrelated year when the selected year is valid', async () => {
    const mixedPeriods = structuredClone(teachingPeriods);
    delete mixedPeriods[2027].spring;
    const { blobs, dom, window } = createEnvironment({
        academicCalendarHtml: buildAcademicCalendarFixture(mixedPeriods)
    });
    window.document.querySelector('#sols-calendar-export-year').value = '2026';

    await clickExportAndWait(window);

    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.doesNotMatch(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled/i
    );

    dom.window.close();
});

test('falls back atomically to bundled 2026 dates when the network request fails', async () => {
    const environment = createEnvironment({
        gmHandler(details) {
            details.onerror();
        }
    });
    const { blobs, dom, downloads, requests, window } = environment;

    await clickExportAndWait(window);

    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 1);
    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260302T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260812T143000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);

    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'success');
    assert.match(status.textContent, /bundled UOW dates/);

    dom.window.close();
});

test('falls back atomically to bundled 2027 dates when the network request fails', async () => {
    const environment = createEnvironment({
        gmHandler(details) {
            details.onerror();
        }
    });
    const { blobs, dom, downloads, window } = environment;
    window.document.querySelector('#sols-calendar-export-year').value = '2027';

    await clickExportAndWait(window);

    assert.equal(downloads.length, 1);
    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270301T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270811T143000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);

    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'success');
    assert.match(status.textContent, /bundled UOW dates/);

    dom.window.close();
});

test('falls back when live teaching periods fail strict validation', async () => {
    const invalidHtml = validAcademicCalendarHtml.replace(
        'Lectures Recommence (weeks 8 – 13)',
        'Lectures Recommence (weeks 9 – 13)'
    );
    const { blobs, dom, window } = createEnvironment({
        academicCalendarHtml: invalidHtml
    });

    await clickExportAndWait(window);

    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260302T100000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled UOW dates/
    );

    dom.window.close();
});

const invalidResponseCases = [
    ['status', { status: 503 }],
    ['final URL', { finalUrl: 'https://www.uow.edu.au/student/' }],
    ['content type', { responseHeaders: 'content-type: application/json\r\n' }],
    ['response size', { responseText: 'x'.repeat(1_000_001) }]
];

for (const [name, overrides] of invalidResponseCases) {
    test(`falls back when the live response has an invalid ${name}`, async () => {
        const { blobs, dom, window } = createEnvironment({
            gmHandler(details) {
                details.onload(successfulResponse(validAcademicCalendarHtml, overrides));
            }
        });

        await clickExportAndWait(window);

        assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);
        assert.match(
            window.document.querySelector('.sols-calendar-status').textContent,
            /bundled UOW dates/
        );

        dom.window.close();
    });
}

test('blocks an unknown year when neither live nor bundled dates support it', async () => {
    const { blobs, dom, downloads, errors, window } = createEnvironment();
    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    yearControl.value = '2030';

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.equal(errors.length, 1);
    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'error');
    assert.match(
        status.textContent,
        /^No verified UOW academic calendar is available for 2030: /
    );
    assert.equal(window.document.querySelector('button').disabled, false);

    dom.window.close();
});

test('does not silently export a partial calendar when a timetable week is invalid', async () => {
    const invalidSolsFixture = solsFixture.replace('Weeks: 1-13', 'Weeks: 1-14');
    const { blobs, dom, downloads, window } = createEnvironment({
        solsFixture: invalidSolsFixture
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'error');
    assert.match(status.textContent, /Invalid autumn teaching week: 14/);

    dom.window.close();
});

const timetableParserFailureCases = [
    [
        'class heading',
        (fixture) => fixture.replace('Lecture - CSIT101', 'Lecture: CSIT101'),
        /Could not read a SOLS class heading/
    ],
    [
        'class details',
        (fixture) => fixture.replace(
            'class="list-group-item-text"',
            'class="broken-list-group-item-text"'
        ),
        /Could not read class details for CSIT101/
    ],
    [
        'class time',
        (fixture) => fixture.replace('Time: Mon, 10:00 - 12:00', 'Schedule: Mon, 10:00 - 12:00'),
        /Could not read class time for CSIT101/
    ],
    [
        'teaching weeks',
        (fixture) => fixture.replace('Weeks: 1-13', 'Teaching weeks: 1-13'),
        /Could not read teaching weeks for CSIT101/
    ]
];

for (const [name, mutateFixture, expectedError] of timetableParserFailureCases) {
    test(`does not silently skip a class with malformed ${name}`, async () => {
        const { blobs, dom, downloads, window } = createEnvironment({
            solsFixture: mutateFixture(solsFixture)
        });

        await clickExportAndWait(window);

        assert.equal(blobs.length, 0);
        assert.equal(downloads.length, 0);
        const status = window.document.querySelector('.sols-calendar-status');
        assert.equal(status.dataset.state, 'error');
        assert.match(status.textContent, expectedError);

        dom.window.close();
    });
}

test('rejects an excessive teaching-week range before expanding it', async () => {
    const invalidSolsFixture = solsFixture.replace(
        'Weeks: 1-13',
        'Weeks: 1-999999999'
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        solsFixture: invalidSolsFixture
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /Invalid teaching weeks/
    );

    dom.window.close();
});

test('does not retain a fetched calendar after an export completes', async () => {
    const { dom, downloads, requests, window } = createEnvironment();

    await clickExportAndWait(window);
    await clickExportAndWait(window);

    assert.equal(requests.length, 2);
    assert.equal(downloads.length, 2);

    dom.window.close();
});

test('retries the live request after a previous export fell back', async () => {
    let attempt = 0;
    const { dom, downloads, requests, window } = createEnvironment({
        gmHandler(details) {
            attempt += 1;
            if (attempt === 1) {
                details.onerror();
            } else {
                details.onload(successfulResponse());
            }
        }
    });

    await clickExportAndWait(window);
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled UOW dates/
    );

    await clickExportAndWait(window);
    assert.doesNotMatch(
        window.document.querySelector('.sols-calendar-status').textContent,
        /bundled/i
    );
    assert.equal(requests.length, 2);
    assert.equal(downloads.length, 2);

    dom.window.close();
});

test('blocks an event whose session cannot be read instead of guessing from the month', async () => {
    const unknownSessionFixture = solsFixture.replace(
        'Autumn - CSIT101',
        'Session - CSIT101'
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        solsFixture: unknownSessionFixture
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /unknown session/i
    );

    dom.window.close();
});

test('does not match a subject code that is only a prefix of another code', async () => {
    const prefixCollisionFixture = solsFixture.replace(
        'Autumn - CSIT101',
        'Autumn - CSIT1010'
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        solsFixture: prefixCollisionFixture
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /unknown session/i
    );

    dom.window.close();
});

test('matches an exact subject code across hidden rendered element boundaries', async () => {
    const renderedBoundaryFixture = solsFixture.replace(
        'Autumn - CSIT101</td>',
        'Autumn - CSIT101<br>Lecture</td>'
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        solsFixture: renderedBoundaryFixture
    });
    const boundaryCell = window.document.querySelector(
        '#desktop-version .timetable td.lecture'
    );
    Object.defineProperty(boundaryCell, 'innerText', {
        configurable: true,
        value: boundaryCell.textContent
    });
    assert.equal(boundaryCell.innerText, 'Autumn - CSIT101Lecture');

    await clickExportAndWait(window);

    assert.equal(downloads.length, 1);
    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);

    dom.window.close();
});

test('validates time order and escapes ICS text before creating a download', async () => {
    const invalidTimeFixture = solsFixture.replace(
        '10:00 - 12:00',
        '10:00 - 09:00'
    );
    const invalidEnvironment = createEnvironment({
        solsFixture: invalidTimeFixture
    });

    await clickExportAndWait(invalidEnvironment.window);

    assert.equal(invalidEnvironment.blobs.length, 0);
    assert.match(
        invalidEnvironment.window.document.querySelector('.sols-calendar-status').textContent,
        /end time is not after/i
    );
    invalidEnvironment.dom.window.close();

    const escapedTextFixture = solsFixture
        .replace('Lecture<br>', 'Lecture, Main; A\\B<br>')
        .replace('Location: 25-107', 'Location: 25,107;North\\Wing');
    const escapedEnvironment = createEnvironment({
        solsFixture: escapedTextFixture
    });

    await clickExportAndWait(escapedEnvironment.window);

    const ics = getICS(escapedEnvironment.blobs);
    assert.equal(ics.includes('LOCATION:25\\,107\\;North\\\\Wing'), true);
    assert.equal(
        ics.includes(
            'DESCRIPTION:Lecture - CSIT101\\nLecture\\, Main\\; A\\\\B\\nWeek 1'
        ),
        true
    );
    escapedEnvironment.dom.window.close();
});
