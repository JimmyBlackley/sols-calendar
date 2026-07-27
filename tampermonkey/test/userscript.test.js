const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const userscript = fs.readFileSync(path.join(root, 'sols-calendar.user.js'), 'utf8');

function createEnvironment() {
    const dom = new JSDOM(fixture, {
        runScripts: 'outside-only',
        url: 'https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable'
    });
    const { window } = dom;
    const downloads = [];
    const blobs = [];
    const revoked = [];

    window.Blob = class TestBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.type = options?.type;
            blobs.push(this);
        }
    };
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

    window.eval(userscript);
    return { blobs, dom, downloads, revoked, window };
}

test('metadata keeps the userscript page-scoped and privilege-free', () => {
    assert.match(userscript, /@match\s+https:\/\/solss\.uow\.edu\.au\/sid\/sols_tutorial_enrolment\.my_timetable\*/);
    assert.match(userscript, /@grant\s+none/);
    assert.match(userscript, /@noframes/);
    assert.doesNotMatch(userscript, /@require\b/);
    assert.doesNotMatch(userscript, /@connect\b|@resource\b/);
    assert.doesNotMatch(
        userscript,
        /GM_xmlhttpRequest|GM\.xmlHttpRequest|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB/
    );
});

test('injects a SOLS-style panel immediately before the timetable', () => {
    const { dom, window } = createEnvironment();
    const panel = window.document.getElementById('sols-calendar-export');
    const timetable = window.document.getElementById('mobile-version');

    assert(panel);
    assert(panel.classList.contains('panel'));
    assert(panel.classList.contains('panel-default'));
    assert.equal(panel.nextElementSibling, timetable);
    assert.equal(panel.querySelector('button').textContent, 'Export to ICS');

    const yearControl = panel.querySelector('#sols-calendar-export-year');
    assert.equal(yearControl.tagName, 'INPUT');
    assert.equal(yearControl.readOnly, true);
    assert.equal(yearControl.value, '2026');
    assert.equal(panel.querySelector('select'), null);
    assert.equal(window.getComputedStyle(panel.querySelector('button')).marginBottom, '0px');

    window.eval(userscript);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export').length, 1);
    assert.equal(window.document.querySelectorAll('#sols-calendar-export-style').length, 1);

    dom.window.close();
});

test('exports fixture classes to a local ICS Blob', () => {
    const { blobs, dom, downloads, revoked, window } = createEnvironment();
    const button = window.document.querySelector('#sols-calendar-export button');

    button.click();

    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].download, 'UOW_class_timetable.ics');
    assert.match(downloads[0].href, /^blob:test-/);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'text/calendar;charset=utf-8');

    const ics = blobs[0].parts.join('');
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /SUMMARY:CSIT101 Lecture/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260302T100000/);
    assert.match(ics, /SUMMARY:ISIT202 Computer Lab/);
    assert.match(ics, /DTSTART;TZID=Australia\/Sydney:20260812T143000/);
    assert.match(ics, /\r\nEND:VCALENDAR$/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 19);

    const status = window.document.querySelector('.sols-calendar-status');
    assert.equal(status.dataset.state, 'success');
    assert.match(status.textContent, /Exported 2 classes/);
    assert.deepEqual(revoked, ['blob:test-1']);
    assert.equal(window.document.querySelector('a[download]'), null);

    dom.window.close();
});
