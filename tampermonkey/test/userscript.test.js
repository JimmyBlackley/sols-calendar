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
const lateTimetableFixture =
    '<!doctype html><html><head></head><body><main id="late-root"></main></body></html>';

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

function duplicateAcademicSessionPanel(
    html,
    year,
    session,
    mutateDuplicate = () => {}
) {
    const fixtureDom = new JSDOM(html);
    const { document } = fixtureDom.window;
    const title = `${session[0].toUpperCase()}${session.slice(1)} Session ${year}`;
    const sourceAnchor = Array.from(document.querySelectorAll('a[href^="#tab-"]'))
        .find((anchor) => anchor.textContent.trim() === title);
    assert(sourceAnchor, `Missing fixture anchor for ${title}`);

    const duplicateId = `tab-fixture-duplicate-${session}-${year}`;
    const duplicateListItem = sourceAnchor.parentElement.cloneNode(true);
    duplicateListItem.querySelector('a').setAttribute('href', `#${duplicateId}`);
    sourceAnchor.parentElement.after(duplicateListItem);

    const sourcePanelId = sourceAnchor.getAttribute('href').slice(1);
    const sourcePanel = document.getElementById(sourcePanelId);
    assert(sourcePanel, `Missing fixture panel for ${title}`);
    const duplicatePanel = sourcePanel.cloneNode(true);
    duplicatePanel.id = duplicateId;
    mutateDuplicate(duplicatePanel);
    sourcePanel.after(duplicatePanel);

    const result = fixtureDom.serialize();
    fixtureDom.window.close();
    return result;
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
    const NativeDate = window.Date;
    const fixedNow = Date.UTC(options.currentYear || 2026, 6, 27, 12);
    window.Date = class TestDate extends NativeDate {
        constructor(...args) {
            if (args.length === 0) {
                super(fixedNow);
            } else {
                super(...args);
            }
        }

        static now() {
            return fixedNow;
        }
    };
    const downloads = [];
    const blobs = [];
    const revoked = [];
    const requests = [];
    const errors = [];
    const registeredListeners = new WeakMap();
    const nativeAddEventListener = window.EventTarget.prototype.addEventListener;

    window.EventTarget.prototype.addEventListener = function addEventListener(
        type,
        listener,
        listenerOptions
    ) {
        let listenersByType = registeredListeners.get(this);
        if (!listenersByType) {
            listenersByType = new Map();
            registeredListeners.set(this, listenersByType);
        }
        const listeners = listenersByType.get(type) || [];
        listeners.push(listener);
        listenersByType.set(type, listeners);
        return nativeAddEventListener.call(this, type, listener, listenerOptions);
    };
    window.__registeredTestListeners = registeredListeners;

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

function appendTimetableFixture(window) {
    const fixtureDocument = new window.DOMParser().parseFromString(
        solsFixture,
        'text/html'
    );
    const timetableContainer = fixtureDocument.querySelector('main');
    assert(timetableContainer);
    window.document.body.appendChild(
        window.document.importNode(timetableContainer, true)
    );
}

async function invokeTrustedListeners(window, element, type) {
    const listeners = window.__registeredTestListeners.get(element)?.get(type) || [];
    assert.ok(listeners.length > 0, `No ${type} listener was registered`);
    await Promise.all(listeners.map((listener) => listener.call(element, {
        currentTarget: element,
        isTrusted: true,
        target: element,
        type
    })));
}

async function clickExportAndWait(window) {
    const button = window.document.querySelector('#sols-calendar-export button');
    const status = window.document.querySelector('.sols-calendar-status');
    await invokeTrustedListeners(window, button, 'click');

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!button.disabled && status.dataset.state !== 'working') {
            return;
        }
    }

    throw new Error('Timed out waiting for the userscript export');
}

async function interactWithYearControlAndWait(window) {
    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    const button = window.document.querySelector('#sols-calendar-export button');
    const status = window.document.querySelector('.sols-calendar-status');
    await invokeTrustedListeners(window, yearControl, 'click');

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!button.disabled && status.dataset.state !== 'working') {
            return;
        }
    }

    throw new Error('Timed out waiting for the academic-year options');
}

async function waitForAcademicYearLoad(window) {
    const button = window.document.querySelector('#sols-calendar-export button');
    const status = window.document.querySelector('.sols-calendar-status');

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!button.disabled && status.dataset.state !== 'working') {
            return;
        }
    }

    throw new Error('Timed out waiting for the automatic academic-year load');
}

async function waitForLatePanelAndAcademicYearLoad(window) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        const panel = window.document.getElementById('sols-calendar-export');
        const button = panel?.querySelector('button');
        const status = panel?.querySelector('.sols-calendar-status');
        if (panel && !button.disabled && status.dataset.state !== 'working') {
            return panel;
        }
    }

    throw new Error('Timed out waiting for the late timetable panel');
}

function getICS(blobs) {
    assert.equal(blobs.length, 1);
    return blobs[0].parts.join('');
}

test('metadata keeps execution page-scoped and grants only the UOW calendar request', () => {
    assert.match(userscript, /@version\s+1\.1\.5/);
    assert.equal(packageManifest.version, '1.1.5');
    assert.equal(packageLock.version, '1.1.5');
    assert.equal(packageLock.packages[''].version, '1.1.5');
    assert.match(
        userscript,
        /@match\s+https:\/\/solss\.uow\.edu\.au\/sid\/sols_tutorial_enrolment\.my_timetable\*/
    );
    assert.match(userscript, /@grant\s+GM_xmlhttpRequest/);
    assert.match(userscript, /@connect\s+uow\.edu\.au/);
    assert.match(userscript, /@run-at\s+document-start/);
    assert.match(userscript, /@noframes/);
    assert.doesNotMatch(userscript, /@grant\s+none/);
    assert.doesNotMatch(userscript, /@require\b|@resource\b/);
    assert.doesNotMatch(
        userscript,
        /fetch\s*\(|\bXMLHttpRequest\b|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB/
    );
    assert.doesNotMatch(userscript, /BUNDLED_ACADEMIC|20\d{2}-\d{2}-\d{2}/);
});

test('injects a SOLS-style panel and automatically requests academic years once', async () => {
    const { dom, downloads, requests, window } = createEnvironment();
    const panel = window.document.getElementById('sols-calendar-export');
    const timetable = window.document.getElementById('mobile-version');

    assert(panel);
    assert(panel.classList.contains('panel'));
    assert(panel.classList.contains('panel-default'));
    assert.equal(panel.nextElementSibling, timetable);
    assert.equal(panel.querySelector('button').textContent, 'Export to ICS');
    assert.match(
        panel.querySelector('.sols-calendar-disclaimer').textContent,
        /Unofficial independent tool.*not affiliated with.*UOW/
    );

    const yearControl = panel.querySelector('#sols-calendar-export-year');
    assert.equal(yearControl.tagName, 'SELECT');
    assert.equal(yearControl.classList.contains('form-control'), true);
    assert.equal(yearControl.classList.contains('input-sm'), true);
    const actions = panel.querySelector('.sols-calendar-actions');
    const exportButton = panel.querySelector('.sols-calendar-export-button');
    const status = panel.querySelector('.sols-calendar-status');
    assert(actions);
    assert.equal(exportButton.parentElement, actions);
    assert.equal(status.parentElement, actions);
    assert.equal(window.getComputedStyle(actions).display, 'flex');
    assert.equal(window.getComputedStyle(actions).alignItems, 'center');
    assert.equal(
        window.getComputedStyle(panel.querySelector('.sols-calendar-controls')).alignItems,
        'flex-end'
    );
    assert.match(
        window.document.getElementById('sols-calendar-export-style').textContent,
        /@media\s*\(max-width:\s*600px\)[\s\S]*?\.sols-calendar-actions\s*\{[\s\S]*?align-items:\s*stretch;[\s\S]*?flex-direction:\s*column;/
    );
    assert.deepEqual(
        Array.from(yearControl.options, (option) => [option.value, option.textContent]),
        [['', 'Loading from UOW…']]
    );
    assert.equal(window.getComputedStyle(panel.querySelector('button')).marginBottom, '0px');
    assert.equal(requests.length, 1);
    assert.equal(yearControl.disabled, true);
    assert.equal(panel.querySelector('button').disabled, true);

    yearControl.focus();
    yearControl.click();
    panel.querySelector('button').click();
    await waitForAcademicYearLoad(window);
    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 0);
    assert.equal(
        panel.querySelector('.sols-calendar-status').textContent,
        'Select an academic year'
    );

    window.eval(userscript);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export').length, 1);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export-style').length, 1);
    assert.equal(requests.length, 1);

    dom.window.close();
});

test('starts one request at userscript entry before a late timetable mount', async () => {
    const { dom, requests, window } = createEnvironment({
        solsFixture: lateTimetableFixture
    });

    assert.equal(requests.length, 1);
    assert.equal(window.document.getElementById('sols-calendar-export'), null);

    delete window.document.__solsCalendarUserscriptInitialized;
    window.eval(userscript);
    assert.equal(requests.length, 1);
    assert.equal(
        Array.from(window.document.childNodes).filter(
            (node) => (
                node.nodeType === 8
                && node.data === 'sols-calendar-userscript-initialized'
            )
        ).length,
        1
    );

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(window.document.getElementById('sols-calendar-export'), null);

    appendTimetableFixture(window);
    const panel = await waitForLatePanelAndAcademicYearLoad(window);
    const yearControl = panel.querySelector('#sols-calendar-export-year');

    assert.equal(requests.length, 1);
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['2026', '2027']
    );
    assert.equal(yearControl.value, '2026');
    assert.equal(yearControl.dataset.loaded, 'true');
    assert.equal(
        panel.querySelector('.sols-calendar-status').textContent,
        'Select an academic year'
    );

    dom.window.close();
});

test('starts safely before documentElement exists at document start', async () => {
    const requests = [];
    let hadDocumentElementAtEntry = true;
    let entryError = null;
    const dom = new JSDOM(solsFixture, {
        beforeParse(window) {
            hadDocumentElementAtEntry = Boolean(window.document.documentElement);
            window.TextEncoder = TextEncoder;
            window.console.error = () => {};
            window.GM_xmlhttpRequest = (details) => {
                requests.push(details);
                window.queueMicrotask(() => {
                    details.onload(successfulResponse());
                });
                return { abort() {} };
            };
            try {
                window.eval(userscript);
            } catch (error) {
                entryError = error;
            }
        },
        runScripts: 'outside-only',
        url: 'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable'
    });

    assert.equal(hadDocumentElementAtEntry, false);
    assert.equal(entryError, null);
    assert.equal(requests.length, 1);
    await waitForLatePanelAndAcademicYearLoad(dom.window);
    assert.deepEqual(
        Array.from(
            dom.window.document.querySelector('#sols-calendar-export-year').options,
            (option) => option.value
        ),
        ['2026', '2027']
    );

    dom.window.close();
});

test('does not retry a failed entry request merely because the timetable mounts later', async () => {
    let attempts = 0;
    const { dom, requests, window } = createEnvironment({
        solsFixture: lateTimetableFixture,
        gmHandler(details) {
            attempts += 1;
            if (attempts === 1) {
                details.onerror();
            } else {
                details.onload(successfulResponse());
            }
        }
    });

    assert.equal(requests.length, 1);
    await new Promise((resolve) => setImmediate(resolve));
    appendTimetableFixture(window);

    const panel = await waitForLatePanelAndAcademicYearLoad(window);
    const yearControl = panel.querySelector('#sols-calendar-export-year');
    assert.equal(requests.length, 1);
    assert.equal(yearControl.options[0].textContent, 'Retry loading from UOW…');
    assert.equal(panel.querySelector('.sols-calendar-status').dataset.state, 'error');

    await interactWithYearControlAndWait(window);
    assert.equal(requests.length, 2);
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['2026', '2027']
    );
    assert.equal(yearControl.value, '2026');

    dom.window.close();
});

test('loads selectable years from complete standard sessions when the panel mounts', async () => {
    const noisyAcademicCalendarHtml = validAcademicCalendarHtml.replace(
        '<ul class="tabs">',
        `<p>First enrolment date: 24 Nov 2025</p>
         <ul class="tabs">
             <li><a href="#tab-summer-2027">Summer Session 2027/2028</a></li>
         `
    );
    const { dom, downloads, requests, window } = createEnvironment({
        academicCalendarHtml: noisyAcademicCalendarHtml
    });

    assert.equal(requests.length, 1);
    await waitForAcademicYearLoad(window);

    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 0);
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['2026', '2027']
    );
    assert.equal(yearControl.value, '2026');
    assert.equal(yearControl.dataset.loaded, 'true');
    assert.equal(
        window.document.querySelector('.sols-calendar-status').textContent,
        'Select an academic year'
    );

    dom.window.close();
});

test('defaults to the earliest future year when the current year is unavailable', async () => {
    const { dom, window } = createEnvironment({ currentYear: 2025 });

    await waitForAcademicYearLoad(window);

    assert.equal(
        window.document.querySelector('#sols-calendar-export-year').value,
        '2026'
    );
    dom.window.close();
});

test('lists only-past years without selecting one and exports an explicitly selected past year', async () => {
    const { blobs, dom, downloads, window } = createEnvironment({ currentYear: 2031 });

    await waitForAcademicYearLoad(window);

    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    assert.deepEqual(
        Array.from(yearControl.options, (option) => [option.value, option.textContent]),
        [
            ['', 'Select a past academic year…'],
            ['2026', '2026'],
            ['2027', '2027']
        ]
    );
    assert.equal(yearControl.value, '');
    assert.equal(yearControl.options[0].disabled, true);
    assert.equal(downloads.length, 0);

    yearControl.value = '2027';
    await clickExportAndWait(window);

    assert.equal(downloads.length, 1);
    assert.match(getICS(blobs), /DTSTART;TZID=Australia\/Sydney:20270301T100000/);

    dom.window.close();
});

test('reuses the automatic in-flight request when Export is clicked', async () => {
    let requestObservedWhileLoading = false;
    let completeRequest;
    const environment = createEnvironment({
        gmHandler(details, window) {
            requestObservedWhileLoading =
                window.document.querySelector('.sols-calendar-status').textContent
                === 'Loading UOW academic calendar…';
            completeRequest = () => details.onload(successfulResponse());
        }
    });
    const { blobs, dom, downloads, requests, revoked, window } = environment;

    assert.equal(requests.length, 1);
    const exportPromise = clickExportAndWait(window);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(requestObservedWhileLoading, true);
    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 0);
    completeRequest();
    await exportPromise;

    const request = requests[0];
    assert.equal(request.method, 'GET');
    assert.equal(request.url, keyDatesUrl);
    assert.equal(request.anonymous, true);
    assert.equal(request.nocache, true);
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
    assert.equal(window.__uowRemoteScriptRan, undefined);
    assert.deepEqual(revoked, ['blob:test-1']);
    assert.equal(window.document.querySelector('a[download]'), null);

    dom.window.close();
});

test('uses live 2027 teaching periods', async () => {
    const { blobs, dom, window } = createEnvironment();
    await waitForAcademicYearLoad(window);
    window.document.querySelector('#sols-calendar-export-year').value = '2027';

    await clickExportAndWait(window);

    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270301T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270811T143000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);

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

    await clickExportAndWait(window);

    assert.equal(
        window.document.querySelector('#sols-calendar-export-year').value,
        '2030'
    );
    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20300304T100000/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20300814T143000/);

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

    await clickExportAndWait(window);

    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.deepEqual(
        Array.from(
            window.document.querySelector('#sols-calendar-export-year').options,
            (option) => option.value
        ),
        ['2026']
    );

    dom.window.close();
});

test('tolerates identical duplicate session anchors and panels', async () => {
    const duplicateHtml = duplicateAcademicSessionPanel(
        validAcademicCalendarHtml,
        2026,
        'autumn',
        (panel) => {
            const body = panel.querySelector('tbody');
            const rows = Array.from(body.children).reverse();
            body.append(...rows);
        }
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: duplicateHtml
    });

    await clickExportAndWait(window);

    assert.equal(downloads.length, 1);
    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.deepEqual(
        Array.from(
            window.document.querySelector('#sols-calendar-export-year').options,
            (option) => option.value
        ),
        ['2026', '2027']
    );

    dom.window.close();
});

test('rejects month names that only begin with a valid abbreviation', async () => {
    const invalidHtml = validAcademicCalendarHtml.replaceAll(' Mar', ' Marzipan');
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: invalidHtml
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'error');
    assert.match(status.textContent, /no complete academic calendar/i);

    dom.window.close();
});

test('isolates a year with conflicting duplicate session panels', async () => {
    const conflictingHtml = duplicateAcademicSessionPanel(
        validAcademicCalendarHtml,
        2026,
        'autumn',
        (panel) => {
            panel.querySelector('tbody tr td:nth-child(2)').textContent =
                '09 Mar – 24 Apr 2026';
        }
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: conflictingHtml
    });

    await clickExportAndWait(window);

    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['2027']
    );
    assert.equal(yearControl.value, '2027');
    assert.equal(downloads.length, 1);
    assert.match(getICS(blobs), /DTSTART;TZID=Australia\/Sydney:20270301T100000/);

    dom.window.close();
});

test('accepts singular or plural week labels with ordinary spacing variation', async () => {
    let activityIndex = 0;
    const spacingVariantHtml = validAcademicCalendarHtml.replace(
        /Lectures (Commence|Recommence) \(weeks (\d+) – (\d+)\)/g,
        (_match, action, startWeek, endWeek) => {
            const weekLabel = activityIndex % 2 === 0 ? 'week' : 'weeks';
            activityIndex += 1;
            return `Lectures ${action} (   ${weekLabel}   ${startWeek} – ${endWeek}   )`;
        }
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: spacingVariantHtml
    });

    await clickExportAndWait(window);

    assert.equal(downloads.length, 1);
    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);

    dom.window.close();
});

test('does not cache an automatic failure and succeeds on trusted Export retry', async () => {
    let attempt = 0;
    const environment = createEnvironment({
        gmHandler(details) {
            attempt += 1;
            if (attempt === 1) {
                details.onerror();
            } else {
                details.onload(successfulResponse());
            }
        }
    });
    const { blobs, dom, downloads, requests, window } = environment;

    await waitForAcademicYearLoad(window);

    assert.equal(requests.length, 1);
    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.equal(
        window.document.querySelector('.sols-calendar-status').dataset.state,
        'error'
    );

    await clickExportAndWait(window);

    assert.equal(requests.length, 2);
    assert.equal(downloads.length, 1);
    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.equal(
        window.document.querySelector('.sols-calendar-status').dataset.state,
        'success'
    );

    dom.window.close();
});

test('does not loop after automatic failure or retry from synthetic page events', async () => {
    const { blobs, dom, downloads, requests, window } = createEnvironment({
        gmHandler(details) {
            details.onerror();
        }
    });

    await waitForAcademicYearLoad(window);
    const panel = window.document.getElementById('sols-calendar-export');
    const yearControl = panel.querySelector('#sols-calendar-export-year');
    const button = panel.querySelector('button');

    assert.equal(requests.length, 1);
    assert.equal(yearControl.options[0].textContent, 'Retry loading from UOW…');
    assert.equal(panel.querySelector('.sols-calendar-status').dataset.state, 'error');

    await new Promise((resolve) => setImmediate(resolve));
    yearControl.focus();
    yearControl.click();
    button.click();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(requests.length, 1);
    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);

    dom.window.close();
});

test('excludes a year whose live teaching periods fail strict validation', async () => {
    const invalidHtml = validAcademicCalendarHtml.replace(
        'Lectures Recommence (weeks 8 – 13)',
        'Lectures Recommence (weeks 9 – 13)'
    );
    const { blobs, dom, window } = createEnvironment({
        academicCalendarHtml: invalidHtml
    });

    await clickExportAndWait(window);

    const ics = getICS(blobs);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270301T100000/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);
    assert.deepEqual(
        Array.from(
            window.document.querySelector('#sols-calendar-export-year').options,
            (option) => option.value
        ),
        ['2027']
    );

    dom.window.close();
});

test('blocks export when no live year has a complete valid calendar', async () => {
    const invalidHtml = validAcademicCalendarHtml.replaceAll(
        'Lectures Recommence (weeks 8 – 13)',
        'Lectures Recommence (weeks 9 – 13)'
    );
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: invalidHtml
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.equal(
        window.document.querySelector('.sols-calendar-status').dataset.state,
        'error'
    );
    assert.match(
        window.document.querySelector('.sols-calendar-status').textContent,
        /no complete academic calendar/i
    );

    dom.window.close();
});

test('fails closed when UOW returns more than sixteen candidate academic years', async () => {
    const excessivePeriods = {};
    for (let year = 2020; year <= 2036; year += 1) {
        excessivePeriods[year] = structuredClone(teachingPeriods[2026]);
    }
    const { blobs, dom, downloads, window } = createEnvironment({
        academicCalendarHtml: buildAcademicCalendarFixture(excessivePeriods)
    });

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['']
    );
    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'error');
    assert.match(status.textContent, /too many academic years/i);

    dom.window.close();
});

const invalidResponseCases = [
    ['status', { status: 503 }],
    ['final URL', { finalUrl: 'https://www.uow.edu.au/student/' }],
    ['content type', { responseHeaders: 'content-type: application/json\r\n' }],
    ['response size', { responseText: 'x'.repeat(1_000_001) }]
];

for (const [name, overrides] of invalidResponseCases) {
    test(`blocks export when the live response has an invalid ${name}`, async () => {
        const { blobs, dom, downloads, window } = createEnvironment({
            gmHandler(details) {
                details.onload(successfulResponse(validAcademicCalendarHtml, overrides));
            }
        });

        await clickExportAndWait(window);

        assert.equal(blobs.length, 0);
        assert.equal(downloads.length, 0);
        assert.equal(
            window.document.querySelector('.sols-calendar-status').dataset.state,
            'error'
        );

        dom.window.close();
    });
}

test('blocks a year that was not exposed by the validated UOW options', async () => {
    const { blobs, dom, downloads, errors, window } = createEnvironment();
    const yearControl = window.document.querySelector('#sols-calendar-export-year');
    await waitForAcademicYearLoad(window);
    yearControl.appendChild(new window.Option('2030', '2030'));
    yearControl.value = '2030';

    await clickExportAndWait(window);

    assert.equal(blobs.length, 0);
    assert.equal(downloads.length, 0);
    assert.equal(errors.length, 1);
    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'error');
    assert.match(
        status.textContent,
        /Select an academic year published by UOW/
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

test('reuses one successful page-memory result for control use and repeated exports', async () => {
    const { dom, downloads, requests, window } = createEnvironment();
    const yearControl = window.document.querySelector('#sols-calendar-export-year');

    await waitForAcademicYearLoad(window);
    await invokeTrustedListeners(window, yearControl, 'click');
    await clickExportAndWait(window);
    await clickExportAndWait(window);

    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 2);

    dom.window.close();
});

test('retries a failed automatic load from a trusted year-control interaction', async () => {
    let attempt = 0;
    const { blobs, dom, downloads, requests, window } = createEnvironment({
        gmHandler(details) {
            attempt += 1;
            if (attempt === 1) {
                details.onerror();
            } else {
                details.onload(successfulResponse());
            }
        }
    });

    await waitForAcademicYearLoad(window);
    assert.equal(requests.length, 1);
    assert.equal(downloads.length, 0);
    assert.equal(blobs.length, 0);
    assert.equal(
        window.document.querySelector('.sols-calendar-status').dataset.state,
        'error'
    );

    await interactWithYearControlAndWait(window);
    assert.equal(requests.length, 2);
    assert.equal(downloads.length, 0);
    assert.deepEqual(
        Array.from(
            window.document.querySelector('#sols-calendar-export-year').options,
            (option) => option.value
        ),
        ['2026', '2027']
    );

    await clickExportAndWait(window);
    assert.equal(requests.length, 2);
    assert.equal(downloads.length, 1);
    assert.equal((getICS(blobs).match(/BEGIN:VEVENT/g) || []).length, 19);

    dom.window.close();
});

test('treats pointerdown and click from one control interaction as one retry', async () => {
    let attempt = 0;
    const { dom, requests, window } = createEnvironment({
        gmHandler(details) {
            attempt += 1;
            if (attempt < 3) {
                details.onerror();
            } else {
                details.onload(successfulResponse());
            }
        }
    });

    await waitForAcademicYearLoad(window);
    const yearControl = window.document.querySelector(
        '#sols-calendar-export-year'
    );

    await invokeTrustedListeners(window, yearControl, 'pointerdown');
    assert.equal(requests.length, 2);
    assert.equal(
        window.document.querySelector('.sols-calendar-status').dataset.state,
        'error'
    );

    await invokeTrustedListeners(window, yearControl, 'click');
    assert.equal(requests.length, 2);

    await invokeTrustedListeners(window, yearControl, 'click');
    assert.equal(requests.length, 3);
    assert.deepEqual(
        Array.from(yearControl.options, (option) => option.value),
        ['2026', '2027']
    );
    assert.equal(yearControl.value, '2026');

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
