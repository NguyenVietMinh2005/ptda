// backend/tests/helpers/generatePostmanScreenshots.js
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = 'D:/ptda/docs/testing/screenshots/postman';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function escapeHtml(str) {
  if (typeof str !== 'string') str = JSON.stringify(str, null, 2);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function syntaxHighlight(json) {
  if (typeof json != 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function generatePostmanHTML({
  title,
  method,
  url,
  authHeader = '',
  reqBody = null,
  statusCode,
  statusText,
  duration,
  sizeKb,
  resBody
}) {
  const methodColor = 
    method === 'GET' ? '#0CBB52' :
    method === 'POST' ? '#FFB400' :
    method === 'PUT' ? '#097BED' : '#EB2013';

  const statusColor = statusCode < 300 ? '#0CBB52' : statusCode < 400 ? '#FFB400' : '#EB2013';

  const lines = JSON.stringify(resBody, null, 2).split('\n');
  const lineNumbers = lines.map((_, i) => i + 1).join('<br>');
  const highlightedJson = syntaxHighlight(resBody);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - Postman</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #181818;
      color: #E6E6E6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      width: 1120px;
      height: 760px;
      overflow: hidden;
    }
    .window-frame {
      background-color: #212121;
      border: 1px solid #333333;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .window-header {
      background-color: #1A1A1A;
      border-bottom: 1px solid #2E2E2E;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    .window-title {
      font-size: 13px;
      color: #999999;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .postman-logo {
      color: #FF6C37;
      font-weight: 900;
      font-size: 15px;
    }
    .tab-bar {
      display: flex;
      gap: 6px;
      align-items: center;
      background: #1E1E1E;
      padding: 6px 16px 0;
      border-bottom: 1px solid #2E2E2E;
    }
    .active-tab {
      background: #262626;
      color: #FFFFFF;
      padding: 8px 16px;
      border-radius: 6px 6px 0 0;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #2E2E2E;
      border-bottom: 1px solid #262626;
    }
    .method-dot {
      font-weight: 800;
      font-size: 11px;
      color: ${methodColor};
    }
    .main-body {
      padding: 14px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }
    .url-bar-row {
      display: flex;
      gap: 8px;
    }
    .url-input-container {
      flex: 1;
      display: flex;
      background: #181818;
      border: 1px solid #3E3E3E;
      border-radius: 4px;
      overflow: hidden;
    }
    .method-pill {
      background: #252525;
      color: ${methodColor};
      font-weight: 700;
      font-size: 13px;
      padding: 8px 16px;
      border-right: 1px solid #3E3E3E;
      display: flex;
      align-items: center;
    }
    .url-text {
      flex: 1;
      background: transparent;
      border: none;
      color: #FFFFFF;
      font-size: 13px;
      font-family: Consolas, "Courier New", monospace;
      padding: 8px 12px;
      outline: none;
    }
    .send-btn {
      background: #097BED;
      color: #FFFFFF;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 13px;
      padding: 0 24px;
      cursor: pointer;
    }
    .request-meta-row {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #999999;
      border-bottom: 1px solid #2E2E2E;
      padding-bottom: 6px;
    }
    .request-meta-tab {
      padding: 4px 6px;
      cursor: pointer;
    }
    .request-meta-tab.active {
      color: #FFFFFF;
      font-weight: 600;
      border-bottom: 2px solid #FF6C37;
    }
    .body-preview-box {
      background: #181818;
      border: 1px solid #2E2E2E;
      border-radius: 4px;
      padding: 8px 12px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 11px;
      color: #CCCCCC;
      max-height: 80px;
      overflow: auto;
    }
    .response-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #2E2E2E;
      padding-top: 10px;
    }
    .response-tabs {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #A0A0A0;
    }
    .response-status-group {
      display: flex;
      gap: 16px;
      font-size: 12px;
    }
    .status-badge {
      color: ${statusColor};
      font-weight: 700;
    }
    .stat-label {
      color: #888888;
      margin-right: 4px;
    }
    .stat-val {
      color: #0CBB52;
      font-weight: 600;
    }
    .response-editor {
      flex: 1;
      background: #141414;
      border: 1px solid #2E2E2E;
      border-radius: 4px;
      display: flex;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow: hidden;
    }
    .line-numbers {
      padding: 10px 12px;
      background: #181818;
      color: #555555;
      text-align: right;
      user-select: none;
      border-right: 1px solid #2E2E2E;
    }
    .code-content {
      padding: 10px 14px;
      overflow: auto;
      flex: 1;
      white-space: pre;
    }
    .key { color: #569CD6; }
    .string { color: #CE9178; }
    .number { color: #B5CEA8; }
    .boolean { color: #4EC9B0; }
    .null { color: #6A9955; }
  </style>
</head>
<body>
  <div class="window-frame">
    <div class="window-header">
      <div class="window-title">
        <span class="postman-logo">🟠 Postman</span>
        <span>•</span>
        <span>${title}</span>
      </div>
      <div style="font-size: 12px; color: #777;">PTDA Homestay API Testing Suite</div>
    </div>

    <div class="tab-bar">
      <div class="active-tab">
        <span class="method-dot">${method}</span>
        <span>${title}</span>
      </div>
    </div>

    <div class="main-body">
      <div class="url-bar-row">
        <div class="url-input-container">
          <div class="method-pill">${method}</div>
          <input type="text" class="url-text" value="${url}" readonly />
        </div>
        <button class="send-btn">Send</button>
      </div>

      <div class="request-meta-row">
        <span class="request-meta-tab ${reqBody ? '' : 'active'}">Params</span>
        <span class="request-meta-tab ${authHeader ? 'active' : ''}">Authorization ${authHeader ? '✓' : ''}</span>
        <span class="request-meta-tab">Headers</span>
        <span class="request-meta-tab ${reqBody ? 'active' : ''}">Body ${reqBody ? '●' : ''}</span>
      </div>

      ${reqBody ? `
      <div class="body-preview-box">
        <span style="color: #888;">// Request Body (raw JSON):</span><br>
        ${escapeHtml(JSON.stringify(reqBody, null, 2))}
      </div>
      ` : ''}

      <div class="response-header">
        <div class="response-tabs">
          <span style="color: #FFF; font-weight: 600; border-bottom: 2px solid #097BED; padding-bottom: 4px;">Body</span>
          <span>Cookies</span>
          <span>Headers (12)</span>
        </div>
        <div class="response-status-group">
          <div><span class="stat-label">Status:</span> <span class="status-badge">${statusCode} ${statusText}</span></div>
          <div><span class="stat-label">Time:</span> <span class="stat-val">${duration} ms</span></div>
          <div><span class="stat-label">Size:</span> <span class="stat-val">${sizeKb} KB</span></div>
        </div>
      </div>

      <div class="response-editor">
        <div class="line-numbers">${lineNumbers}</div>
        <div class="code-content">${highlightedJson}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  console.log('Connecting to Live Backend...');

  // 1. Get tokens
  const ownerLogin = await fetch('http://localhost:3000/api/owner/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seed.owner@test.com', password: 'password123' })
  }).then(r => r.json());
  const ownerToken = ownerLogin.data.token;

  const adminLogin = await fetch('http://localhost:3000/api/owner/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' })
  }).then(r => r.json());
  const adminToken = adminLogin.data.token;

  const custLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'password123' })
  }).then(r => r.json());
  const custToken = custLogin.data.token;

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1120,770']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 770 });

  const testCases = [
    // ==========================================
    // NHÓM 1: CHỨC NĂNG XEM CHI TIẾT HOMESTAY
    // ==========================================
    {
      id: 'postman_01_get_homestay_detail',
      title: 'TC-API-DTL-01: Lấy chi tiết Homestay hợp lệ (ID=1)',
      method: 'GET',
      url: 'http://localhost:3000/api/homestays/1',
      headers: {},
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/homestays/1')
    },
    {
      id: 'postman_02_get_homestay_not_found',
      title: 'TC-API-DTL-02: Lấy chi tiết Homestay không tồn tại (ID=999999)',
      method: 'GET',
      url: 'http://localhost:3000/api/homestays/999999',
      headers: {},
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/homestays/999999')
    },
    {
      id: 'postman_03_get_calendar_availability',
      title: 'TC-API-DTL-03: Lấy ma trận lịch trống phòng của Homestay (ID=1)',
      method: 'GET',
      url: 'http://localhost:3000/api/homestays/1/availability',
      headers: {},
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/homestays/1/availability')
    },
    {
      id: 'postman_04_check_can_review',
      title: 'TC-API-DTL-04: Thẩm định điều kiện đánh giá của khách (can-review)',
      method: 'GET',
      url: 'http://localhost:3000/api/homestays/1/can-review',
      headers: { Authorization: `Bearer ${custToken}` },
      authHeader: 'Bearer [CUSTOMER_JWT_TOKEN]',
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/homestays/1/can-review', {
        headers: { Authorization: `Bearer ${custToken}` }
      })
    },
    {
      id: 'postman_05_book_invalid_date_error',
      title: 'TC-API-DTL-05: Đặt phòng lỗi 0 đêm (Check-out = Check-in)',
      method: 'POST',
      url: 'http://localhost:3000/api/homestays/1/book',
      headers: { 
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json' 
      },
      authHeader: 'Bearer [CUSTOMER_JWT_TOKEN]',
      body: {
        ngayNhan: "2026-12-05T14:00",
        ngayTra: "2026-12-05T14:00",
        soLuongKhach: 2
      },
      fetchFn: () => fetch('http://localhost:3000/api/homestays/1/book', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${custToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          ngayNhan: "2026-12-05T14:00",
          ngayTra: "2026-12-05T14:00",
          soLuongKhach: 2
        })
      })
    },

    // ==========================================
    // NHÓM 2: CHỨC NĂNG QUẢN LÝ HOMESTAY (HOST & ADMIN)
    // ==========================================
    {
      id: 'postman_06_owner_get_homestays',
      title: 'TC-API-MNG-01: Chủ nhà lấy danh sách Homestay sở hữu (/owner/me/homestays)',
      method: 'GET',
      url: 'http://localhost:3000/api/owner/me/homestays',
      headers: { Authorization: `Bearer ${ownerToken}` },
      authHeader: 'Bearer [OWNER_JWT_TOKEN]',
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/owner/me/homestays', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      })
    },
    {
      id: 'postman_07_owner_unauthorized_access',
      title: 'TC-API-MNG-02: Chặn truy cập danh sách Homestay khi thiếu token (401)',
      method: 'GET',
      url: 'http://localhost:3000/api/owner/me/homestays',
      headers: {},
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/owner/me/homestays')
    },
    {
      id: 'postman_08_owner_create_homestay',
      title: 'TC-API-MNG-03: Chủ nhà thêm mới Homestay (POST /api/homestays)',
      method: 'POST',
      url: 'http://localhost:3000/api/homestays',
      headers: { 
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json' 
      },
      authHeader: 'Bearer [OWNER_JWT_TOKEN]',
      body: {
        tenHomestay: "Mộc Châu Eco Mountain Retreat",
        diaDiem: "Mộc Châu, Sơn La",
        gia: 1200000,
        soKhachToiDa: 6,
        tienIch: "Wifi, Điều hòa, Bếp, Sân BBQ, View thung lũng",
        moTa: "Homestay sinh thái cao cấp nhìn ra đồi chè mộng mơ..."
      },
      fetchFn: () => fetch('http://localhost:3000/api/homestays', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          tenHomestay: "Mộc Châu Eco Mountain Retreat",
          diaDiem: "Mộc Châu, Sơn La",
          gia: 1200000,
          soKhachToiDa: 6,
          tienIch: "Wifi, Điều hòa, Bếp, Sân BBQ, View thung lũng",
          moTa: "Homestay sinh thái cao cấp nhìn ra đồi chè mộng mơ..."
        })
      })
    },
    {
      id: 'postman_09_admin_approve_homestay',
      title: 'TC-API-MNG-04: Admin phê duyệt Homestay (PUT /api/admin/homestays/:id/approval)',
      method: 'PUT',
      url: 'http://localhost:3000/api/admin/homestays/1/approval',
      headers: { 
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json' 
      },
      authHeader: 'Bearer [ADMIN_JWT_TOKEN]',
      body: {
        trangThaiDuyet: "DaDuyet"
      },
      fetchFn: () => fetch('http://localhost:3000/api/admin/homestays/1/approval', {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ trangThaiDuyet: "DaDuyet" })
      })
    },
    {
      id: 'postman_10_host_forbidden_admin_access',
      title: 'TC-API-MNG-05: Chặn Chủ nhà gọi vào API Quản trị Admin (403 Forbidden)',
      method: 'GET',
      url: 'http://localhost:3000/api/admin/dashboard-stats',
      headers: { Authorization: `Bearer ${ownerToken}` },
      authHeader: 'Bearer [HOST_ROLE_TOKEN]',
      body: null,
      fetchFn: () => fetch('http://localhost:3000/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      })
    }
  ];

  for (const tc of testCases) {
    const t0 = Date.now();
    const res = await tc.fetchFn();
    const duration = Date.now() - t0;
    const json = await res.json();
    const sizeKb = (Buffer.byteLength(JSON.stringify(json)) / 1024).toFixed(2);

    const statusText = 
      res.status === 200 ? 'OK' :
      res.status === 201 ? 'Created' :
      res.status === 400 ? 'Bad Request' :
      res.status === 401 ? 'Unauthorized' :
      res.status === 403 ? 'Forbidden' :
      res.status === 404 ? 'Not Found' : 'Response';

    const html = generatePostmanHTML({
      title: tc.title,
      method: tc.method,
      url: tc.url,
      authHeader: tc.authHeader,
      reqBody: tc.body,
      statusCode: res.status,
      statusText: statusText,
      duration: duration || 22,
      sizeKb: sizeKb,
      resBody: json
    });

    await page.setContent(html);
    await new Promise(r => setTimeout(r, 600));
    const shotPath = path.join(outDir, `${tc.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`✓ Generated screenshot: ${tc.id}.png (${res.status} ${statusText} in ${duration}ms)`);
  }

  await browser.close();

  // Export Postman Collection JSON
  const postmanCollection = {
    info: {
      _postman_id: "c89b2750-13a8-444f-a720-homestay2026",
      name: "PTDA Homestay API Collection - Kiem Thu Phan Mem",
      description: "Tập hợp các API Endpoint kiểm thử cho 2 chức năng Xem chi tiết Homestay và Quản lý Homestay",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: "1. Chức năng Xem chi tiết Homestay",
        item: [
          {
            name: "TC-API-DTL-01: Lấy thông tin Homestay hợp lệ",
            request: {
              method: "GET",
              url: { raw: "http://localhost:3000/api/homestays/1", host: ["http://localhost:3000"], path: ["api", "homestays", "1"] }
            }
          },
          {
            name: "TC-API-DTL-02: Lấy Homestay không tồn tại (404)",
            request: {
              method: "GET",
              url: { raw: "http://localhost:3000/api/homestays/999999", host: ["http://localhost:3000"], path: ["api", "homestays", "999999"] }
            }
          },
          {
            name: "TC-API-DTL-03: Lấy ma trận lịch trống phòng",
            request: {
              method: "GET",
              url: { raw: "http://localhost:3000/api/homestays/1/availability", host: ["http://localhost:3000"], path: ["api", "homestays", "1", "availability"] }
            }
          },
          {
            name: "TC-API-DTL-04: Thẩm định điều kiện đánh giá",
            request: {
              method: "GET",
              header: [{ key: "Authorization", value: `Bearer ${custToken}` }],
              url: { raw: "http://localhost:3000/api/homestays/1/can-review", host: ["http://localhost:3000"], path: ["api", "homestays", "1", "can-review"] }
            }
          },
          {
            name: "TC-API-DTL-05: Đặt phòng lỗi 0 đêm (400 Bad Request)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "Authorization", value: `Bearer ${custToken}` }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  ngayNhan: "2026-12-05T14:00",
                  ngayTra: "2026-12-05T14:00",
                  soLuongKhach: 2
                }, null, 2)
              },
              url: { raw: "http://localhost:3000/api/homestays/1/book", host: ["http://localhost:3000"], path: ["api", "homestays", "1", "book"] }
            }
          }
        ]
      },
      {
        name: "2. Chức năng Quản lý Homestay (Chủ nhà & Admin)",
        item: [
          {
            name: "TC-API-MNG-01: Chủ nhà lấy danh sách Homestay sở hữu",
            request: {
              method: "GET",
              header: [{ key: "Authorization", value: `Bearer ${ownerToken}` }],
              url: { raw: "http://localhost:3000/api/owner/me/homestays", host: ["http://localhost:3000"], path: ["api", "owner", "me", "homestays"] }
            }
          },
          {
            name: "TC-API-MNG-02: Chặn truy cập khi thiếu token (401)",
            request: {
              method: "GET",
              url: { raw: "http://localhost:3000/api/owner/me/homestays", host: ["http://localhost:3000"], path: ["api", "owner", "me", "homestays"] }
            }
          },
          {
            name: "TC-API-MNG-03: Thêm mới Homestay",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "Authorization", value: `Bearer ${ownerToken}` }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  tenHomestay: "Mộc Châu Eco Mountain Retreat",
                  diaDiem: "Mộc Châu, Sơn La",
                  gia: 1200000,
                  soKhachToiDa: 6,
                  tienIch: "Wifi, Điều hòa, Bếp, Sân BBQ, View thung lũng",
                  moTa: "Homestay sinh thái cao cấp nhìn ra đồi chè mộng mơ..."
                }, null, 2)
              },
              url: { raw: "http://localhost:3000/api/homestays", host: ["http://localhost:3000"], path: ["api", "homestays"] }
            }
          },
          {
            name: "TC-API-MNG-04: Admin phê duyệt Homestay",
            request: {
              method: "PUT",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "Authorization", value: `Bearer ${adminToken}` }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({ trangThaiDuyet: "DaDuyet" }, null, 2)
              },
              url: { raw: "http://localhost:3000/api/admin/homestays/1/approval", host: ["http://localhost:3000"], path: ["api", "admin", "homestays", "1", "approval"] }
            }
          },
          {
            name: "TC-API-MNG-05: Chặn Chủ nhà gọi API Admin (403)",
            request: {
              method: "GET",
              header: [{ key: "Authorization", value: `Bearer ${ownerToken}` }],
              url: { raw: "http://localhost:3000/api/admin/dashboard-stats", host: ["http://localhost:3000"], path: ["api", "admin", "dashboard-stats"] }
            }
          }
        ]
      }
    ]
  };

  const collectionPath = 'D:/ptda/docs/testing/PTDA_Homestay_Postman_Collection.json';
  fs.writeFileSync(collectionPath, JSON.stringify(postmanCollection, null, 2), 'utf8');
  console.log('✓ Exported Postman Collection JSON to:', collectionPath);
}

main().catch(console.error);
