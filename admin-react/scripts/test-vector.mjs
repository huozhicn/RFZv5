// 向量搜索验证 — 搜索"线香"看是否返回老山檀线香
import { chromium } from 'playwright';
const BASE = 'https://admin.rufazao.com/v5/';
const AUTH = { username: 'admin', password: 'admin123' };

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/snap/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.fill('input[placeholder="输入用户名"]', AUTH.username);
  await page.fill('input[placeholder="输入密码"]', AUTH.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Go to product page
  await page.goto(BASE + '#/tables/product', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const before = await page.locator('tbody tr').count();
  console.log(`产品列表: ${before} 行`);

  // Search "线香" — should trigger vector search
  const searchInput = page.locator('input[placeholder="搜索..."]');
  await searchInput.fill('线香');
  await page.waitForTimeout(3000);

  const after = await page.locator('tbody tr').count();
  console.log(`搜索"线香": ${after} 行`);

  // Check which products appeared
  const rows = await page.locator('tbody tr').all();
  console.log('结果:');
  for (const row of rows) {
    const text = await row.textContent();
    console.log(`  ${text.slice(0, 80)}`);
  }

  // Search "禅修打坐"
  await searchInput.fill('');
  await page.waitForTimeout(1000);
  await searchInput.fill('禅修打坐');
  await page.waitForTimeout(3000);
  
  const after2 = await page.locator('tbody tr').count();
  console.log(`\n搜索"禅修打坐": ${after2} 行`);
  const rows2 = await page.locator('tbody tr').all();
  for (const row of rows2) {
    const text = await row.textContent();
    console.log(`  ${text.slice(0, 80)}`);
  }

  await page.screenshot({ path: '/tmp/vector-search.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
