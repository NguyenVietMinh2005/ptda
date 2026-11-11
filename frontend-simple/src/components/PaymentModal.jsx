// src/components/PaymentModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  X, QrCode, Banknote, ShieldAlert, CheckCircle2, 
  AlertCircle, History, RefreshCw, Calendar, Users, Home 
} from 'lucide-react';

import { API_BASE_URL } from '../utils/apiConfig';

const API_BASE = `${API_BASE_URL}/bookings`;

export default function PaymentModal({ bookingId, onClose, onPaymentSuccess }) {
  const [loading, setLoading] = useState(true);
  const [payInfo, setPayInfo] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('ChuyenKhoanQR');
  const [actionLoading, setActionLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const token = localStorage.getItem('authToken');

  const fetchPaymentInfo = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/${bookingId}/payment-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayInfo(res.data.data);
      if (res.data.data.phuongThucThanhToan) {
        setSelectedMethod(res.data.data.phuongThucThanhToan);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải thông tin thanh toán');
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    if (bookingId) {
      fetchPaymentInfo();
    }
  }, [bookingId, fetchPaymentInfo]);

  // Khách chọn phương thức Tiền mặt
  const handleSelectCashMethod = async () => {
    try {
      setActionLoading(true);
      await axios.post(
        `${API_BASE}/${bookingId}/payment/select-method`,
        { method: 'TienMat' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Đã lưu lựa chọn Thanh toán tiền mặt khi nhận phòng!');
      fetchPaymentInfo();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu phương thức thanh toán');
    } finally {
      setActionLoading(false);
    }
  };

  // Khách mô phỏng thanh toán QR (Thành công hoặc Thất bại)
  const handleSimulatePayment = async (resultType) => {
    try {
      setActionLoading(true);
      const payload = {
        result: resultType,
        reason: resultType === 'failed' 
          ? 'Mô phỏng lỗi giao dịch: Tài khoản không đủ số dư hoặc người dùng hủy thao tác' 
          : undefined
      };

      await axios.post(
        `${API_BASE}/${bookingId}/payment/simulate`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (resultType === 'success') {
        toast.success('🎉 Mô phỏng thanh toán THÀNH CÔNG! Trạng thái đã cập nhật.');
        fetchPaymentInfo();
        if (onPaymentSuccess) onPaymentSuccess();
      } else {
        toast.error('Giao dịch mô phỏng THẤT BẠI (đã lưu lịch sử vào hệ thống).');
        fetchPaymentInfo();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi khi mô phỏng thanh toán';
      toast.error(msg);
      fetchPaymentInfo();
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header Modal */}
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1b3b22' }}>
              Thanh toán Đơn đặt phòng #{bookingId}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#666' }}>
              Mô phỏng quy trình thanh toán cho đồ án (Demo)
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <RefreshCw size={28} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12 }}>Đang tải thông tin thanh toán...</p>
          </div>
        ) : !payInfo ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
            Không tìm thấy thông tin thanh toán cho đơn này.
          </div>
        ) : (
          <div style={styles.body}>
            {/* Tóm tắt đơn đặt phòng */}
            <div style={styles.summaryCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Home size={18} color="#2d5a27" />
                <strong style={{ fontSize: '1.05rem', color: '#1b3b22' }}>
                  {payInfo.homestayName}
                </strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: '0.9rem', color: '#444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={15} color="#888" />
                  <span><strong>Nhận:</strong> {formatDate(payInfo.ngayNhan)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={15} color="#888" />
                  <span><strong>Trả:</strong> {formatDate(payInfo.ngayTra)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={15} color="#888" />
                  <span><strong>Khách:</strong> {payInfo.soLuongKhach} người</span>
                </div>
                <div>
                  <strong>Tổng tiền: </strong>
                  <span style={{ fontSize: '1.15rem', color: '#b91c1c', fontWeight: 'bold' }}>
                    {payInfo.soTien?.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              </div>

              {/* Huy hiệu trạng thái */}
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={payInfo.isPaid ? styles.badgeSuccess : styles.badgeWarning}>
                  {payInfo.isPaid ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
                </span>
                <span style={styles.badgeInfo}>
                  Đơn: {payInfo.trangThaiDon}
                </span>
                {payInfo.phuongThucThanhToan && (
                  <span style={styles.badgeGray}>
                    Hình thức: {payInfo.phuongThucThanhToan === 'ChuyenKhoanQR' ? 'Chuyển khoản QR' : 'Tiền mặt khi nhận phòng'}
                  </span>
                )}
              </div>
            </div>

            {/* Nếu đơn đã thanh toán thành công */}
            {payInfo.isPaid ? (
              <div style={styles.successBox}>
                <CheckCircle2 size={40} color="#16a34a" />
                <h4 style={{ margin: '8px 0 4px', color: '#15803d' }}>
                  Đơn đặt phòng đã được thanh toán!
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4b5563' }}>
                  Phương thức: <strong>{payInfo.phuongThucThanhToan === 'ChuyenKhoanQR' ? 'Chuyển khoản QR mô phỏng' : 'Tiền mặt tại homestay'}</strong>
                </p>
                {payInfo.ngayThanhToan && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                    Thời điểm xác nhận: {formatDateTime(payInfo.ngayThanhToan)}
                  </p>
                )}
              </div>
            ) : !payInfo.canPay ? (
              /* Không thể thanh toán (Ví dụ đang chờ duyệt hoặc đã hủy) */
              <div style={styles.restrictionBox}>
                <AlertCircle size={28} color="#b45309" />
                <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: '#92400e', fontWeight: 500 }}>
                  {payInfo.paymentRestrictionMessage}
                </p>
              </div>
            ) : (
              /* Cho phép thanh toán: Hiển thị chọn phương thức */
              <>
                <div style={{ margin: '18px 0 12px' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                    Chọn phương thức thanh toán:
                  </label>
                  <div style={styles.methodSelector}>
                    <button
                      type="button"
                      style={selectedMethod === 'ChuyenKhoanQR' ? styles.methodBtnActive : styles.methodBtn}
                      onClick={() => setSelectedMethod('ChuyenKhoanQR')}
                    >
                      <QrCode size={18} />
                      <span>QR Chuyển khoản (Demo)</span>
                    </button>
                    <button
                      type="button"
                      style={selectedMethod === 'TienMat' ? styles.methodBtnActive : styles.methodBtn}
                      onClick={() => setSelectedMethod('TienMat')}
                    >
                      <Banknote size={18} />
                      <span>Tiền mặt khi nhận phòng</span>
                    </button>
                  </div>
                </div>

                {/* Giao diện phương thức 1: QR Mô phỏng */}
                {selectedMethod === 'ChuyenKhoanQR' && (
                  <div style={styles.qrContainer}>
                    {/* Cảnh báo nổi bật: THANH TOÁN DEMO */}
                    <div style={styles.demoWarningBanner}>
                      <ShieldAlert size={22} color="#dc2626" style={{ flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: '#b91c1c', fontSize: '0.95rem' }}>
                          THANH TOÁN DEMO — KHÔNG CHUYỂN TIỀN THẬT
                        </strong>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#7f1d1d' }}>
                          Đây là chức năng mô phỏng đồ án học tập. Mã QR không chuyển tiền thật vào tài khoản ngân hàng nào.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', gap: 20, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                      {/* Ảnh QR Code */}
                      {payInfo.demoBankInfo?.qrCodeDataUrl ? (
                        <div style={styles.qrWrapper}>
                          <img 
                            src={payInfo.demoBankInfo.qrCodeDataUrl} 
                            alt="Mã QR Demo" 
                            style={{ width: 190, height: 190, display: 'block' }} 
                          />
                          <span style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }}>
                            Quét QR mô phỏng
                          </span>
                          <p style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', marginTop: 6, maxWidth: 220, lineHeight: 1.3 }}>
                            💡 <em>Mã QR chứa dữ liệu thanh toán mô phỏng.</em>
                          </p>
                        </div>
                      ) : (
                        <div style={{ width: 190, height: 190, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <QrCode size={48} color="#9ca3af" />
                        </div>
                      )}


                      {/* Thông tin chuyển khoản */}
                      <div style={styles.bankInfoBox}>
                        <div style={styles.bankInfoRow}>
                          <span style={styles.bankLabel}>Ngân hàng:</span>
                          <span style={styles.bankValue}>{payInfo.demoBankInfo?.bankName}</span>
                        </div>
                        <div style={styles.bankInfoRow}>
                          <span style={styles.bankLabel}>Số tài khoản:</span>
                          <span style={{ ...styles.bankValue, fontFamily: 'monospace', fontWeight: 'bold', color: '#1b3b22' }}>
                            {payInfo.demoBankInfo?.accountNumber}
                          </span>
                        </div>
                        <div style={styles.bankInfoRow}>
                          <span style={styles.bankLabel}>Chủ tài khoản:</span>
                          <span style={styles.bankValue}>{payInfo.demoBankInfo?.accountName}</span>
                        </div>
                        <div style={styles.bankInfoRow}>
                          <span style={styles.bankLabel}>Số tiền:</span>
                          <span style={{ ...styles.bankValue, color: '#b91c1c', fontWeight: 'bold' }}>
                            {payInfo.soTien?.toLocaleString('vi-VN')} VNĐ
                          </span>
                        </div>
                        <div style={styles.bankInfoRow}>
                          <span style={styles.bankLabel}>Nội dung CK:</span>
                          <span style={{ ...styles.bankValue, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                            {payInfo.demoBankInfo?.transferMemo}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Các nút bấm mô phỏng */}
                    <div style={styles.simulateActions}>
                      <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#4b5563', textAlign: 'center', fontWeight: 500 }}>
                        Thao tác mô phỏng kết quả giao dịch (dành cho demo đồ án):
                      </p>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button
                          type="button"
                          style={styles.btnSuccessSim}
                          disabled={actionLoading}
                          onClick={() => handleSimulatePayment('success')}
                        >
                          <CheckCircle2 size={18} />
                          {actionLoading ? 'Đang xử lý...' : 'Mô phỏng Thanh toán Thành công'}
                        </button>
                        <button
                          type="button"
                          style={styles.btnFailSim}
                          disabled={actionLoading}
                          onClick={() => handleSimulatePayment('failed')}
                        >
                          <AlertCircle size={18} />
                          {actionLoading ? 'Đang xử lý...' : 'Mô phỏng Thất bại'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Giao diện phương thức 2: Tiền mặt khi nhận phòng */}
                {selectedMethod === 'TienMat' && (
                  <div style={styles.cashContainer}>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <Banknote size={48} color="#2d5a27" style={{ margin: '0 auto 12px' }} />
                      <h4 style={{ margin: '0 0 8px', color: '#1b3b22' }}>
                        Thanh toán tiền mặt khi nhận phòng (Check-in)
                      </h4>
                      <p style={{ margin: '0 auto 12px', fontSize: '0.92rem', color: '#4b5563', maxWidth: 440 }}>
                        Bạn sẽ thanh toán số tiền <strong>{payInfo.soTien?.toLocaleString('vi-VN')} VNĐ</strong> trực tiếp cho Chủ homestay khi làm thủ tục check-in.
                      </p>
                      <div style={{ background: '#fef3c7', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: '#92400e', marginBottom: 16 }}>
                        ⚠️ Lưu ý: Trạng thái ban đầu vẫn là <strong>Chưa thanh toán</strong>. Chỉ Chủ homestay hoặc Quản trị viên mới có quyền xác nhận thu tiền mặt sau khi bạn đến nơi.
                      </div>
                      {payInfo.phuongThucThanhToan === 'TienMat' ? (
                        <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '12px 18px', borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                          <CheckCircle2 size={20} color="#059669" />
                          <span>Đã lưu phương thức: Thanh toán tiền mặt khi nhận phòng (Chờ thu tiền khi làm thủ tục check-in)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          style={styles.btnConfirmCash}
                          disabled={actionLoading}
                          onClick={handleSelectCashMethod}
                        >
                          {actionLoading ? 'Đang lưu...' : 'Xác nhận chọn phương thức Tiền mặt'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Lịch sử giao dịch (PostgreSQL Transaction Log) */}
            <div style={{ marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setShowHistory(!showHistory)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                  <History size={17} />
                  <span>Lịch sử giao dịch trong hệ thống ({payInfo.transactions?.length || 0})</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#2563eb' }}>
                  {showHistory ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}
                </span>
              </div>

              {showHistory && (
                <div style={{ marginTop: 10 }}>
                  {payInfo.transactions?.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '8px 0' }}>
                      Chưa có lịch sử giao dịch nào cho đơn phòng này.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {payInfo.transactions?.map((tx) => (
                        <div key={tx.MaGiaoDich} style={styles.txItem}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                              {tx.MaGiaoDich}
                            </span>
                            <span style={
                              tx.TrangThai === 'ThanhCong' ? styles.txBadgeSuccess :
                              tx.TrangThai === 'ThatBai' ? styles.txBadgeDanger : styles.txBadgePending
                            }>
                              {tx.TrangThai === 'ThanhCong' ? 'Thành công' :
                               tx.TrangThai === 'ThatBai' ? 'Thất bại' : 'Chờ thanh toán'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                            {formatDateTime(tx.created_at)} • {parseFloat(tx.SoTien).toLocaleString('vi-VN')} VNĐ • Thao tác: {tx.NguoiThaoTac || 'Hệ thống'}
                          </div>
                          {tx.GhiChu && (
                            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2, fontStyle: 'italic' }}>
                              Ghi chú: {tx.GhiChu}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    maxWidth: '620px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8fafc',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: 6,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
  },
  summaryCard: {
    backgroundColor: '#f1f8f4',
    border: '1px solid #d1e7dd',
    borderRadius: '12px',
    padding: '14px 18px',
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  badgeInfo: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  badgeGray: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
  },
  successBox: {
    marginTop: 18,
    padding: '24px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '12px',
    textAlign: 'center',
  },
  restrictionBox: {
    marginTop: 18,
    padding: '18px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '12px',
    textAlign: 'center',
  },
  methodSelector: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '8px',
  },
  methodBtn: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#4b5563',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 500,
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  methodBtnActive: {
    padding: '12px',
    border: '2px solid #2d5a27',
    borderRadius: '10px',
    backgroundColor: '#f0fdf4',
    color: '#1b3b22',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  qrContainer: {
    marginTop: 14,
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    backgroundColor: '#fafafa',
  },
  demoWarningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '10px 14px',
  },
  qrWrapper: {
    background: '#ffffff',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  bankInfoBox: {
    flex: 1,
    minWidth: '220px',
    fontSize: '0.88rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bankInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px dashed #e2e8f0',
    paddingBottom: 4,
  },
  bankLabel: {
    color: '#64748b',
    fontSize: '0.85rem',
  },
  bankValue: {
    color: '#1e293b',
    fontWeight: 500,
    textAlign: 'right',
  },
  simulateActions: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: '1px solid #e5e7eb',
  },
  btnSuccessSim: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.2s',
  },
  btnFailSim: {
    backgroundColor: '#ffffff',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cashContainer: {
    marginTop: 14,
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    backgroundColor: '#fafafa',
  },
  btnConfirmCash: {
    backgroundColor: '#2d5a27',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 22px',
    fontWeight: 600,
    fontSize: '0.92rem',
    cursor: 'pointer',
  },
  txItem: {
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  txBadgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  txBadgeDanger: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  txBadgePending: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
};

