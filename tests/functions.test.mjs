// Regression tests for the two security properties this site depends on:
//   1. Only a signed-in administrator can add case studies or FAQs.
//   2. The waitlist rejects duplicate emails regardless of casing.
//
// Run with: npm test

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS = path.join(HERE, '..', 'netlify', 'functions');
const TMP = path.join(HERE, '.tmp');
const FAKE = pathToFileURL(path.join(HERE, 'fake-blobs.mjs')).href;

// Loads a handler with @netlify/blobs swapped for the in-memory fake.
// Every other line of the handler is the deployed code, unmodified.
async function loadHandler(name) {
  const source = await readFile(path.join(FUNCTIONS, name), 'utf8');
  const patched = source.replace("from '@netlify/blobs'", `from ${JSON.stringify(FAKE)}`);
  await mkdir(TMP, { recursive: true });
  const target = path.join(TMP, name);
  await writeFile(target, patched, 'utf8');
  return (await import(pathToFileURL(target).href + '?t=' + Date.now())).handler;
}

const ADMIN = { clientContext: { user: { email: 'admin@meridianintelligence.co' } } };
const ANON = { clientContext: {} };

const post = (body) => ({ httpMethod: 'POST', body: JSON.stringify(body) });
const get = () => ({ httpMethod: 'GET' });

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
  const handler = await loadHandler('content.mjs');
  const body = (res) => JSON.parse(res.body);

  const seeded = await handler(get(), ANON);
  check('GET is public', seeded.statusCode, 200);
  check('seeds case studies', body(seeded).caseStudies.length, 5);
  check('seeds FAQs', body(seeded).faqs.length, 5);

  const faq = { type: 'faq', question: 'Real question?', answer: 'Real answer.' };
  check('POST rejected when signed out', (await handler(post(faq), ANON)).statusCode, 401);
  check('POST rejected with empty context', (await handler(post(faq), {})).statusCode, 401);
  check('POST rejects unknown type', (await handler(post({ type: 'admin' }), ADMIN)).statusCode, 400);
  check(
    'POST rejects case study with no results',
    (await handler(post({ type: 'caseStudy', company: 'A', industry: 'B', challenge: 'C', solution: 'D', results: [] }), ADMIN)).statusCode,
    400
  );
  check(
    'POST rejects oversized field',
    (await handler(post({ type: 'faq', question: 'x'.repeat(301), answer: 'A' }), ADMIN)).statusCode,
    400
  );

  const created = await handler(post(faq), ADMIN);
  check('POST accepted for admin', created.statusCode, 201);
  check('FAQ appended', body(created).faqs.length, 6);

  const after = body(await handler(get(), ANON));
  check('new FAQ visible to everyone', after.faqs[5].question, 'Real question?');
  check('admin email never leaves the server', JSON.stringify(after).includes('addedBy'), false);
  check('DELETE not allowed', (await handler({ httpMethod: 'DELETE' }, ADMIN)).statusCode, 405);
}

console.log('\n=== waitlist: case-insensitive dedupe ===');
{
  const handler = await loadHandler('waitlist.mjs');

  check('first signup accepted', (await handler(post({ email: 'Shadi@Example.COM' }), ANON)).statusCode, 201);
  check('exact duplicate rejected', (await handler(post({ email: 'Shadi@Example.COM' }), ANON)).statusCode, 409);
  check('lowercase duplicate rejected', (await handler(post({ email: 'shadi@example.com' }), ANON)).statusCode, 409);
  check('uppercase duplicate rejected', (await handler(post({ email: 'SHADI@EXAMPLE.COM' }), ANON)).statusCode, 409);
  check('mixed-case duplicate rejected', (await handler(post({ email: 'sHaDi@ExAmPlE.cOm' }), ANON)).statusCode, 409);
  check('padded duplicate rejected', (await handler(post({ email: '  shadi@example.com  ' }), ANON)).statusCode, 409);
  check('different address accepted', (await handler(post({ email: 'other@example.com' }), ANON)).statusCode, 201);

  check('malformed email rejected', (await handler(post({ email: 'not-an-email' }), ANON)).statusCode, 400);
  check('empty email rejected', (await handler(post({ email: '' }), ANON)).statusCode, 400);
  check('non-string email rejected', (await handler(post({ email: 12345 }), ANON)).statusCode, 400);
  check('oversized email rejected', (await handler(post({ email: 'a'.repeat(250) + '@b.com' }), ANON)).statusCode, 400);

  check('honeypot accepted without storing', (await handler(post({ email: 'bot@spam.com', company: 'Spam Co' }), ANON)).statusCode, 201);

  check('list blocked when signed out', (await handler(get(), ANON)).statusCode, 401);
  const listed = await handler(get(), ADMIN);
  check('list allowed for admin', listed.statusCode, 200);
  check('honeypot entry was not stored', JSON.parse(listed.body).count, 2);
  check('original casing preserved', JSON.parse(listed.body).entries.some((e) => e.email === 'Shadi@Example.COM'), true);
}

await rm(TMP, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
