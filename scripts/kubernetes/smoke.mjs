import assert from 'node:assert/strict';

// Check both Service routing and Caddy's reverse proxy, not only individual Pods.
for (let attempt = 1; ; attempt++) {
  try {
    const page = await fetch('http://web/', { signal: AbortSignal.timeout(5000) });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<app-root/);
    const ready = await fetch('http://web/api/v1/ready', { signal: AbortSignal.timeout(5000) });
    assert.equal(ready.status, 200);
    console.log('Frontend and database-backed API passed through the web Service and Caddy.');
    break;
  } catch (error) {
    if (attempt === 10) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
