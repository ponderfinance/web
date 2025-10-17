#!/usr/bin/env node
/**
 * Headless Browser Route Tester
 * Visits all app routes and detects GraphQL errors
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

// Sample token/pair addresses for dynamic routes
const SAMPLE_TOKEN = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'; // KKUB
const SAMPLE_PAIR = '0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74';

const routes = [
  { path: '/', name: 'Homepage' },
  { path: '/explore', name: 'Explore Hub' },
  { path: '/explore/tokens', name: 'Tokens List' },
  { path: `/explore/tokens/${SAMPLE_TOKEN}`, name: 'Token Detail' },
  { path: '/explore/pools', name: 'Pools List' },
  { path: `/explore/pools/${SAMPLE_PAIR}`, name: 'Pool Detail' },
  { path: '/explore/transactions', name: 'Transactions' },
  { path: '/swap', name: 'Swap' },
];

async function testRoute(browser, route) {
  const page = await browser.newPage();
  const errors = [];

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter for GraphQL errors
      if (text.includes('GraphQL') || text.includes('Cannot return null')) {
        errors.push({ type: 'Console Error', message: text });
      }
    }
  });

  // Capture network errors
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('/api/graphql')) {
      errors.push({
        type: 'Network Error',
        message: `GraphQL request failed: ${request.failure().errorText}`
      });
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push({ type: 'Page Error', message: error.message });
  });

  try {
    console.log(`\n= Testing: ${route.name} (${route.path})`);

    const response = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Check HTTP status
    if (response && !response.ok()) {
      errors.push({
        type: 'HTTP Error',
        message: `HTTP ${response.status()}: ${response.statusText()}`
      });
    }

    // Wait a bit for React rendering and GraphQL queries
    await page.waitForTimeout(2000);

    // Check for error messages in the DOM
    const errorElements = await page.$$('[data-error], .error, [role="alert"]');
    for (const el of errorElements) {
      const text = await el.evaluate(node => node.textContent);
      if (text && text.includes('Error')) {
        errors.push({ type: 'DOM Error', message: text.substring(0, 200) });
      }
    }

    if (errors.length === 0) {
      console.log(` PASS - No errors detected`);
      await page.close();
      return { success: true, route, errors: [] };
    } else {
      console.log(`L FAIL - ${errors.length} error(s) detected:`);
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.type}] ${err.message.substring(0, 150)}`);
      });
      await page.close();
      return { success: false, route, errors };
    }

  } catch (error) {
    console.log(`L FAIL - Fatal error: ${error.message}`);
    await page.close();
    return {
      success: false,
      route,
      errors: [{ type: 'Fatal', message: error.message }]
    };
  }
}

async function main() {
  console.log('=� Starting Headless Browser Route Tester');
  console.log('P'.repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Routes: ${routes.length}`);
  console.log('P'.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (const route of routes) {
    const result = await testRoute(browser, route);
    results.push(result);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await browser.close();

  // Print summary
  console.log('\n' + 'P'.repeat(60));
  console.log('=� TEST SUMMARY');
  console.log('P'.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal Routes: ${results.length}`);
  console.log(`Passed:  ${passed}`);
  console.log(`Failed: L ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n�  Failed Routes:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n  " ${r.route.name} (${r.route.path})`);
      r.errors.forEach(err => {
        console.log(`    - [${err.type}] ${err.message.substring(0, 120)}`);
      });
    });
    process.exit(1);
  } else {
    console.log('\n All routes passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('L Fatal error:', error);
  process.exit(1);
});