import { getStore } from '@netlify/blobs';
import { verifyUser, jsonResponse } from '../lib/identity.mjs';

const STORE = 'meridian-content';
const KEY = 'content';

const LIMITS = {
  company: 120,
  industry: 80,
  challenge: 1000,
  solution: 1000,
  result: 300,
  question: 300,
  answer: 2000
};

const MAX_RESULTS = 10;
const MAX_ITEMS = 200;

// Built from escape sequences so no literal control bytes end up in this file.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

const SEED = {
  caseStudies: [
    {
      company: 'TechFlow Solutions',
      industry: 'IT Services',
      challenge: 'Managing large volumes of customer inquiries and automating repetitive development tasks.',
      solution: 'Implemented AI agents for customer support automation and code review assistance.',
      results: [
        '60% reduction in support response time',
        '40% increase in development efficiency',
        'Customer satisfaction score improved to 92%'
      ]
    },
    {
      company: 'DataVision Inc',
      industry: 'IT Consulting',
      challenge: 'Processing and analyzing massive datasets for client reports took weeks.',
      solution: 'Deployed AI analytics agents to automate data processing and report generation.',
      results: [
        'Report generation time reduced from 3 weeks to 3 days',
        '85% improvement in data accuracy',
        'Enabled delivery of more client projects annually'
      ]
    },
    {
      company: 'RetailHub Marketplace',
      industry: 'E-commerce & Retail',
      challenge: 'Inventory management and personalized customer recommendations at scale.',
      solution: 'Integrated AI agents for inventory optimization and personalized product recommendations.',
      results: [
        '35% reduction in inventory holding costs',
        '28% increase in average order value',
        'Customer retention increased by 45%'
      ]
    },
    {
      company: 'The Urban Bistro',
      industry: 'Food & Hospitality',
      challenge: 'Managing reservations, orders, and customer preferences manually.',
      solution: 'Deployed AI agents for reservation management and personalized dining recommendations.',
      results: [
        '50% faster booking response time',
        '30% increase in repeat customers',
        'Reduced staff workload by 25%'
      ]
    },
    {
      company: 'Justice & Associates Law Firm',
      industry: 'Legal Services',
      challenge: 'Document review and case research consumed 40% of billable hours.',
      solution: 'Implemented AI agents for document analysis and legal research automation.',
      results: [
        '20% increase in billable hours per attorney',
        'Document review time cut in half',
        'Improved case preparation quality by 35%'
      ]
    }
  ],
  faqs: [
    {
      question: 'What is Meridian Intelligence?',
      answer: 'Meridian Intelligence is a platform that helps businesses implement and deploy AI agents to automate tasks, improve efficiency, and drive innovation. We specialize in custom AI solutions tailored to your industry and business needs.'
    },
    {
      question: 'How do AI agents work?',
      answer: 'AI agents are autonomous systems that can understand tasks, make decisions, and take actions to accomplish goals. They use machine learning and natural language processing to learn from data and improve over time. Our agents can handle customer service, data analysis, content creation, and much more.'
    },
    {
      question: 'Is AI implementation expensive?',
      answer: 'The cost of AI implementation depends on your specific needs and scale. However, our solutions are designed to provide ROI within 90 days through increased efficiency and reduced operational costs. We offer flexible pricing models to suit businesses of all sizes.'
    },
    {
      question: 'Do you provide training for our team?',
      answer: 'Yes! We offer comprehensive AI literacy and training programs to help your team understand how to work effectively with AI agents. Our training is customized based on your team background and industry requirements.'
    },
    {
      question: 'What industries do you serve?',
      answer: 'We work with businesses across various industries including IT, retail, hospitality, legal services, healthcare, finance, and more. Our solutions are customizable to fit any industry specific needs.'
    }
  ]
};

function clean(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(CONTROL_CHARS, '').trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function validateCaseStudy(input) {
  const company = clean(input.company, LIMITS.company);
  const industry = clean(input.industry, LIMITS.industry);
  const challenge = clean(input.challenge, LIMITS.challenge);
  const solution = clean(input.solution, LIMITS.solution);

  if (!company || !industry || !challenge || !solution) return null;
  if (!Array.isArray(input.results)) return null;

  const results = input.results
    .map((r) => clean(r, LIMITS.result))
    .filter(Boolean)
    .slice(0, MAX_RESULTS);

  if (results.length === 0) return null;

  return { company, industry, challenge, solution, results };
}

function validateFaq(input) {
  const question = clean(input.question, LIMITS.question);
  const answer = clean(input.answer, LIMITS.answer);
  if (!question || !answer) return null;
  return { question, answer };
}

async function readContent(store) {
  const existing = await store.get(KEY, { type: 'json' });
  if (existing && Array.isArray(existing.caseStudies) && Array.isArray(existing.faqs)) {
    return existing;
  }
  await store.setJSON(KEY, SEED);
  return SEED;
}

// addedBy/addedAt are kept for audit but never sent to the browser -- they
// would expose administrator email addresses to every visitor.
function publicView(content) {
  const strip = (item) => {
    const copy = Object.assign({}, item);
    delete copy.addedBy;
    delete copy.addedAt;
    return copy;
  };
  return {
    caseStudies: content.caseStudies.map(strip),
    faqs: content.faqs.map(strip)
  };
}

export default async (request) => {
  let store;
  try {
    store = getStore(STORE);
  } catch (error) {
    console.error('getStore failed:', error && error.message);
    return jsonResponse(503, { error: 'Content storage is unavailable.' });
  }

  if (request.method === 'GET') {
    try {
      return jsonResponse(200, publicView(await readContent(store)));
    } catch (error) {
      console.error('read failed:', error && error.message);
      return jsonResponse(500, { error: 'Could not load content.' });
    }
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  }

  const user = await verifyUser(request);
  if (!user) {
    return jsonResponse(401, { error: 'You must be signed in to add content.' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Malformed request.' });
  }

  const isCaseStudy = payload.type === 'caseStudy';
  const isFaq = payload.type === 'faq';
  if (!isCaseStudy && !isFaq) {
    return jsonResponse(400, { error: 'Unknown content type.' });
  }

  const item = isCaseStudy ? validateCaseStudy(payload) : validateFaq(payload);
  if (!item) {
    return jsonResponse(400, { error: 'One or more fields are missing or too long.' });
  }

  try {
    const content = await readContent(store);
    const collection = isCaseStudy ? content.caseStudies : content.faqs;

    if (collection.length >= MAX_ITEMS) {
      return jsonResponse(409, { error: 'This collection is full.' });
    }

    item.addedBy = user.email;
    item.addedAt = new Date().toISOString();
    collection.push(item);

    await store.setJSON(KEY, content);
    return jsonResponse(201, publicView(content));
  } catch (error) {
    console.error('write failed:', error && error.message);
    return jsonResponse(500, { error: 'Could not save content.' });
  }
};
