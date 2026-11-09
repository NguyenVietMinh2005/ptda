// src/pages/AdminTransactionsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { Search, CreditCard, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải lịch sử giao dịch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const filteredTransactions = transactions.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      t.MaGiaoDich?.toLowerCase().includes(term) ||
      t.MaDatPhong?.toString().includes(term) ||
      t.NguoiThaoTac?.toLowerCase().includes(term) ||
      t.DAT_PHONG?.NGUOI_DUNG?.HoTen?.toLowerCase().includes(term) ||
      t.DAT_PHONG?.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay?.toLowerCase().includes(term);

    const matchMethod = methodFilter === 'ALL' || t.PhuongThuc === methodFilter;
    return matchSearch && matchMethod;
  });

  const totalSuccessAmount = filteredTransactions
    .filter((t) => t.TrangThai === 'ThanhCong')
    .reduce((sum, t) => sum + parseFloat(t.SoTien || 0), 0);

  return (
    <AdminLayout
      title="Quản Lý Giao Dịch & Thanh Toán"
      subtitle="Nhật ký toàn bộ các giao dịch thanh toán mô phỏng và xác nhận tiền mặt trong cơ sở dữ liệu"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="QR_DEMO">📱 QR Code Demo</option>
            <option value="TIEN_MAT_KHI_NHAN_PHONG">💵 Tiền mặt khi nhận phòng</option>
          </select>

          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm mã GD, mã đơn, tên khách..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button onClick={fetchTransactions} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      {/* Summary Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#EFF6FF',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          border: '1px solid #BFDBFE',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E40AF', textTransform: 'uppercase' }}>
            Tổng số tiền giao dịch thành công (theo bộ lọc)
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E3A8A', marginTop: '0.2rem' }}>
            {totalSuccessAmount.toLocaleString('vi-VN')} đ
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#1E40AF', fontWeight: 600 }}>
          {filteredTransactions.length} giao dịch
        </div>
      </div>

      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Chi tiết lịch sử giao dịch</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã Giao Dịch</th>
                <th>Mã Đơn</th>
                <th>Khách hàng</th>
                <th>Homestay</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
                <th>Người thao tác</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải danh sách giao dịch...
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.MaGiaoDich}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#2563EB' }}>
                      {t.MaGiaoDich}
                    </td>
                    <td style={{ fontWeight: 700 }}>#{t.MaDatPhong}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.DAT_PHONG?.NGUOI_DUNG?.HoTen || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t.DAT_PHONG?.NGUOI_DUNG?.Email}</div>
                    </td>
                    <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.DAT_PHONG?.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay || 'Homestay'}
                    </td>
                    <td style={{ fontWeight: 700, color: '#15803D' }}>
                      {parseFloat(t.SoTien).toLocaleString('vi-VN')} đ
                    </td>
                    <td>
                      <span className="status-pill neutral">
                        {t.PhuongThuc === 'QR_DEMO' ? '📱 QR Code' : '💵 Tiền mặt'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${t.TrangThai === 'ThanhCong' ? 'success' : 'danger'}`}>
                        {t.TrangThai === 'ThanhCong' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {t.TrangThai === 'ThanhCong' ? 'Thành công' : 'Thất bại'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.NguoiThaoTac || 'Hệ thống'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{t.VaiTroNguoiThaoTac || 'user'}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Chưa có giao dịch nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

