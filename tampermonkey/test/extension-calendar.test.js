const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const chromiumCalendarPath = path.join(repositoryRoot, 'chromium', 'calendar.js');
const keyDatesUrl = 'https://www.uow.edu.au/student/dates/';
const timetableUrl =
    'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable';
const nativeTimetableFixture = fs.readFileSync(
    path.join(repositoryRoot, 'tampermonkey', 'test', 'fixture.html'),
    'utf8'
);
const extensionCalendarPaths = [
    chromiumCalendarPath,
    path.join(repositoryRoot, 'firefox', 'calendar.js'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'calendar.js'
    )
];
const extensionContentPaths = [
    path.join(repositoryRoot, 'chromium', 'content.js'),
    path.join(repositoryRoot, 'firefox', 'content.js'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'content.js'
    )
];
const extensionBackgroundPaths = [
    path.join(repositoryRoot, 'chromium', 'background.js'),
    path.join(repositoryRoot, 'firefox', 'background.js'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'background.js'
    )
];
const extensionManifestPaths = [
    path.join(repositoryRoot, 'chromium', 'manifest.json'),
    path.join(repositoryRoot, 'firefox', 'manifest.json'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'manifest.json'
    )
];
const extensionPopupPaths = [
    path.join(repositoryRoot, 'chromium', 'popup.html'),
    path.join(repositoryRoot, 'firefox', 'popup.html'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'popup.html'
    )
];
const extensionPopupScriptPaths = [
    path.join(repositoryRoot, 'chromium', 'popup.js'),
    path.join(repositoryRoot, 'firefox', 'popup.js'),
    path.join(
        repositoryRoot,
        'safari',
        'SOLS Calendar',
        'SOLS Calendar Extension',
        'Resources',
        'popup.js'
    )
];
const nativeExtensionProductionPaths = [
    ...extensionCalendarPaths,
    ...extensionContentPaths,
    ...extensionBackgroundPaths,
    ...extensionManifestPaths,
    ...extensionPopupPaths,
    ...extensionPopupScriptPaths
];

const SESSION_ROWS = {
    2026: {
        autumn: [
            [1, 7, '02 Mar', '17 Apr 2026'],
            [8, 13, '27 Apr', '05 Jun 2026']
        ],
        spring: [
            [1, 9, '27 Jul', '25 Sep 2026'],
            [10, 13, '05 Oct', '30 Oct 2026']
        ],
        annual: [
            [1, 7, '02 Mar', '17 Apr 2026'],
            [8, 13, '27 Apr', '05 Jun 2026'],
            [14, 22, '27 Jul', '25 Sep 2026'],
            [23, 26, '05 Oct', '30 Oct 2026']
        ]
    },
    2027: {
        autumn: [
            [1, 7, '01 Mar', '16 Apr 2027'],
            [8, 13, '26 Apr', '04 Jun 2027']
        ],
        spring: [
            [1, 9, '26 Jul', '24 Sep 2027'],
            [10, 13, '04 Oct', '29 Oct 2027']
        ],
        annual: [
            [1, 7, '01 Mar', '16 Apr 2027'],
            [8, 13, '26 Apr', '04 Jun 2027'],
            [14, 22, '26 Jul', '24 Sep 2027'],
            [23, 26, '04 Oct', '29 Oct 2027']
        ]
    }
};

function titleCase(value) {
    return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildSessionPanel(year, session, rows, id) {
    const tableRows = rows.map(([from, to, start, end], index) => `
        <tr>
            <td>
                Lectures ${index === 0 ? 'Commence' : 'Recommence'}
                (weeks ${from} &ndash; ${to})
            </td>
            <td>${start} &ndash; ${end}</td>
        </tr>
    `).join('');

    return {
        anchor: `<a href="#${id}">${titleCase(session)} Session ${year}</a>`,
        panel: `<div class="tabs-panel" id="${id}"><table>${tableRows}</table></div>`
    };
}

function buildUowCalendarHtml(options = {}) {
    const {
        idToken = 'cms-375457',
        omit = [],
        rowOverrides = {},
        includeBrokenSummer = true
    } = options;
    const anchors = [];
    const panels = [];

    for (const [yearText, sessions] of Object.entries(SESSION_ROWS)) {
        const year = Number(yearText);
        for (const [session, defaultRows] of Object.entries(sessions)) {
            const key = `${year}-${session}`;
            if (omit.includes(key)) {
                continue;
            }

            const id = `tab-${idToken}-${year}-${session}`;
            const entry = buildSessionPanel(
                year,
                session,
                rowOverrides[key] || defaultRows,
                id
            );
            anchors.push(entry.anchor);
            panels.push(entry.panel);
        }
    }

    if (includeBrokenSummer) {
        const summerId = `tab-${idToken}-2026-summer`;
        anchors.push(`<a href="#${summerId}">Summer Session 2026/2027</a>`);
        panels.push(`
            <div class="tabs-panel" id="${summerId}">
                <table>
                    <tr>
                        <td>Lectures Commence (weeks 1 &ndash; 3)</td>
                        <td>30 Nov &ndash; 18 Dec 2026</td>
                    </tr>
                    <tr>
                        <td>Mid-Session Recess (2 weeks)</td>
                        <td>21 Dec &ndash; 01 Jan 2026</td>
                    </tr>
                    <tr>
                        <td>Lectures Recommence (weeks 4 &ndash; 7)</td>
                        <td>04 Jan &ndash; 29 Jan 2027</td>
                    </tr>
                </table>
            </div>
        `);
    }

    return `<!doctype html>
        <html>
            <head>
                <meta name="edit.date" content="2026-07-09">
            </head>
            <body>
                <nav>${anchors.join('')}</nav>
                <main>${panels.join('')}</main>
            </body>
        </html>`;
}

function loadCalendarApi() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const context = vm.createContext({
        AbortController,
        DOMParser: dom.window.DOMParser,
        Date,
        Math,
        TextEncoder,
        clearTimeout,
        console,
        document: dom.window.document,
        fetch: async () => {
            throw new Error('Unexpected network access from a unit test');
        },
        setTimeout
    });

    vm.runInContext(fs.readFileSync(chromiumCalendarPath, 'utf8'), context, {
        filename: chromiumCalendarPath
    });

    const api = {};
    for (const name of [
        'chooseDefaultAcademicYear',
        'fetchAcademicCalendar',
        'fetchAcademicCalendarSource',
        'foldLine',
        'generateICS',
        'getAvailableAcademicYears',
        'parseAcademicCalendarHtml',
        'weekToISODate'
    ]) {
        api[name] = vm.runInContext(name, context);
    }
    api.close = () => dom.window.close();
    return api;
}

function loadPopup(index, options = {}) {
    const dom = new JSDOM(fs.readFileSync(extensionPopupPaths[index], 'utf8'), {
        runScripts: 'outside-only',
        url: `https://extension-${index}.invalid/popup.html`
    });
    const { window } = dom;
    const downloads = [];
    const errors = [];
    const requests = [];
    const sentMessages = [];
    const revokedUrls = [];
    const originalSetTimeout = window.setTimeout.bind(window);

    window.AbortController = AbortController;
    window.AbortSignal = AbortSignal;
    window.TextEncoder = TextEncoder;
    if (Number.isInteger(options.currentYear)) {
        const NativeDate = window.Date;
        const fixedNow = NativeDate.UTC(options.currentYear, 0, 1, 12);
        window.Date = class FixedDate extends NativeDate {
            constructor(...args) {
                super(...(args.length > 0 ? args : [fixedNow]));
            }

            static now() {
                return fixedNow;
            }
        };
    }
    window.URL.createObjectURL = () => `blob:test-${downloads.length + 1}`;
    window.URL.revokeObjectURL = (url) => revokedUrls.push(url);
    window.HTMLAnchorElement.prototype.click = function click() {
        downloads.push({
            filename: this.download,
            url: this.href
        });
    };
    window.setTimeout = (callback, delay, ...args) => {
        if (delay === 60_000) {
            callback(...args);
            return 0;
        }
        return originalSetTimeout(callback, delay, ...args);
    };
    window.console.error = (...args) => errors.push(args);
    window.fetch = async (url, requestOptions) => {
        requests.push({ url, options: requestOptions });
        throw new Error('The popup must reuse the content-script calendar');
    };

    window.eval(fs.readFileSync(extensionCalendarPaths[index], 'utf8'));
    const parseAcademicCalendar = window.eval('parseAcademicCalendarHtml');
    const contentCalendar = parseAcademicCalendar(
        options.academicCalendarHtml || buildUowCalendarHtml(),
        keyDatesUrl
    );

    const tabs = {
        async query() {
            return [{
                id: 42,
                url: options.tabUrl || timetableUrl
            }];
        },
        async sendMessage(tabId, message) {
            sentMessages.push({ tabId, message });
            if (message?.action === 'getAcademicCalendar') {
                const calendarError = options.calendarError || options.fetchError;
                if (calendarError) {
                    return { error: calendarError.message };
                }
                return options.academicCalendarResponse || {
                    calendar: contentCalendar
                };
            }
            if (message?.action !== 'parseTimetable') {
                throw new Error(`Unexpected popup message: ${message?.action}`);
            }
            return options.timetableResponse || {
                events: [timetableEvent({
                    session: 'Autumn',
                    weeks: '1'
                })]
            };
        }
    };

    if (index === 1) {
        window.browser = { tabs };
    } else {
        window.chrome = {
            tabs,
            downloads: {
                async download(downloadOptions) {
                    downloads.push({
                        filename: downloadOptions.filename,
                        url: downloadOptions.url
                    });
                    return 1;
                }
            }
        };
    }

    window.eval(fs.readFileSync(extensionPopupScriptPaths[index], 'utf8'));

    return {
        dom,
        downloads,
        errors,
        requests,
        revokedUrls,
        sentMessages,
        window
    };
}

async function waitForPopupInitialization(environment) {
    const status = environment.window.document.getElementById('status');

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!status.textContent.includes('Loading available academic years')) {
            return;
        }
    }

    throw new Error('Timed out waiting for popup academic-year initialization');
}

async function clickPopupExportAndWait(environment) {
    const button = environment.window.document.getElementById('exportBtn');
    const status = environment.window.document.getElementById('status');
    button.click();

    for (let attempt = 0; attempt < 50; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        if (!button.disabled && !status.textContent.includes('Reading timetable')) {
            return;
        }
    }

    throw new Error('Timed out waiting for popup export');
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function academicCalendarSource(html = buildUowCalendarHtml()) {
    return {
        source: {
            html,
            url: keyDatesUrl
        }
    };
}

function loadContentScript(
    contentPath,
    html = nativeTimetableFixture,
    options = {}
) {
    const index = extensionContentPaths.indexOf(contentPath);
    assert.notEqual(index, -1, `Unknown content script: ${contentPath}`);
    const dom = new JSDOM(html, {
        runScripts: 'outside-only',
        url: timetableUrl
    });
    const listeners = [];
    const errors = [];
    const runtimeMessages = [];
    const runtime = {
        onMessage: {
            addListener(listener) {
                listeners.push(listener);
            }
        },
        sendMessage(message) {
            runtimeMessages.push(message);
            try {
                const response = options.sourceHandler
                    ? options.sourceHandler(message, runtimeMessages.length)
                    : academicCalendarSource(options.academicCalendarHtml);
                return Promise.resolve(response);
            } catch (error) {
                return Promise.reject(error);
            }
        }
    };

    dom.window.console.error = (...args) => errors.push(args);
    if (index === 1) {
        dom.window.browser = { runtime };
    } else {
        dom.window.chrome = { runtime };
    }

    dom.window.eval([
        fs.readFileSync(extensionCalendarPaths[index], 'utf8'),
        fs.readFileSync(contentPath, 'utf8')
    ].join('\n'));
    assert.equal(listeners.length, 1, `${contentPath} did not register one listener`);
    return {
        dom,
        errors,
        listener: listeners[0],
        runtimeMessages
    };
}

async function requestContentMessage(environment, action) {
    let callbackCalled = false;
    let callbackResponse;
    let resolveAsyncResponse;
    const asyncResponse = new Promise((resolve) => {
        resolveAsyncResponse = resolve;
    });
    const listenerResult = environment.listener(
        { action },
        {},
        (value) => {
            callbackCalled = true;
            callbackResponse = value;
            resolveAsyncResponse(value);
        }
    );

    if (callbackCalled) {
        return callbackResponse;
    }
    if (listenerResult === true) {
        return asyncResponse;
    }
    return undefined;
}

async function requestParsedTimetable(contentPath, environment) {
    assert.ok(extensionContentPaths.includes(contentPath));
    return requestContentMessage(environment, 'parseTimetable');
}

function successfulExtensionResponse(overrides = {}) {
    return {
        status: 200,
        ok: true,
        url: keyDatesUrl,
        headers: {
            get(name) {
                return name.toLowerCase() === 'content-type'
                    ? 'text/html; charset=UTF-8'
                    : null;
            }
        },
        text: async () => buildUowCalendarHtml(),
        ...overrides
    };
}

function loadBackground(index, options = {}) {
    const backgroundPath = extensionBackgroundPaths[index];
    const calendarPath = extensionCalendarPaths[index];
    const listeners = [];
    const requests = [];
    const importedScripts = [];
    const errors = [];
    const runtime = {
        onMessage: {
            addListener(listener) {
                listeners.push(listener);
            }
        }
    };
    const context = vm.createContext({
        AbortController,
        AbortSignal,
        Date,
        Math,
        TextEncoder,
        URL,
        clearTimeout,
        console: {
            error: (...args) => errors.push(args)
        },
        fetch: async (url, requestOptions) => {
            requests.push({ options: requestOptions, url });
            if (options.fetchHandler) {
                return options.fetchHandler(url, requestOptions, requests.length);
            }
            return successfulExtensionResponse();
        },
        setTimeout
    });

    const loadCalendarRuntime = () => {
        vm.runInContext(fs.readFileSync(calendarPath, 'utf8'), context, {
            filename: calendarPath
        });
    };
    context.importScripts = (...scriptPaths) => {
        for (const scriptPath of scriptPaths) {
            importedScripts.push(scriptPath);
            assert.equal(scriptPath, 'calendar.js');
            loadCalendarRuntime();
        }
    };

    if (index === 1) {
        context.browser = { runtime };
        loadCalendarRuntime();
    } else {
        context.chrome = { runtime };
    }

    vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), context, {
        filename: backgroundPath
    });
    assert.equal(listeners.length, 1, `${backgroundPath} did not register one listener`);

    return {
        context,
        errors,
        importedScripts,
        listener: listeners[0],
        requests
    };
}

async function requestBackground(
    environment,
    request = { action: 'loadAcademicCalendarSource' },
    sender = { url: timetableUrl }
) {
    let resolveResponse;
    const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve;
    });
    const listenerResult = environment.listener(request, sender, resolveResponse);
    return {
        listenerResult,
        response: await responsePromise
    };
}

function parseCalendar(api, html = buildUowCalendarHtml()) {
    return api.parseAcademicCalendarHtml(
        html,
        keyDatesUrl
    );
}

function timetableEvent(overrides = {}) {
    return {
        type: 'Lecture',
        subjectCode: 'TEST101',
        activityType: 'Lecture',
        activityDetail: 'Lecture',
        day: 'Mon',
        startTime: '09:00',
        endTime: '10:00',
        location: '25-107',
        weeks: '1',
        session: 'Autumn',
        ...overrides
    };
}

test('parses 2026 and 2027 Autumn, Spring, and Annual boundary weeks', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api);
        const cases = [
            [2026, 'Autumn', 1, '2026-03-02'],
            [2026, 'Autumn', 7, '2026-04-13'],
            [2026, 'Autumn', 8, '2026-04-27'],
            [2026, 'Autumn', 13, '2026-06-01'],
            [2026, 'Spring', 1, '2026-07-27'],
            [2026, 'Spring', 9, '2026-09-21'],
            [2026, 'Spring', 10, '2026-10-05'],
            [2026, 'Spring', 13, '2026-10-26'],
            [2026, 'Annual', 1, '2026-03-02'],
            [2026, 'Annual', 13, '2026-06-01'],
            [2026, 'Annual', 14, '2026-07-27'],
            [2026, 'Annual', 22, '2026-09-21'],
            [2026, 'Annual', 23, '2026-10-05'],
            [2026, 'Annual', 26, '2026-10-26'],
            [2027, 'Autumn', 1, '2027-03-01'],
            [2027, 'Autumn', 7, '2027-04-12'],
            [2027, 'Autumn', 8, '2027-04-26'],
            [2027, 'Autumn', 13, '2027-05-31'],
            [2027, 'Spring', 1, '2027-07-26'],
            [2027, 'Spring', 9, '2027-09-20'],
            [2027, 'Spring', 10, '2027-10-04'],
            [2027, 'Spring', 13, '2027-10-25'],
            [2027, 'Annual', 1, '2027-03-01'],
            [2027, 'Annual', 13, '2027-05-31'],
            [2027, 'Annual', 14, '2027-07-26'],
            [2027, 'Annual', 22, '2027-09-20'],
            [2027, 'Annual', 23, '2027-10-04'],
            [2027, 'Annual', 26, '2027-10-25']
        ];

        for (const [year, session, week, expected] of cases) {
            assert.equal(
                api.weekToISODate(session, week, year, calendar),
                expected,
                `${session} ${year} week ${week}`
            );
        }
    } finally {
        api.close();
    }
});

test('follows changing CMS tab ids instead of hard-coding numeric ids', () => {
    const api = loadCalendarApi();
    try {
        const first = parseCalendar(api, buildUowCalendarHtml({
            idToken: 'cms-111111'
        }));
        const second = parseCalendar(api, buildUowCalendarHtml({
            idToken: 'cms-987654'
        }));

        assert.deepEqual(
            JSON.parse(JSON.stringify(first.years)),
            JSON.parse(JSON.stringify(second.years))
        );
    } finally {
        api.close();
    }
});

test('tolerates identical duplicate standard-session anchors and panels', () => {
    const api = loadCalendarApi();
    const duplicate = buildSessionPanel(
        2026,
        'autumn',
        [...SESSION_ROWS[2026].autumn].reverse(),
        'tab-duplicate-2026-autumn'
    );
    const html = buildUowCalendarHtml()
        .replace('</nav>', `${duplicate.anchor}</nav>`)
        .replace('</main>', `${duplicate.panel}</main>`);

    try {
        const calendar = parseCalendar(api, html);
        assert.deepEqual(Object.keys(calendar.years), ['2026', '2027']);
        assert.equal(
            api.weekToISODate('Autumn', 8, 2026, calendar),
            '2026-04-27'
        );
    } finally {
        api.close();
    }
});

test('rejects month names that only begin with a valid abbreviation', () => {
    const api = loadCalendarApi();
    const html = buildUowCalendarHtml().replaceAll(' Mar', ' Marzipan');

    try {
        assert.throws(
            () => parseCalendar(api, html),
            /No complete UOW session calendars were found/
        );
    } finally {
        api.close();
    }
});

test('conflicting duplicate session panels invalidate only their academic year', () => {
    const api = loadCalendarApi();
    const conflicting = buildSessionPanel(
        2026,
        'autumn',
        [
            [1, 7, '09 Mar', '24 Apr 2026'],
            [8, 13, '04 May', '12 Jun 2026']
        ],
        'tab-conflicting-2026-autumn'
    );
    const html = buildUowCalendarHtml()
        .replace('</nav>', `${conflicting.anchor}</nav>`)
        .replace('</main>', `${conflicting.panel}</main>`);

    try {
        assert.deepEqual(Object.keys(parseCalendar(api, html).years), ['2027']);
        assert.throws(
            () => api.parseAcademicCalendarHtml(
                html,
                'https://www.uow.edu.au/student/dates/',
                2026
            ),
            /Conflicting UOW session tables for Autumn Session 2026/
        );
    } finally {
        api.close();
    }
});

test('accepts canonical singular or plural week labels with surrounding whitespace', () => {
    const api = loadCalendarApi();
    const html = buildUowCalendarHtml()
        .replace(
            /\(weeks 1 &ndash; 7\)/g,
            '(   week   1 &ndash; 7   )'
        )
        .replace(
            /\(weeks 8 &ndash; 13\)/g,
            '(  weeks   8 &ndash; 13  )'
        );

    try {
        const calendar = parseCalendar(api, html);
        assert.equal(
            api.weekToISODate('Autumn', 1, 2026, calendar),
            '2026-03-02'
        );
        assert.equal(
            api.weekToISODate('Autumn', 13, 2027, calendar),
            '2027-05-31'
        );
    } finally {
        api.close();
    }
});

test('rejects more than sixteen academic-year candidates without partial output', () => {
    const api = loadCalendarApi();
    const extraYearAnchors = Array.from({ length: 15 }, (_, index) => {
        const year = 2030 + index;
        return `<a href="#tab-candidate-${year}">Autumn Session ${year}</a>`;
    }).join('');
    const html = buildUowCalendarHtml().replace(
        '</nav>',
        `${extraYearAnchors}</nav>`
    );

    try {
        assert.throws(
            () => parseCalendar(api, html),
            /too many academic years/i
        );
    } finally {
        api.close();
    }
});

test('ignores an unrelated broken Summer range without contaminating standard sessions', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api, buildUowCalendarHtml({
            includeBrokenSummer: true
        }));

        assert.equal(
            api.weekToISODate('Annual', 14, 2026, calendar),
            '2026-07-27'
        );
        assert.equal(calendar.years[2026].summer, undefined);
    } finally {
        api.close();
    }
});

test('isolates validation to the requested year at runtime', () => {
    const api = loadCalendarApi();
    const html = buildUowCalendarHtml({
        omit: ['2027-spring']
    });

    try {
        const calendar = api.parseAcademicCalendarHtml(
            html,
            'https://www.uow.edu.au/student/dates/',
            2026
        );
        assert.equal(
            api.weekToISODate('Autumn', 1, 2026, calendar),
            '2026-03-02'
        );
        assert.equal(calendar.years[2027], undefined);

        assert.throws(
            () => api.parseAcademicCalendarHtml(
                html,
                'https://www.uow.edu.au/student/dates/',
                2027
            ),
            /missing spring 2027/i
        );
    } finally {
        api.close();
    }
});

test('keeps Annual session dates independent from Autumn and Spring', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api, buildUowCalendarHtml({
            rowOverrides: {
                '2026-annual': [
                    [1, 7, '09 Mar', '24 Apr 2026'],
                    [8, 13, '04 May', '12 Jun 2026'],
                    [14, 22, '03 Aug', '02 Oct 2026'],
                    [23, 26, '12 Oct', '06 Nov 2026']
                ]
            }
        }));

        assert.equal(
            api.weekToISODate('Annual', 1, 2026, calendar),
            '2026-03-09'
        );
        assert.equal(
            api.weekToISODate('Annual', 14, 2026, calendar),
            '2026-08-03'
        );
        assert.equal(
            api.weekToISODate('Autumn', 1, 2026, calendar),
            '2026-03-02'
        );
    } finally {
        api.close();
    }
});

test('isolates invalid teaching spans and missing sessions by academic year', () => {
    const api = loadCalendarApi();
    try {
        const invalidSpanHtml = buildUowCalendarHtml({
            rowOverrides: {
                '2026-autumn': [
                    [1, 7, '02 Mar', '16 Apr 2026'],
                    [8, 13, '27 Apr', '05 Jun 2026']
                ]
            }
        });
        assert.throws(
            () => api.parseAcademicCalendarHtml(
                invalidSpanHtml,
                'https://www.uow.edu.au/student/dates/',
                2026
            ),
            /Monday-to-Friday|span mismatch/i
        );
        assert.deepEqual(
            Object.keys(parseCalendar(api, invalidSpanHtml).years),
            ['2027']
        );

        const missingSessionHtml = buildUowCalendarHtml({
            omit: ['2027-spring']
        });
        assert.throws(
            () => api.parseAcademicCalendarHtml(
                missingSessionHtml,
                'https://www.uow.edu.au/student/dates/',
                2027
            ),
            /missing spring 2027/i
        );
        assert.deepEqual(
            Object.keys(parseCalendar(api, missingSessionHtml).years),
            ['2026']
        );
    } finally {
        api.close();
    }
});

test('sorts available years and chooses current, then earliest future, or no default', () => {
    const api = loadCalendarApi();
    try {
        const calendar = {
            years: {
                2028: {},
                2024: {},
                2026: {}
            }
        };
        const years = api.getAvailableAcademicYears(calendar);

        assert.deepEqual(Array.from(years), [2024, 2026, 2028]);
        assert.equal(api.chooseDefaultAcademicYear(years, 2026), 2026);
        assert.equal(api.chooseDefaultAcademicYear(years, 2025), 2026);
        assert.equal(api.chooseDefaultAcademicYear(years, 2030), null);
        assert.equal(api.chooseDefaultAcademicYear([], 2026), null);
    } finally {
        api.close();
    }
});

test('generates a 2027 ICS from the parsed live calendar', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api);
        const ics = api.generateICS([
            timetableEvent({
                day: 'Wed',
                startTime: '14:30',
                endTime: '16:00',
                weeks: '13-14,22-23,26',
                session: 'Annual'
            })
        ], 2027, calendar);

        assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270602T143000/);
        assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270728T143000/);
        assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20270922T143000/);
        assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20271006T143000/);
        assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20271027T143000/);
        assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 5);
        assert.match(ics, /END:VCALENDAR\r\n$/);
    } finally {
        api.close();
    }
});

test('rejects missing year, invalid week, missing session, and invalid day atomically', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api);
        const valid = timetableEvent();
        const invalidCases = [
            {
                events: [valid],
                year: undefined,
                expected: /No verified academic calendar/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'BADWEEK',
                    session: 'Annual',
                    weeks: '27'
                })],
                year: 2027,
                expected: /Invalid teaching-week range/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'HUGERANGE',
                    weeks: '1-999999999'
                })],
                year: 2027,
                expected: /Invalid teaching-week range/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'NOSESSION',
                    session: undefined
                })],
                year: 2027,
                expected: /unknown session/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'BADDAY',
                    day: 'Funday'
                })],
                year: 2027,
                expected: /Invalid class day/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'BADTIME',
                    startTime: '25:00'
                })],
                year: 2027,
                expected: /Invalid class time/
            },
            {
                events: [valid, timetableEvent({
                    subjectCode: 'REVERSED',
                    startTime: '12:00',
                    endTime: '11:00'
                })],
                year: 2027,
                expected: /end time is not after/
            }
        ];

        for (const { events, year, expected } of invalidCases) {
            let output;
            assert.throws(() => {
                output = api.generateICS(events, year, calendar);
            }, expected);
            assert.equal(output, undefined, 'failed validation returned a partial ICS');
        }
    } finally {
        api.close();
    }
});

test('escapes ICS text and folds every physical line to at most 75 UTF-8 octets', () => {
    const api = loadCalendarApi();
    try {
        const calendar = parseCalendar(api);
        const ics = api.generateICS([
            timetableEvent({
                activityDetail: '课程, seminar; room\\detail 🚀'.repeat(5),
                location: '25,107;North\\Wing'
            })
        ], 2026, calendar);

        assert.equal(ics.includes('LOCATION:25\\,107\\;North\\\\Wing'), true);
        for (const line of ics.split('\r\n')) {
            assert.ok(
                new TextEncoder().encode(line).byteLength <= 75,
                `overlong ICS line: ${line}`
            );
        }

        const folded = api.foldLine(`DESCRIPTION:${'课程🚀'.repeat(30)}`);
        const physicalLines = folded.split('\r\n');
        assert.ok(physicalLines.length > 1);
        assert.ok(physicalLines.slice(1).every((line) => line.startsWith(' ')));
    } finally {
        api.close();
    }
});

test('keeps all native extension calendar and content implementations aligned', () => {
    const expected = fs.readFileSync(extensionCalendarPaths[0]);
    for (const calendarPath of extensionCalendarPaths.slice(1)) {
        assert.deepEqual(
            fs.readFileSync(calendarPath),
            expected,
            `${calendarPath} drifted from chromium/calendar.js`
        );
    }

    const expectedContent = fs.readFileSync(extensionContentPaths[0]);
    for (const contentPath of extensionContentPaths.slice(1)) {
        assert.deepEqual(
            fs.readFileSync(contentPath),
            expectedContent,
            `${contentPath} drifted from chromium/content.js`
        );
    }

    for (const productionPath of nativeExtensionProductionPaths) {
        const source = fs.readFileSync(productionPath, 'utf8');
        assert.doesNotMatch(
            source,
            /BUNDLED_ACADEMIC|20\d{2}-\d{2}-\d{2}/,
            `${productionPath} contains static academic dates`
        );
    }
});

test('native calendar requests omit credentials and reject redirects before parsing', async () => {
    const api = loadCalendarApi();
    let observedRequest = null;

    try {
        const calendar = await api.fetchAcademicCalendar(async (url, options) => {
            observedRequest = { url, options };
            return {
                status: 200,
                ok: true,
                url,
                headers: {
                    get(name) {
                        return name.toLowerCase() === 'content-type'
                            ? 'text/html; charset=UTF-8'
                            : null;
                    }
                },
                text: async () => buildUowCalendarHtml()
            };
        }, 2026);

        assert.equal(observedRequest.url, 'https://www.uow.edu.au/student/dates/');
        assert.equal(observedRequest.options.method, 'GET');
        assert.equal(observedRequest.options.credentials, 'omit');
        assert.equal(observedRequest.options.cache, 'no-store');
        assert.equal(observedRequest.options.redirect, 'error');
        assert.equal(observedRequest.options.referrerPolicy, 'no-referrer');
        assert.ok(observedRequest.options.signal instanceof AbortSignal);
        assert.deepEqual(Object.keys(calendar.years), ['2026']);
    } finally {
        api.close();
    }
});

test('native backgrounds fetch Key Dates without a DOM or caller-supplied data', async () => {
    for (let index = 0; index < extensionBackgroundPaths.length; index += 1) {
        const environment = loadBackground(index);
        assert.equal(vm.runInContext('typeof document', environment.context), 'undefined');
        assert.deepEqual(
            environment.importedScripts,
            index === 1 ? [] : ['calendar.js']
        );

        const request = {
            action: 'loadAcademicCalendarSource',
            url: 'https://attacker.invalid/private',
            year: 2099,
            timetable: [{ studentNumber: '1234567' }]
        };
        const result = await requestBackground(environment, request);

        assert.equal(result.listenerResult, true);
        assert.equal(result.response.error, undefined);
        assert.equal(result.response.source.url, keyDatesUrl);
        assert.match(result.response.source.html, /Autumn Session 2026/);
        assert.equal(environment.requests.length, 1);

        const observed = environment.requests[0];
        assert.equal(observed.url, keyDatesUrl);
        assert.deepEqual(
            Object.keys(observed.options).sort(),
            [
                'cache',
                'credentials',
                'method',
                'redirect',
                'referrerPolicy',
                'signal'
            ]
        );
        assert.equal(observed.options.method, 'GET');
        assert.equal(observed.options.credentials, 'omit');
        assert.equal(observed.options.cache, 'no-store');
        assert.equal(observed.options.redirect, 'error');
        assert.equal(observed.options.referrerPolicy, 'no-referrer');
        assert.ok(observed.options.signal instanceof AbortSignal);
    }
});

test('native backgrounds reject every non-exact timetable sender before fetching', async () => {
    const rejectedSenders = [
        {},
        { url: 'https://solss.uow.edu.au/' },
        {
            url:
                'https://solss.uow.edu.au/sid/'
                + 'sols_tutorial_enrolment.my_timetable.evil'
        },
        {
            url:
                'https://solss.uow.edu.au.evil.invalid/sid/'
                + 'sols_tutorial_enrolment.my_timetable'
        },
        { url: 'https://extension.invalid/popup.html' },
        { url: 'not a URL' }
    ];

    for (let index = 0; index < extensionBackgroundPaths.length; index += 1) {
        const environment = loadBackground(index);
        for (const sender of rejectedSenders) {
            const result = await requestBackground(
                environment,
                { action: 'loadAcademicCalendarSource' },
                sender
            );
            assert.equal(result.listenerResult, false);
            assert.equal(
                result.response.error,
                'Academic calendar request rejected'
            );
            assert.deepEqual(Object.keys(result.response), ['error']);
        }
        assert.equal(environment.requests.length, 0);

        const accepted = await requestBackground(
            environment,
            { action: 'loadAcademicCalendarSource' },
            { tab: { url: `${timetableUrl}?view=mobile` } }
        );
        assert.equal(accepted.listenerResult, true);
        assert.equal(accepted.response.error, undefined);
        assert.equal(environment.requests.length, 1);
    }
});

test('native backgrounds share an in-flight request and enforce response boundaries', async () => {
    for (let index = 0; index < extensionBackgroundPaths.length; index += 1) {
        const deferred = createDeferred();
        const environment = loadBackground(index, {
            fetchHandler: () => deferred.promise
        });
        const first = requestBackground(environment);
        const second = requestBackground(environment);

        assert.equal(environment.requests.length, 1);
        deferred.resolve(successfulExtensionResponse());
        const [firstResult, secondResult] = await Promise.all([first, second]);
        assert.equal(firstResult.response.error, undefined);
        assert.deepEqual(firstResult.response, secondResult.response);

        await requestBackground(environment);
        assert.equal(
            environment.requests.length,
            2,
            'the background must not persist a completed response'
        );
    }

    const failureCases = [
        [
            'HTTP status',
            () => successfulExtensionResponse({ status: 503, ok: false }),
            /HTTP 503/
        ],
        [
            'final URL',
            () => successfulExtensionResponse({
                url: 'https://www.uow.edu.au/student/dates/moved/'
            }),
            /unexpected URL/
        ],
        [
            'content type',
            () => successfulExtensionResponse({
                headers: { get: () => 'application/json' }
            }),
            /was not HTML/
        ],
        [
            'empty body',
            () => successfulExtensionResponse({ text: async () => '' }),
            /invalid size/
        ],
        [
            'oversized body',
            () => successfulExtensionResponse({
                text: async () => 'x'.repeat(1_000_001)
            }),
            /invalid size/
        ],
        [
            'network failure',
            () => {
                throw new Error('redirect blocked');
            },
            /redirect blocked/
        ]
    ];

    for (const [name, responseFactory, expectedError] of failureCases) {
        const environment = loadBackground(0, {
            fetchHandler: responseFactory
        });
        const result = await requestBackground(environment);
        assert.match(result.response.error, expectedError, name);
        assert.equal(result.response.source, undefined, name);
        assert.equal(environment.requests.length, 1, name);
    }
});

test('content scripts prefetch at document start without timetable DOM', async () => {
    const emptyDocument = '<!doctype html><html><head></head><body></body></html>';

    for (const contentPath of extensionContentPaths) {
        const environment = loadContentScript(contentPath, emptyDocument);

        assert.deepEqual(
            JSON.parse(JSON.stringify(environment.runtimeMessages)),
            [{ action: 'loadAcademicCalendarSource' }]
        );
        const response = await requestContentMessage(
            environment,
            'getAcademicCalendar'
        );
        assert.ok(
            response.calendar,
            `${contentPath}: ${response.error || 'missing calendar'}`
        );
        assert.equal(environment.runtimeMessages.length, 1);
        environment.dom.window.close();
    }
});

test('content injection prefetches exactly once and reuses pending and successful data', async () => {
    for (const contentPath of extensionContentPaths) {
        const deferred = createDeferred();
        const environment = loadContentScript(
            contentPath,
            nativeTimetableFixture,
            { sourceHandler: () => deferred.promise }
        );

        assert.deepEqual(
            JSON.parse(JSON.stringify(environment.runtimeMessages)),
            [{ action: 'loadAcademicCalendarSource' }]
        );
        assert.deepEqual(
            Object.keys(environment.runtimeMessages[0]),
            ['action'],
            'the prefetch payload exposed URL, year, or timetable data'
        );

        const first = requestContentMessage(environment, 'getAcademicCalendar');
        const second = requestContentMessage(environment, 'getAcademicCalendar');
        assert.equal(environment.runtimeMessages.length, 1);

        deferred.resolve(academicCalendarSource());
        const [firstResponse, secondResponse] = await Promise.all([first, second]);
        assert.ok(
            firstResponse.calendar,
            `${contentPath}: ${firstResponse.error || 'missing calendar'}`
        );
        assert.deepEqual(
            Object.keys(firstResponse.calendar.years),
            ['2026', '2027']
        );
        assert.deepEqual(firstResponse, secondResponse);
        assert.equal(environment.runtimeMessages.length, 1);

        const cached = await requestContentMessage(
            environment,
            'getAcademicCalendar'
        );
        assert.deepEqual(cached, firstResponse);
        assert.equal(environment.runtimeMessages.length, 1);
        environment.dom.window.close();
    }
});

test('content calendar lookup retries only after a failed page-load prefetch', async () => {
    for (const contentPath of extensionContentPaths) {
        let attempts = 0;
        const environment = loadContentScript(
            contentPath,
            nativeTimetableFixture,
            {
                sourceHandler() {
                    attempts += 1;
                    if (attempts === 1) {
                        return Promise.reject(new Error('network unavailable'));
                    }
                    return academicCalendarSource();
                }
            }
        );

        for (let attempt = 0; attempt < 20 && environment.errors.length === 0; attempt += 1) {
            await new Promise((resolve) => setImmediate(resolve));
        }
        assert.equal(environment.errors.length, 1);
        assert.equal(attempts, 1);

        const retried = await requestContentMessage(
            environment,
            'getAcademicCalendar'
        );
        assert.ok(
            retried.calendar,
            `${contentPath}: ${retried.error || 'missing calendar'}`
        );
        assert.deepEqual(Object.keys(retried.calendar.years), ['2026', '2027']);
        assert.equal(attempts, 2);

        await requestContentMessage(environment, 'getAcademicCalendar');
        assert.equal(attempts, 2, 'successful retry was not reused');
        environment.dom.window.close();
    }
});

test('page-load prefetch reaches each platform background once without reading timetable data', async () => {
    for (let index = 0; index < extensionContentPaths.length; index += 1) {
        const background = loadBackground(index);
        const content = loadContentScript(
            extensionContentPaths[index],
            nativeTimetableFixture,
            {
                sourceHandler(message) {
                    return new Promise((resolve) => {
                        const keepAlive = background.listener(
                            message,
                            { url: timetableUrl },
                            resolve
                        );
                        assert.equal(keepAlive, true);
                    });
                }
            }
        );

        const response = await requestContentMessage(
            content,
            'getAcademicCalendar'
        );
        assert.ok(
            response.calendar,
            `${extensionContentPaths[index]}: ${response.error || 'missing calendar'}`
        );
        assert.deepEqual(Object.keys(response.calendar.years), ['2026', '2027']);
        assert.equal(content.runtimeMessages.length, 1);
        assert.equal(background.requests.length, 1);
        assert.equal(background.requests[0].url, keyDatesUrl);

        const parsed = await requestParsedTimetable(
            extensionContentPaths[index],
            content
        );
        assert.equal(parsed.events.length, 2);
        assert.equal(background.requests.length, 1);
        content.dom.window.close();
    }
});

test('native content scripts return an error instead of silently skipping malformed classes', async () => {
    const failureCases = [
        [
            'heading',
            nativeTimetableFixture.replace('Lecture - CSIT101', 'Lecture: CSIT101'),
            /Could not read a SOLS class heading/
        ],
        [
            'details',
            nativeTimetableFixture.replace(
                'class="list-group-item-text"',
                'class="broken-list-group-item-text"'
            ),
            /Could not read class details for CSIT101/
        ],
        [
            'time',
            nativeTimetableFixture.replace(
                'Time: Mon, 10:00 - 12:00',
                'Schedule: Mon, 10:00 - 12:00'
            ),
            /Could not read class time for CSIT101/
        ],
        [
            'weeks',
            nativeTimetableFixture.replace('Weeks: 1-13', 'Teaching weeks: 1-13'),
            /Could not read teaching weeks for CSIT101/
        ]
    ];

    for (const contentPath of extensionContentPaths) {
        const validEnvironment = loadContentScript(contentPath);
        const validResponse = await requestParsedTimetable(
            contentPath,
            validEnvironment
        );
        assert.equal(validResponse.error, undefined);
        assert.equal(validResponse.events.length, 2);
        validEnvironment.dom.window.close();

        const renderedBoundaryFixture = nativeTimetableFixture.replace(
            'Autumn - CSIT101</td>',
            'Autumn - CSIT101<br>Lecture</td>'
        );
        const boundaryEnvironment = loadContentScript(
            contentPath,
            renderedBoundaryFixture
        );
        const boundaryCell = boundaryEnvironment.dom.window.document.querySelector(
            '#desktop-version .timetable td.lecture'
        );
        Object.defineProperty(boundaryCell, 'innerText', {
            configurable: true,
            value: boundaryCell.textContent
        });
        assert.equal(boundaryCell.innerText, 'Autumn - CSIT101Lecture');
        const boundaryResponse = await requestParsedTimetable(
            contentPath,
            boundaryEnvironment
        );
        assert.equal(boundaryResponse.error, undefined);
        assert.equal(boundaryResponse.events[0].session, 'Autumn');
        boundaryEnvironment.dom.window.close();

        for (const [name, fixture, expectedError] of failureCases) {
            const environment = loadContentScript(contentPath, fixture);
            const response = await requestParsedTimetable(contentPath, environment);
            assert.equal(response.events, undefined, `${contentPath} skipped bad ${name}`);
            assert.match(response.error, expectedError);
            environment.dom.window.close();
        }
    }
});

test('keeps native manifests scoped and configures platform-correct backgrounds', () => {
    const calendarHost = 'https://www.uow.edu.au/*';
    const safariTimetableHost =
        'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable*';
    const expectedPermissions = [
        ['activeTab', 'downloads'],
        ['activeTab'],
        ['activeTab']
    ];
    const expectedBackgrounds = [
        { service_worker: 'background.js' },
        { scripts: ['calendar.js', 'background.js'] },
        { service_worker: 'background.js' }
    ];

    for (const [index, manifestPath] of extensionManifestPaths.entries()) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert.equal(manifest.version, '1.1.3');
        assert.match(manifest.description, /^Unofficial tool\b/);
        assert.deepEqual(
            [...(manifest.permissions || [])].sort(),
            [...expectedPermissions[index]].sort(),
            `${manifestPath} has unnecessary browser permissions`
        );

        const hostPermissions = manifest.host_permissions || [];
        assert.equal(
            hostPermissions.filter((permission) => permission === calendarHost).length,
            1,
            `${manifestPath} must contain the UOW calendar host exactly once`
        );

        const expectedHosts = index === 2
            ? [calendarHost, safariTimetableHost]
            : [calendarHost];
        assert.deepEqual(
            [...hostPermissions].sort(),
            expectedHosts.sort(),
            `${manifestPath} has unexpected host permissions`
        );
        assert.deepEqual(
            manifest.background,
            expectedBackgrounds[index],
            `${manifestPath} has the wrong MV3 background environment`
        );

        const contentScripts = manifest.content_scripts || [];
        assert.ok(contentScripts.length > 0, `${manifestPath} has no content script`);
        assert.ok(
            contentScripts.every((entry) => entry.run_at === 'document_start'),
            `${manifestPath} must prefetch at document_start`
        );
        const loadedScripts = contentScripts.flatMap((entry) => entry.js || []);
        assert.deepEqual(
            loadedScripts,
            ['calendar.js', 'content.js'],
            `${manifestPath} must load the calendar parser before content.js`
        );
    }

    const firefoxManifest = JSON.parse(
        fs.readFileSync(extensionManifestPaths[1], 'utf8')
    );
    assert.equal(
        firefoxManifest.browser_specific_settings.gecko.strict_min_version,
        '127.0'
    );
});

test('loads calendar.js before popup.js and starts every popup with a disabled year select', () => {
    for (const [index, popupPath] of extensionPopupPaths.entries()) {
        const dom = new JSDOM(fs.readFileSync(popupPath, 'utf8'));
        try {
            const yearSelect = dom.window.document.querySelector('#yearSelect');
            assert.ok(yearSelect, `${popupPath} has no academic-year control`);
            assert.equal(yearSelect.tagName, 'SELECT');
            assert.equal(yearSelect.disabled, true);
            assert.equal(
                dom.window.document.querySelector('#exportBtn').disabled,
                true
            );
            assert.match(
                dom.window.document.querySelector('.disclaimer').textContent,
                /Unofficial independent tool[\s\S]*not affiliated with[\s\S]*UOW/
            );

            const scripts = Array.from(
                dom.window.document.querySelectorAll('script[src]'),
                (script) => script.getAttribute('src')
            );
            assert.deepEqual(
                scripts,
                ['calendar.js', 'popup.js'],
                `${popupPath} loads the calendar runtime in the wrong order`
            );

            const popupScript = fs.readFileSync(
                extensionPopupScriptPaths[index],
                'utf8'
            );
            assert.match(
                popupScript,
                /if \(response\?\.error\) \{\s*throw new Error\(response\.error\);/,
                `${extensionPopupScriptPaths[index]} ignores content parsing errors`
            );
        } finally {
            dom.window.close();
        }
    }
});

test('native popups load, sort, select, and reuse UOW academic calendars', async () => {
    for (let index = 0; index < extensionPopupPaths.length; index += 1) {
        const environment = loadPopup(index, {
            currentYear: 2026
        });
        try {
            await waitForPopupInitialization(environment);

            const { document } = environment.window;
            const yearSelect = document.getElementById('yearSelect');
            const exportButton = document.getElementById('exportBtn');
            assert.deepEqual(
                Array.from(yearSelect.options, (option) => option.value),
                ['2026', '2027'],
                `${extensionPopupPaths[index]} did not use the validated UOW years`
            );
            assert.equal(yearSelect.value, '2026');
            assert.equal(yearSelect.disabled, false);
            assert.equal(exportButton.disabled, false);
            assert.equal(environment.requests.length, 0);
            assert.deepEqual(
                environment.sentMessages.map(({ message }) => message.action),
                ['getAcademicCalendar']
            );

            yearSelect.value = '2027';
            await clickPopupExportAndWait(environment);

            assert.equal(environment.requests.length, 0);
            assert.deepEqual(
                environment.sentMessages.map(({ message }) => message.action),
                ['getAcademicCalendar', 'parseTimetable']
            );
            assert.equal(environment.downloads.length, 1);
            assert.equal(
                environment.downloads[0].filename,
                'UOW_class_timetable.ics'
            );
            assert.match(
                document.getElementById('status').textContent,
                /Exported 1 classes using current UOW dates/
            );
            assert.equal(yearSelect.value, '2027');
            assert.equal(yearSelect.disabled, false);
            assert.equal(exportButton.disabled, false);
        } finally {
            environment.dom.window.close();
        }
    }
});

test('native popups exclude invalid years while keeping complete years selectable', async () => {
    const html = buildUowCalendarHtml({
        omit: ['2027-spring']
    });

    for (let index = 0; index < extensionPopupPaths.length; index += 1) {
        const environment = loadPopup(index, {
            academicCalendarHtml: html,
            currentYear: 2026
        });
        try {
            await waitForPopupInitialization(environment);

            const yearSelect = environment.window.document.getElementById('yearSelect');
            assert.deepEqual(
                Array.from(yearSelect.options, (option) => option.value),
                ['2026']
            );
            assert.equal(yearSelect.value, '2026');
            assert.equal(yearSelect.disabled, false);
            assert.equal(
                environment.window.document.getElementById('exportBtn').disabled,
                false
            );
        } finally {
            environment.dom.window.close();
        }
    }
});

test('native popups require an explicit choice when UOW publishes only past years', async () => {
    for (let index = 0; index < extensionPopupPaths.length; index += 1) {
        const environment = loadPopup(index, {
            currentYear: 2028
        });
        try {
            await waitForPopupInitialization(environment);

            const { document, Event } = environment.window;
            const yearSelect = document.getElementById('yearSelect');
            const exportButton = document.getElementById('exportBtn');
            assert.deepEqual(
                Array.from(yearSelect.options, (option) => option.value),
                ['', '2026', '2027']
            );
            assert.equal(yearSelect.options[0].disabled, true);
            assert.equal(yearSelect.value, '');
            assert.equal(yearSelect.disabled, false);
            assert.equal(exportButton.disabled, true);
            assert.match(
                document.getElementById('status').textContent,
                /Select an academic year published by UOW/
            );
            assert.equal(environment.sentMessages.length, 1);
            assert.equal(
                environment.sentMessages[0].message.action,
                'getAcademicCalendar'
            );
            assert.equal(environment.downloads.length, 0);

            yearSelect.value = '2027';
            yearSelect.dispatchEvent(new Event('change', { bubbles: true }));

            assert.equal(exportButton.disabled, false);
            assert.equal(environment.sentMessages.length, 1);
            assert.equal(environment.downloads.length, 0);
        } finally {
            environment.dom.window.close();
        }
    }
});

test('native popups disable export and explain UOW academic-year loading failures', async () => {
    for (let index = 0; index < extensionPopupPaths.length; index += 1) {
        const environment = loadPopup(index, {
            fetchError: new Error('network unavailable')
        });
        try {
            await waitForPopupInitialization(environment);

            const { document } = environment.window;
            const yearSelect = document.getElementById('yearSelect');
            const exportButton = document.getElementById('exportBtn');
            assert.equal(yearSelect.disabled, true);
            assert.equal(exportButton.disabled, true);
            assert.deepEqual(
                Array.from(yearSelect.options, (option) => option.value),
                ['']
            );
            assert.match(
                document.getElementById('status').textContent,
                /Unable to load available UOW academic years: network unavailable/
            );
            assert.equal(environment.downloads.length, 0);
            assert.equal(environment.requests.length, 0);
            assert.equal(environment.sentMessages.length, 1);
            assert.equal(
                environment.sentMessages[0].message.action,
                'getAcademicCalendar'
            );
        } finally {
            environment.dom.window.close();
        }
    }
});
