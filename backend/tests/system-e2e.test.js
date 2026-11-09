// backend/tests/system-e2e.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../../docs/testing/screenshots');

const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';

describe('Level 3: System Testing (Kiểm thử toàn diện Hệ thống & Giao diện End-to-End)', () => {
  let puppeteer = null;
  let browser = null;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  before(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    try {
      const p = await import('puppeteer-core');
      puppeteer = p.default;
      if (fs.existsSync(chromePath)) {
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
        });
        console.log('✓ Puppeteer Browser initialized with Google Chrome.');
      }
    } catch (e) {
      console.log('Puppeteer browser not launchable, falling back to HTTP verification:', e.message);
    }
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // =========================================================================
  // SCENARIO 1: Live Infrastructure & Service Connectivity Check
  // =========================================================================
  describe('System Scenario 1: Hạ tầng & Kết nối Live Service', () => {
    it('SYS-01: Backend Server is live on port 3000 and responds to root request', async () => {
      const res = await fetch(`${BACKEND_URL}/`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('Homestay API'));
    });

    it('SYS-02: Frontend Vite Server is live on port 5173 and serves index.html', async () => {
      const res = await fetch(`${FRONTEND_URL}/`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('<div id="root">') || html.includes('vite'));
    });
  });

  // =========================================================================
  // SCENARIO 2: Customer Homepage, Search & Detail Flow
  // =========================================================================
  describe('System Scenario 2: Khách hàng Khám phá, Tìm kiếm & Xem chi tiết', () => {
    it('SYS-03: Fetches approved homestays from live database via API', async () => {
      const res = await fetch(`${BACKEND_URL}/api/homestays`);
      assert.equal(res.status, 200);
      const json = await res.json();
      const homestays = json.data;
      assert.ok(Array.isArray(homestays));
      assert.ok(homestays.length > 0, 'Database should contain seeded homestays');
      
      const firstHs = homestays[0];
      assert.ok(firstHs.TenHomestay);
      assert.ok(firstHs.Gia);
      assert.equal(firstHs.TrangThaiDuyet, 'DaDuyet');
    });

    it('SYS-04: Fetches single homestay details with photos and host info', async () => {
      const res = await fetch(`${BACKEND_URL}/api/homestays/1`);
      assert.equal(res.status, 200);
      const json = await res.json();
      const hs = json.data;
      assert.equal(hs.MaHomestay, 1);
      assert.ok(Array.isArray(hs.HINH_ANH));
      assert.ok(hs.CHU_HOMESTAY);
    });

    it('SYS-05: Fetches homestay calendar availability matrix', async () => {
      const res = await fetch(`${BACKEND_URL}/api/homestays/1/availability`);
      assert.equal(res.status, 200);
      const avail = await res.json();
      assert.equal(avail.homestayId, 1);
      assert.ok(Array.isArray(avail.bookedRanges));
    });

    it('SYS-06: Browser renders Homepage and captures screenshot', async () => {
      if (!browser) return;
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1500));
      
      const screenshotPath = path.join(screenshotsDir, '01_customer_home.png');
      await page.screenshot({ path: screenshotPath });
      assert.ok(fs.existsSync(screenshotPath));
      await page.close();
    });

    it('SYS-07: Browser renders Homestay Detail page and captures screenshot', async () => {
      if (!browser) return;
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${FRONTEND_URL}/homestays/1`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const screenshotPath = path.join(screenshotsDir, '02_homestay_detail.png');
      await page.screenshot({ path: screenshotPath });
      assert.ok(fs.existsSync(screenshotPath));
      await page.close();
    });
  });

  // =========================================================================
  // SCENARIO 3: Customer Authentication & Booking Validation
  // =========================================================================
  describe('System Scenario 3: Xác thực Khách hàng & Kiểm tra quy tắc Đặt phòng', () => {
    let customerToken = null;

    it('SYS-08: Customer logs in via POST /api/auth/login and receives valid JWT token', async () => {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@test.com',
          password: 'password123',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.token);
      customerToken = json.data.token;
    });

    it('SYS-09: Authenticated customer retrieves profile via /api/auth/me', async () => {
      assert.ok(customerToken, 'Customer token required');
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.user.Email, 'user@test.com');
    });

    it('SYS-10: Booking with invalid date (check-out <= check-in) is rejected with 400', async () => {
      assert.ok(customerToken);
      const res = await fetch(`${BACKEND_URL}/api/homestays/1/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          ngayNhan: '2026-12-05',
          ngayTra: '2026-12-05', // 0 đêm
          soLuongKhach: 2,
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.message.includes('ít nhất 1 đêm'));
    });

    it('SYS-11: Booking exceeding maximum guests limit is rejected with 400', async () => {
      assert.ok(customerToken);
      const res = await fetch(`${BACKEND_URL}/api/homestays/1/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          ngayNhan: '2026-12-01',
          ngayTra: '2026-12-03',
          soLuongKhach: 99, // Vượt quá sức chứa
        }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.message.includes('vượt quá mức cho phép'));
    });
  });

  // =========================================================================
  // SCENARIO 4: Owner Portal Operations
  // =========================================================================
  describe('System Scenario 4: Phân hệ Quản trị Chủ Homestay (Host Portal)', () => {
    let ownerToken = null;

    it('SYS-12: Host logs in via POST /api/owner/login and receives JWT with role chu_homestay', async () => {
      const res = await fetch(`${BACKEND_URL}/api/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'seed.owner@test.com',
          password: 'password123',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.token);
      ownerToken = json.data.token;
    });

    it('SYS-13: Host accesses their owned homestays list via /api/owner/me/homestays', async () => {
      assert.ok(ownerToken);
      const res = await fetch(`${BACKEND_URL}/api/owner/me/homestays`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      const homestays = json.data;
      assert.ok(Array.isArray(homestays));
      assert.ok(homestays.length > 0);
    });

    it('SYS-14: Host accesses their booking management dashboard via /api/owner/me/dashboard-stats', async () => {
      assert.ok(ownerToken);
      const res = await fetch(`${BACKEND_URL}/api/owner/me/dashboard-stats`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data !== null && typeof data === 'object');
    });

    it('SYS-15: Browser renders Host Dashboard and captures screenshot', async () => {
      if (!browser) return;
      assert.ok(ownerToken, 'Host token is required');
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${FRONTEND_URL}/owner/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Cung cấp session hợp lệ cho localStorage để ProtectedRoute xác thực
      await page.evaluate((token) => {
        localStorage.setItem('ownerAuthToken', token);
        localStorage.setItem('ownerAuthUser', JSON.stringify({
          MaChuHomestay: 1,
          HoTen: 'Nguyễn Văn Minh',
          Email: 'seed.owner@test.com',
          Quyen: 'chu_homestay'
        }));
      }, ownerToken);

      await page.goto(`${FRONTEND_URL}/owner/dashboard`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));

      const screenshotPath = path.join(screenshotsDir, '03_owner_dashboard.png');
      await page.screenshot({ path: screenshotPath });
      assert.ok(fs.existsSync(screenshotPath));
      await page.close();
    });
  });

  // =========================================================================
  // SCENARIO 5: Admin Governance & Portal Operations
  // =========================================================================
  describe('System Scenario 5: Phân hệ Quản trị viên Toàn hệ thống (Admin Portal)', () => {
    let adminToken = null;

    it('SYS-16: Admin logs in via POST /api/owner/login with admin role credentials', async () => {
      const res = await fetch(`${BACKEND_URL}/api/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@test.com',
          password: 'password123',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.token);
      assert.equal(json.data.owner.Quyen, 'admin');
      adminToken = json.data.token;
    });

    it('SYS-17: Admin fetches system-wide statistical dashboard via /api/admin/dashboard-stats', async () => {
      assert.ok(adminToken);
      const res = await fetch(`${BACKEND_URL}/api/admin/dashboard-stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.totalHomestays >= 24);
      assert.ok(json.data.totalUsers >= 1);
    });

    it('SYS-18: Admin fetches user management list via /api/admin/users', async () => {
      assert.ok(adminToken);
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data));
    });

    it('SYS-19: Browser renders Admin Dashboard and captures screenshot', async () => {
      if (!browser) return;
      assert.ok(adminToken, 'Admin token is required');
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${FRONTEND_URL}/owner/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Cung cấp session hợp lệ cho localStorage để ProtectedRoute xác thực quyền Admin
      await page.evaluate((token) => {
        localStorage.setItem('ownerAuthToken', token);
        localStorage.setItem('ownerAuthUser', JSON.stringify({
          MaChuHomestay: 18,
          HoTen: 'Quản Trị Viên',
          Email: 'admin@test.com',
          Quyen: 'admin'
        }));
      }, adminToken);

      await page.goto(`${FRONTEND_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));

      const screenshotPath = path.join(screenshotsDir, '04_admin_dashboard.png');
      await page.screenshot({ path: screenshotPath });
      assert.ok(fs.existsSync(screenshotPath));
      await page.close();
    });
  });

  // =========================================================================
  // SCENARIO 6: Role Security Barrier & Error Handling
  // =========================================================================
  describe('System Scenario 6: Hàng rào Bảo mật Phân quyền & Phòng thủ Lỗi', () => {
    it('SYS-20: Customer token is forbidden from accessing Admin Dashboard (returns 401/403)', async () => {
      // Đăng nhập khách lấy token
      const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', password: 'password123' }),
      });
      const { data } = await loginRes.json();

      // Cố tình gọi API Admin
      const adminRes = await fetch(`${BACKEND_URL}/api/admin/dashboard-stats`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      assert.ok(adminRes.status === 401 || adminRes.status === 403);
    });

    it('SYS-21: Host token is forbidden from accessing Admin Dashboard (returns 403 Forbidden)', async () => {
      const loginRes = await fetch(`${BACKEND_URL}/api/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'seed.owner@test.com', password: 'password123' }),
      });
      const { data } = await loginRes.json();

      const adminRes = await fetch(`${BACKEND_URL}/api/admin/dashboard-stats`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      assert.equal(adminRes.status, 403);
      const json = await adminRes.json();
      assert.equal(json.message, 'Không có quyền truy cập.');
    });

    it('SYS-22: Non-existent endpoints return 404 cleanly without server crash', async () => {
      const res = await fetch(`${BACKEND_URL}/api/non-existent-route-xyz`);
      assert.equal(res.status, 404);
    });
  });
});

