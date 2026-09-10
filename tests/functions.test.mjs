// Regression tests for the two security properties this site depends on:
//   1. Only a signed-in administrator can add case studies or FAQs.
//   2. The waitlist rejects duplicate emails regardless of casing.
//
// Run with: npm test

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { VALID_TOKEN } from './fake-identity.mjs';
import { requestedOptions, reset } from './fake-blobs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS = path.join(HERE, '..', 'netlify', 'functions');
const TMP = path.join(HERE, '.tmp');

const FAKE_BLOBS = pathToFileURL(path.join(HERE, 'fake-blobs.mjs')).href;
const FAKE_IDENTITY = pathToFileURL(path.join(HERE, 'fake-identity.mjs')).href;
// Not faked: the limiter is what these tests are checking.
const REAL_RATE_LIMIT = pathToFileURL(path.join(HERE, '..', 'netlify', 'lib', 'rate-limit.mjs')).href;

// Loads a function with Blobs and Identity swapped for local fakes. Every other
// line is the deployed code, unmodified.
async function loadFunction(name) {
  const source = (await readFile(path.join(FUNCTIONS, name), 'utf8'))
    .replace("from '@netlify/blobs'", `from ${JSON.stringify(FAKE_BLOBS)}`)
    .replace("from '../lib/identity.mjs'", `from ${JSON.stringify(FAKE_IDENTITY)}`)
    .replace("from '../lib/rate-limit.mjs'", `from ${JSON.stringify(REAL_RATE_LIMIT)}`);

  await mkdir(TMP, { recursive: true });
  const target = path.join(TMP, name);
  await writeFile(target, source, 'utf8');
  return (await import(pathToFileURL(target).href + '?t=' + Date.now())).default;
}

const URL_BASE = 'https://meridianintelligence.co/.netlify/functions/';

const asAdmin = (body) =>
  new Request(URL_BASE + 'x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: VALID_TOKEN },
    body: JSON.stringify(body)
  });

const anonymous = (body) =>
  new Request(URL_BASE + 'x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

// Without a client IP the limiter has nothing to key on and stays out of the
// way, which is what keeps the other tests unaffected by it.
const fromIp = (ip, body) =>
  new Request(URL_BASE + 'x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: JSON.stringify(body)
  });

const forged = (body) =>
  new Request(URL_BASE + 'x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer forged.token.here' },
    body: JSON.stringify(body)
  });

const getAs = (token) =>
  new Request(URL_BASE + 'x', {
    method: 'GET',
    headers: token ? { Authorization: token } : {}
  });

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}\n          expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log('\n=== content: only admins may write ===');
{
  reset();
  const fn = await loadFunction('content.mjs');

  const seeded = await fn(getAs());
  const seedBody = await seeded.json();
  check('GET is public', seeded.status, 200);
  check('seeds case studies', seedBody.caseStudies.length, 5);
  check('seeds FAQs', seedBody.faqs.length, 5);

  const faq = { type: 'faq', question: 'Real question?', answer: 'Real answer.' };
  check('POST rejected when signed out', (await fn(anonymous(faq))).status, 401);
  check('POST rejected with forged token', (await fn(forged(faq))).status, 401);
  check('POST rejects unknown type', (await fn(asAdmin({ type: 'admin' }))).status, 400);
  check(
    'POST rejects case study with no results',
    (await fn(asAdmin({ type: 'caseStudy', company: 'A', industry: 'B', challenge: 'C', solution: 'D', results: [] }))).status,
    400
  );
  check(
    'POST rejects oversized field',
    (await fn(asAdmin({ type: 'faq', question: 'x'.repeat(301), answer: 'A' }))).status,
    400
  );

  const created = await fn(asAdmin(faq));
  check('POST accepted for admin', created.status, 201);
  check('FAQ appended', (await created.json()).faqs.length, 6);

  const after = await (await fn(getAs())).json();
  check('new FAQ visible to everyone', after.faqs[5].question, 'Real question?');
  check('admin email never leaves the server', JSON.stringify(after).includes('addedBy'), false);

  // DELETE is a supported method now, so it is auth that turns this away.
  const del = await fn(new Request(URL_BASE + 'x', { method: 'DELETE' }));
  check('DELETE without auth is rejected', del.status, 401);

  const patch = await fn(new Request(URL_BASE + 'x', { method: 'PATCH' }));
  check('unsupported method is 405', patch.status, 405);

  // Ordinary punctuation must survive the control-character sanitiser.
  const punct = await fn(asAdmin({
    type: 'caseStudy',
    company: 'E-commerce & Co.',
    industry: 'Retail',
    challenge: 'Kept 100% of margin?',
    solution: 'Yes -- it did.',
    results: ['35% saved']
  }));
  check('punctuation preserved', punct.status, 201);
  const punctBody = await punct.json();
  check('hyphens and ampersands intact', punctBody.caseStudies[5].company, 'E-commerce & Co.');
}

console.log('\n=== content: admin edit and delete ===');
{
  reset();
  const fn = await loadFunction('content.mjs');

  const request = (method, body, token) =>
    new Request(URL_BASE + 'x', {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: token } : {}
      ),
      body: JSON.stringify(body)
    });

  const seeded = await (await fn(getAs())).json();
  check('seed items are given ids', seeded.faqs.every((f) => typeof f.id === 'string' && f.id), true);
  check('ids are unique', new Set(seeded.faqs.map((f) => f.id)).size, seeded.faqs.length);

  const target = seeded.faqs[0];

  // Edits must be authenticated.
  check(
    'PUT rejected when signed out',
    (await fn(request('PUT', { type: 'faq', id: target.id, question: 'Hijacked', answer: 'Hijacked' }))).status,
    401
  );
  check(
    'DELETE rejected when signed out',
    (await fn(request('DELETE', { type: 'faq', id: target.id }))).status,
    401
  );
  check(
    'DELETE rejected with forged token',
    (await fn(request('DELETE', { type: 'faq', id: target.id }, 'Bearer forged'))).status,
    401
  );

  const untouched = await (await fn(getAs())).json();
  check('nothing changed after rejected writes', untouched.faqs.length, 5);
  check('target FAQ intact', untouched.faqs[0].question, target.question);

  // Authenticated edit.
  const edited = await fn(request('PUT', {
    type: 'faq',
    id: target.id,
    question: 'Edited question?',
    answer: 'Edited answer.'
  }, VALID_TOKEN));
  check('PUT accepted for admin', edited.status, 200);
  const editedBody = await edited.json();
  check('edit applied', editedBody.faqs[0].question, 'Edited question?');
  check('edit keeps the same id', editedBody.faqs[0].id, target.id);
  check('edit does not change the count', editedBody.faqs.length, 5);
  check('editor email not exposed', JSON.stringify(editedBody).includes('updatedBy'), false);

  check(
    'PUT on unknown id is 404',
    (await fn(request('PUT', { type: 'faq', id: 'no-such-id', question: 'q', answer: 'a' }, VALID_TOKEN))).status,
    404
  );
  check(
    'DELETE on unknown id is 404',
    (await fn(request('DELETE', { type: 'faq', id: 'no-such-id' }, VALID_TOKEN))).status,
    404
  );
  check(
    'PUT with invalid fields is rejected',
    (await fn(request('PUT', { type: 'faq', id: target.id, question: '', answer: 'a' }, VALID_TOKEN))).status,
    400
  );

  // Authenticated delete.
  const deleted = await fn(request('DELETE', { type: 'faq', id: target.id }, VALID_TOKEN));
  check('DELETE accepted for admin', deleted.status, 200);
  const afterDelete = await deleted.json();
  check('item removed', afterDelete.faqs.length, 4);
  check('correct item removed', afterDelete.faqs.some((f) => f.id === target.id), false);

  // Deleting one collection must not disturb the other.
  check('case studies untouched by FAQ delete', afterDelete.caseStudies.length, 5);

  const study = afterDelete.caseStudies[0];
  const studyDeleted = await fn(request('DELETE', { type: 'caseStudy', id: study.id }, VALID_TOKEN));
  check('case study delete works', studyDeleted.status, 200);
  const finalState = await studyDeleted.json();
  check('case study removed', finalState.caseStudies.length, 4);
  check('FAQs untouched by case study delete', finalState.faqs.length, 4);
}

console.log('\n=== waitlist: case-insensitive dedupe ===');
{
  reset();
  const fn = await loadFunction('waitlist.mjs');

  check('first signup accepted', (await fn(anonymous({ email: 'Shadi@Example.COM' }))).status, 201);
  check('exact duplicate rejected', (await fn(anonymous({ email: 'Shadi@Example.COM' }))).status, 409);
  check('lowercase duplicate rejected', (await fn(anonymous({ email: 'shadi@example.com' }))).status, 409);
  check('uppercase duplicate rejected', (await fn(anonymous({ email: 'SHADI@EXAMPLE.COM' }))).status, 409);
  check('mixed-case duplicate rejected', (await fn(anonymous({ email: 'sHaDi@ExAmPlE.cOm' }))).status, 409);
  check('padded duplicate rejected', (await fn(anonymous({ email: '  shadi@example.com  ' }))).status, 409);
  check('different address accepted', (await fn(anonymous({ email: 'other@example.com' }))).status, 201);

  check('malformed email rejected', (await fn(anonymous({ email: 'not-an-email' }))).status, 400);
  check('empty email rejected', (await fn(anonymous({ email: '' }))).status, 400);
  check('non-string email rejected', (await fn(anonymous({ email: 12345 }))).status, 400);
  check('oversized email rejected', (await fn(anonymous({ email: 'a'.repeat(250) + '@b.com' }))).status, 400);

  check('honeypot accepted without storing', (await fn(anonymous({ email: 'bot@spam.com', company: 'Spam Co' }))).status, 201);

  check('list blocked when signed out', (await fn(getAs())).status, 401);
  check('list blocked with forged token', (await fn(getAs('Bearer forged'))).status, 401);

  const listed = await fn(getAs(VALID_TOKEN));
  check('list allowed for admin', listed.status, 200);
  const body = await listed.json();
  check('honeypot entry was not stored', body.count, 2);
  check('original casing preserved', body.entries.some((e) => e.email === 'Shadi@Example.COM'), true);
}

console.log('\n=== waitlist: rate limiting ===');
{
  reset();
  const fn = await loadFunction('waitlist.mjs');

  // Ten requests inside the window are allowed; the eleventh is not.
  const first = [];
  for (let i = 0; i < 10; i++) {
    first.push((await fn(fromIp('203.0.113.7', { email: `probe${i}` }))).status);
  }
  check('first 10 from an IP are not throttled', first.every((s) => s === 400), true);

  const eleventh = await fn(fromIp('203.0.113.7', { email: 'probe10' }));
  check('11th request is throttled', eleventh.status, 429);
  check('throttle response sets Retry-After', eleventh.headers.get('Retry-After'), '60');
  check('throttle response is JSON', (await eleventh.json()).error.includes('Too many'), true);

  // The limit is per client, not global.
  const other = await fn(fromIp('198.51.100.4', { email: 'someone@example.com' }));
  check('a different IP is unaffected', other.status, 201);

  // A throttled caller cannot slip a real signup through.
  const blocked = await fn(fromIp('203.0.113.7', { email: 'sneaky@example.com' }));
  check('throttled caller cannot write', blocked.status, 429);

  const listed = await fn(getAs(VALID_TOKEN));
  const emails = (await listed.json()).entries.map((e) => e.email);
  check('throttled signup was not stored', emails.includes('sneaky@example.com'), false);
  check('counters do not pollute the waitlist store', emails.includes('someone@example.com'), true);
}

console.log('\n=== blob store configuration ===');
{
  // Real Blobs reads are eventually consistent by default, which silently
  // breaks read-after-write logic like dedupe and rate counting. The in-memory
  // fake cannot reproduce that, so assert the option is asked for.
  check('at least one store was opened', requestedOptions.length > 0, true);
  check(
    'every store requests strong consistency',
    requestedOptions.every((o) => o && o.consistency === 'strong'),
    true
  );
  check(
    'rate counters live in a separate store',
    requestedOptions.some((o) => o.name === 'meridian-waitlist-rate'),
    true
  );
}

await rm(TMP, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
