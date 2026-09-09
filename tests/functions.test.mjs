// Regression tests for the two security properties this site depends on:
//   1. Only a signed-in administrator can add case studies or FAQs.
//   2. The waitlist rejects duplicate emails regardless of casing.
//
// Run with: npm test

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { VALID_TOKEN } from './fake-identity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS = path.join(HERE, '..', 'netlify', 'functions');
const TMP = path.join(HERE, '.tmp');

const FAKE_BLOBS = pathToFileURL(path.join(HERE, 'fake-blobs.mjs')).href;
const FAKE_IDENTITY = pathToFileURL(path.join(HERE, 'fake-identity.mjs')).href;

// Loads a function with its two external dependencies swapped for local fakes.
// Every other line is the deployed code, unmodified.
async function loadFunction(name) {
  const source = (await readFile(path.join(FUNCTIONS, name), 'utf8'))
    .replace("from '@netlify/blobs'", `from ${JSON.stringify(FAKE_BLOBS)}`)
    .replace("from '../lib/identity.mjs'", `from ${JSON.stringify(FAKE_IDENTITY)}`);

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

  const del = await fn(new Request(URL_BASE + 'x', { method: 'DELETE' }));
  check('DELETE not allowed', del.status, 405);

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

console.log('\n=== waitlist: case-insensitive dedupe ===');
{
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

await rm(TMP, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
