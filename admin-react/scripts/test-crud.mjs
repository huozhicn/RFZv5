// CRUD 调试 v2 — 正确区分搜索框和表单输入
import { chromium } from 'playwright';
const BASE = 'https://admin.rufazao.com/v5/';
const AUTH = { username: 'admin', password: 'admin123' };

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/snap/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', e => console.log('  PAGE_ERR:', e.message.slice(0,100)));
  page.on('response', r => { if (r.status()>=400) console.log(`  HTTP ${r.status()}: ${r.url().slice(-40)}`); });

  // Login
  console.log('🔑 登录...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.fill('input[placeholder="输入用户名"]', AUTH.username);
  await page.fill('input[placeholder="输入密码"]', AUTH.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const URL = `${BASE}#/tables/product_category`;

  // Step 1: load table
  console.log('\n1️⃣ 加载 product_category...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const before = await page.locator('tbody tr').count();
  const beforeTotal = await page.locator('text=/共 \\d+ 条/').textContent();
  console.log(`   ${before} 行, ${beforeTotal}`);

  // Step 2: open create panel
  console.log('\n2️⃣ 打开新建面板...');
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForTimeout(2000);

  // Check panel is visible
  const panelTitle = await page.locator('text=新建 产品类目').count();
  console.log(`   面板可见: ${panelTitle > 0 ? '✅' : '❌'}`);

  // Step 3: fill the FORM input (inside the drawer, NOT the search box)
  console.log('\n3️⃣ 填写表单...');
  // The drawer is a fixed bottom sheet. Find inputs inside it.
  // The search input is in the main content area toolbar.
  // Strategy: find all text inputs, skip the one matching "搜索" placeholder
  const allInputs = page.locator('input[type="text"]');
  const inputCount = await allInputs.count();
  console.log(`   页面共 ${inputCount} 个 text input`);

  // Find the input that's inside the detail panel (not the search box)
  // The search input has placeholder "搜索..."
  let formInput;
  for (let i = 0; i < inputCount; i++) {
    const inp = allInputs.nth(i);
    const ph = await inp.getAttribute('placeholder');
    console.log(`   input[${i}] placeholder="${ph}"`);
    if (ph !== '搜索...') {
      formInput = inp;
      break;
    }
  }

  if (!formInput) {
    console.log('   ❌ 找不到表单输入框');
    await page.screenshot({ path: '/tmp/crud-v2-debug.png', fullPage: true });
    await browser.close();
    return;
  }

  await formInput.fill('测试类目_正确');
  await page.waitForTimeout(500);
  console.log('   ✅ 已填写名称');

  // Step 4: save
  console.log('\n4️⃣ 保存...');
  // Capture the SDB response
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/sdb/sql') && r.request().method() === 'POST', { timeout: 10000 }).catch(() => null),
    page.locator('button:has-text("保存")').first().click(),
  ]);

  if (resp) {
    const body = await resp.json();
    const result = body?.[0];
    console.log(`   SDB 状态: ${result?.status}, 耗时: ${result?.time}`);
    if (result?.status === 'OK') console.log('   ✅ CREATE 成功');
    else console.log(`   ❌ SDB 错误: ${JSON.stringify(result).slice(0,200)}`);
  } else {
    console.log('   ⚠️ 未捕获到 SDB 响应');
  }

  await page.waitForTimeout(3000);

  // Check for UI messages
  const bodyText = await page.locator('body').textContent();
  if (bodyText.includes('保存成功')) console.log('   UI: 保存成功 ✅');
  if (bodyText.includes('失败') || bodyText.includes('error')) console.log('   UI: 有错误 ⚠️');

  // Step 5: wait for panel to close, then clear search and reload
  console.log('\n5️⃣ 清空搜索并刷新...');
  // Clear search box
  const searchInput = page.locator('input[placeholder="搜索..."]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('');
    await page.waitForTimeout(1500);
  }

  // Navigate away and back to force fresh load
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const after = await page.locator('tbody tr').count();
  const afterTotal = await page.locator('text=/共 \\d+ 条/').textContent();
  console.log(`   ${after} 行, ${afterTotal}`);

  if (after > before) console.log('\n✅ CRUD 正常！');
  else console.log(`\n❌ CRUD 异常: ${before} → ${after}`);

  await page.screenshot({ path: '/tmp/crud-v2-final.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
