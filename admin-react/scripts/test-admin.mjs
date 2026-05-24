// 流通处管理后台 — 全页面审计 + 功能测试
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://admin.rufazao.com/v5/';
const AUTH = { username: 'admin', password: 'admin123' };
const OUTDIR = '/tmp/hermes-audit';

const PAGES = [
  { path: '', label: '首页', group: '-' },
  { path: '#/tables/sales_order', label: '销售订单', group: '日常销售' },
  { path: '#/tables/product', label: '商品列表', group: '商品管理' },
  { path: '#/tables/product_category', label: '产品类目', group: '商品管理' },
  { path: '#/tables/pricing', label: '定价', group: '商品管理' },
  { path: '#/tables/store_inventory', label: '库存查看', group: '库存管理' },
  { path: '#/tables/inventory_count', label: '盘点', group: '库存管理' },
  { path: '#/tables/restock_request', label: '补货', group: '库存管理' },
  { path: '#/tables/customer', label: '会员列表', group: '会员管理' },
  { path: '#/tables/carousel', label: '轮播图', group: '商城设置' },
  { path: '#/tables/featured_product', label: '推荐商品', group: '商城设置' },
  { path: '#/tables/store_info', label: '流通处信息', group: '商城设置' },
  { path: '#/tables/announcement', label: '公告', group: '商城设置' },
];

function okBadge(ok) { return ok ? '✅' : '❌'; }

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  const form = await page.locator('input[placeholder="输入用户名"]').count();
  if (form === 0) {
    console.log('  已在登录态，跳过');
    return true;
  }

  await page.fill('input[placeholder="输入用户名"]', AUTH.username);
  await page.fill('input[placeholder="输入密码"]', AUTH.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  const sidebar = await page.locator('text=流通处').first().count();
  if (sidebar === 0) {
    // 截图看看当前状态
    await page.screenshot({ path: `${OUTDIR}/login-fail.png` });
  }
  return sidebar > 0;
}

async function auditPage(page, item, results) {
  const entry = { ...item, ok: false, rows: 0, errors: [], bodyLen: 0, hasTable: false };

  try {
    if (item.path) await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    // re-login if needed
    if (await page.locator('input[placeholder="输入用户名"]').count() > 0) {
      console.log(`  ⚠️ 重新登录...`);
      await login(page);
      if (item.path) await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
    }

    entry.bodyLen = (await page.locator('body').textContent()).length;
    entry.hasTable = await page.locator('table').count() > 0;

    if (entry.hasTable) {
      entry.rows = await page.locator('tbody tr').count();
    }

    const emptyState = await page.locator('text=暂无数据').count();

    const safeLabel = item.label.replace(/[/:]/g, '_');
    await page.screenshot({ path: `${OUTDIR}/${safeLabel}.png`, fullPage: true });

    if (entry.hasTable && entry.rows > 0) {
      entry.ok = true;
    } else if (emptyState > 0 || (entry.hasTable && entry.rows === 0)) {
      entry.ok = true;
      entry.note = '无数据';
    } else if (!entry.hasTable && entry.bodyLen > 200) {
      entry.ok = true;
      entry.note = '无表格(首页)';
    }

  } catch (e) {
    entry.errors.push(e.message);
  }

  results.push(entry);
  const icon = okBadge(entry.ok);
  const note = entry.note || (entry.hasTable ? `${entry.rows}条` : '-');
  console.log(`  ${icon} ${item.label.padEnd(12)} ${note}${entry.errors.length ? ' ERR:' + entry.errors[0].slice(0, 80) : ''}`);
}

async function testCRUD(page) {
  console.log('\n🔧 功能测试：CRUD（在 产品类目 上测试）');
  const TABLE_URL = `${BASE}#/tables/product_category`;

  await page.goto(TABLE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const before = await page.locator('tbody tr').count();
  console.log(`  现有类目: ${before} 条`);

  // 1. CREATE
  const newBtn = page.locator('button:has-text("新建")');
  if (await newBtn.count() === 0) {
    console.log('  ❌ 无新建按钮');
    return;
  }

  await newBtn.first().click();
  await page.waitForTimeout(1500);

  // Try to find any modal/panel
  const panel = page.locator('text=新建').first();
  const panelCount = await panel.count();
  console.log(`  ${okBadge(panelCount > 0)} 新建弹窗`);

  if (panelCount > 0) {
    // Fill the FORM input inside the drawer (skip search box)
    const allInputs = page.locator('input[type="text"]');
    const n = await allInputs.count();
    let formInput = null;
    for (let i = 0; i < n; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder');
      if (ph !== '搜索...') { formInput = inp; break; }
    }
    if (formInput) {
      await formInput.fill('测试类目_CRUD');
      await page.waitForTimeout(500);
    }

    const saveBtn = page.locator('button:has-text("保存")');
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click();
      await page.waitForTimeout(2000);
      console.log('  ✅ 点击保存');
    }
  }

  // Close panel
  const closeBtn = page.locator('button:has-text("关闭")').last();
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(2000);
  }

  // Clear search before verifying
  const srch = page.locator('input[placeholder="搜索..."]');
  if (await srch.count() > 0) { await srch.fill(''); await page.waitForTimeout(1000); }

  // Verify create — force fresh load
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(500);
  await page.goto(TABLE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const after = await page.locator('tbody tr').count();
  console.log(`  ${okBadge(after > before)} 新增确认: ${before} → ${after}`);

  // 2. SEARCH
  const searchInput = page.locator('input[placeholder="搜索..."]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('测试类目');
    await page.waitForTimeout(2000);
    const hits = await page.locator('tbody tr').count();
    console.log(`  ${okBadge(hits > 0)} 搜索: ${hits} 条`);
    await searchInput.fill('');
    await page.waitForTimeout(2000);
  }

  // 3. VIEW DETAIL
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(2000);
    const detailHasContent = (await page.locator('body').textContent()).length > 300;
    console.log(`  ${okBadge(detailHasContent)} 查看详情`);
    const close = page.locator('button:has-text("关闭")').last();
    if (await close.count() > 0) {
      await close.click();
      await page.waitForTimeout(1000);
    }
  }

  // 4. PAGINATION
  const pageInfo = page.locator('text=/\\d+ \\/ \\d+/');
  if (await pageInfo.count() > 0) {
    console.log(`  ℹ️ 分页: ${await pageInfo.first().textContent()}`);
  }
}

// ── Main ──
async function main() {
  mkdirSync(OUTDIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()) });

  console.log('═══════════════════════════════════════');
  console.log('  流通处管理后台 — 全面审计');
  console.log('═══════════════════════════════════════');

  console.log('\n🔑 登录...');
  const ok = await login(page);
  if (!ok) { console.log('❌ 登录失败'); await browser.close(); return; }
  console.log('  ✅ 登录成功');

  console.log('\n📋 页面审计...');
  const results = [];
  for (const item of PAGES) {
    await auditPage(page, item, results);
  }

  await testCRUD(page);

  console.log('\n🐛 JS 错误:');
  const unique = [...new Set(jsErrors)];
  if (unique.length === 0) console.log('  无 ✅');
  else unique.forEach(e => console.log(`  ❌ ${e.slice(0, 150)}`));

  console.log('\n═══════════════════════════════════════');
  const pass = results.filter(r => r.ok).length;
  console.log(`  通过: ${pass}/${results.length}`);
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log('  失败:');
    failed.forEach(f => console.log(`    ❌ ${f.label}: ${f.note || f.errors[0] || '?'}`));
  }
  if (unique.length > 0) console.log(`  JS错误: ${unique.length} 个`);
  console.log(`  截图: ${OUTDIR}/`);

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
