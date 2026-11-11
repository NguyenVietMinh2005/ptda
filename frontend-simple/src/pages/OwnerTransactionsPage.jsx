// src/pages/OwnerTransactionsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import { Search, CreditCard, RefreshCw, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/transactions`;

export default function OwnerTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải lịch sử giao dịch.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = transactions.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      t.MaGiaoDich?.toLowerCase().includes(term) ||
      t.MaDatPhong?.toString().includes(term) ||
      t.DAT_PHONG?.NGUOI_DUNG?.HoTen?.toLowerCase().includes(term) ||
      t.DAT_PHONG?.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay?.toLowerCase().includes(term);

    const matchMethod = methodFilter === 'ALL' || t.PhuongThuc === methodFilter;
    return matchSearch && matchMethod;
  });

  const totalSuccess = filteredTransactions
    .filter((t) => t.TrangThai === 'ThanhCong')
    .reduce((sum, t) => sum + parseFloat(t.SoTien || 0), 0);

  return (
    <OwnerLayout
      title="Lịch Sử Giao Dịch & Dòng Tiền"
      subtitle="Theo dõi chi tiết các khoản thanh toán từ khách hàng qua mã QR demo và tiền mặt"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E8E2D7',
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
      {/* Total Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F0FDF4',
          padding: '1.25rem 1.5rem',
          borderRadius: '14px',
          border: '1px solid #BBF7D0',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
            Tổng tiền đã thu về (theo bộ lọc)
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#14532D', marginTop: '0.2rem' }}>
            {totalSuccess.toLocaleString('vi-VN')} đ
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 700 }}>
          {filteredTransactions.length} giao dịch
        </div>
      </div>

      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Chi tiết lịch sử thanh toán</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Đơn Đặt</th>
                <th>Khách hàng</th>
                <th>Homestay</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#5C6861' }}>
                    Đang tải danh sách giao dịch...
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.MaGiaoDich}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#1C3B2B' }}>
                      {t.MaGiaoDich}
                    </td>
                    <td style={{ fontWeight: 700 }}>#{t.DAT_PHONG?.MaDatPhong}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.DAT_PHONG?.NGUOI_DUNG?.HoTen || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#5C6861' }}>{t.DAT_PHONG?.NGUOI_DUNG?.SoDienThoai}</div>
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
                    <td style={{ fontSize: '0.8rem', color: '#5C6861' }}>
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#5C6861' }}>
                    Chưa có giao dịch thanh toán nào được ghi nhận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerLayout>
  );
}

