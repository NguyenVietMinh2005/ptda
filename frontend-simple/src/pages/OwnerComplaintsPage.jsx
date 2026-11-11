// src/pages/OwnerComplaintsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../components/OwnerLayout';
import { AlertTriangle, CheckCircle2, Send, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../App.css';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/complaints`;
const RESOLVE_API_URL = `${API_BASE_URL}/complaints`;

export default function OwnerComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolutionMessages, setResolutionMessages] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerAuthToken');

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplaints(response.data.data || []);
    } catch {
      toast.error('Không thể tải danh sách khiếu nại.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập với tư cách Chủ Homestay.');
      navigate('/owner/login');
      return;
    }
    fetchComplaints();
  }, [token, navigate, fetchComplaints]);

  const handleResolve = async (complaintId) => {
    const ketQua = resolutionMessages[complaintId];

    if (!ketQua || ketQua.trim() === '') {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    try {
      await axios.post(
        `${RESOLVE_API_URL}/${complaintId}/resolve`,
        { ketQua },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Gửi phản hồi khiếu nại thành công!');
      setResolutionMessages((prev) => ({ ...prev, [complaintId]: '' }));
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi phản hồi thất bại.');
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter === 'ALL') return true;
    return c.TrangThai === statusFilter;
  });

  return (
    <OwnerLayout
      title="Khiếu Nại Từ Khách Hàng"
      subtitle="Giải quyết các phản ánh và hỗ trợ khách hàng để nâng cao uy tín cho homestay"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E8E2D7',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả khiếu nại</option>
            <option value="ChuaXuLy">⚠️ Chưa phản hồi</option>
            <option value="DaXuLy">✅ Đã giải quyết</option>
          </select>

          <button onClick={fetchComplaints} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang tải dữ liệu khiếu nại...
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="data-table-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#1C3B2B', marginBottom: '0.5rem' }}>Tuyệt vời! Không có khiếu nại nào</h3>
          <p style={{ color: '#5C6861' }}>Chất lượng dịch vụ homestay của bạn đang được khách hàng hài lòng.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredComplaints.map((c) => (
            <div
              key={c.MaKhieuNai}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E8E2D7',
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(28, 59, 43, 0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1C3B2B' }}>
                      Khiếu nại #{c.MaKhieuNai}
                    </span>
                    <span style={{ fontSize: '0.88rem', color: '#5C6861' }}>
                      (Đơn đặt: #{c.DAT_PHONG?.MaDatPhong})
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#5C6861', marginTop: '0.25rem' }}>
                    Người gửi: <strong>{c.NGUOI_DUNG?.HoTen}</strong> ({c.NGUOI_DUNG?.Email}) &bull;{' '}
                    {new Date(c.NgayTao).toLocaleString('vi-VN')}
                  </div>
                </div>

                <span className={`status-pill ${c.TrangThai === 'DaXuLy' ? 'success' : 'danger'}`}>
                  {c.TrangThai === 'DaXuLy' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {c.TrangThai === 'DaXuLy' ? 'Đã giải quyết' : 'Chưa phản hồi'}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#FAF8F5',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid #E8E2D7',
                  marginBottom: '1rem',
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  color: '#1C231F'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#5C6861', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Nội dung phản ánh từ khách:
                </div>
                {c.NoiDung}
              </div>

              {c.XU_LY_KHIEU_NAI && c.XU_LY_KHIEU_NAI.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: '1px solid #BBF7D0',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534', marginBottom: '0.3rem' }}>
                    Nội dung phản hồi giải quyết:
                  </div>
                  {c.XU_LY_KHIEU_NAI.map((xl) => (
                    <div key={xl.MaXuLy} style={{ fontSize: '0.9rem', color: '#14532D' }}>
                      {xl.KetQua} &bull; <small style={{ color: '#166534' }}>{new Date(xl.NgayXuLy).toLocaleString('vi-VN')}</small>
                    </div>
                  ))}
                </div>
              )}

              {c.TrangThai !== 'DaXuLy' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F0ECE4' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.5rem' }}>
                    Phản hồi giải quyết cho khách hàng:
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Nhập hướng xử lý (ví dụ: Chủ nhà đã xin lỗi và miễn phí dịch vụ ăn uống...)"
                      value={resolutionMessages[c.MaKhieuNai] || ''}
                      onChange={(e) =>
                        setResolutionMessages((prev) => ({
                          ...prev,
                          [c.MaKhieuNai]: e.target.value
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid #E8E2D7',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => handleResolve(c.MaKhieuNai)}
                      className="button-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 600
                      }}
                    >
                      <Send size={15} /> Gửi giải quyết
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </OwnerLayout>
  );
}