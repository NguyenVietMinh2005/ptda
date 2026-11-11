// src/pages/OwnerCalendarPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  CheckCircle2,
  Clock,
  User,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const HOMESTAYS_API = `${API_BASE_URL}/owner/me/homestays`;
const BOOKINGS_API = `${API_BASE_URL}/owner/me/bookings`;

export default function OwnerCalendarPage() {
  const [homestays, setHomestays] = useState([]);
  const [selectedHomestayId, setSelectedHomestayId] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const token = localStorage.getItem('ownerAuthToken');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [homestayRes, bookingRes] = await Promise.all([
        axios.get(HOMESTAYS_API, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(BOOKINGS_API, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const hList = homestayRes.data.data || [];
      setHomestays(hList);
      if (hList.length > 0) {
        setSelectedHomestayId(prev => prev || hList[0].MaHomestay);
      }
      setAllBookings(bookingRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải dữ liệu lịch phòng.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Filter bookings for the selected homestay and active statuses
  const relevantBookings = allBookings.filter((b) => {
    const detail = b.CHI_TIET_DAT_PHONG?.[0];
    const matchesHomestay = detail?.MaHomestay === parseInt(selectedHomestayId);
    const isActive = ['ChoXacNhan', 'DaXacNhan', 'DangLuuTru', 'DaHoanThanh'].includes(b.TrangThai);
    return matchesHomestay && isActive;
  });

  // Helper to determine if a specific date is booked
  const getBookingForDate = (day) => {
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);

    for (const b of relevantBookings) {
      const start = new Date(b.NgayNhan);
      start.setHours(0, 0, 0, 0);
      const end = new Date(b.NgayTra);
      end.setHours(0, 0, 0, 0);

      // Booked for date in [start, end)
      if (checkDate >= start && checkDate < end) {
        return b;
      }
    }
    return null;
  };

  // Stats for the month
  let bookedDaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (getBookingForDate(d)) bookedDaysCount++;
  }
  const occupancyRate = daysInMonth > 0 ? Math.round((bookedDaysCount / daysInMonth) * 100) : 0;

  const currentHomestay = homestays.find((h) => h.MaHomestay === parseInt(selectedHomestayId));

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const weekDayHeaders = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  return (
    <OwnerLayout
      title="Lịch Phòng & Tình Trạng Trống"
      subtitle="Theo dõi trực quan ngày kín phòng, ngày còn trống và danh tính khách lưu trú"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedHomestayId || ''}
            onChange={(e) => setSelectedHomestayId(e.target.value)}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid #E8E2D7',
              backgroundColor: '#FFFFFF',
              color: '#1C3B2B',
              fontWeight: 700,
              fontSize: '0.9rem',
              outline: 'none'
            }}
          >
            {homestays.map((h) => (
              <option key={h.MaHomestay} value={h.MaHomestay}>
                🏡 {h.TenHomestay} ({h.DiaDiem})
              </option>
            ))}
          </select>

          <button onClick={fetchData} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang chuẩn bị sơ đồ lịch phòng...
        </div>
      ) : homestays.length === 0 ? (
        <div className="data-table-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#1C3B2B' }}>Bạn chưa có Homestay nào</h3>
          <p style={{ color: '#5C6861' }}>Vui lòng tạo homestay trước để xem lịch phòng trống.</p>
        </div>
      ) : (
        <>
          {/* Summary Banner for the selected Homestay */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}
          >
            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <Home size={22} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Đang xem Homestay</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1C3B2B', marginTop: '0.2rem' }}>
                  {currentHomestay?.TenHomestay}
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <CalendarDays size={22} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Số ngày đã kín phòng</span>
                <span className="stat-widget-value" style={{ color: '#1D4ED8' }}>
                  {bookedDaysCount} / {daysInMonth} ngày
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon amber">
                <CheckCircle2 size={22} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Tỷ lệ lấp đầy tháng</span>
                <span className="stat-widget-value" style={{ color: '#B45309' }}>
                  {occupancyRate}%
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <CheckCircle2 size={22} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Ngày trống nhận khách</span>
                <span className="stat-widget-value" style={{ color: '#15803D' }}>
                  {daysInMonth - bookedDaysCount} ngày
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Calendar Container */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E8E2D7',
              padding: '1.75rem',
              boxShadow: '0 2px 10px rgba(28, 59, 43, 0.04)'
            }}
          >
            {/* Calendar Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handlePrevMonth}
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #E8E2D7',
                    borderRadius: '8px',
                    padding: '0.4rem 0.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Tháng trước"
                >
                  <ChevronLeft size={18} color="#1C3B2B" />
                </button>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1C3B2B', margin: 0 }}>
                  {monthNames[month]} năm {year}
                </h3>
                <button
                  onClick={handleNextMonth}
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #E8E2D7',
                    borderRadius: '8px',
                    padding: '0.4rem 0.6rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Tháng sau"
                >
                  <ChevronRight size={18} color="#1C3B2B" />
                </button>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }} />
                  <span>Còn trống</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#DBEAFE', border: '1px solid #93C5FD' }} />
                  <span>Đã xác nhận</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }} />
                  <span>Chờ xác nhận</span>
                </div>
              </div>
            </div>

            {/* Days of Week Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              {weekDayHeaders.map((day, idx) => (
                <div
                  key={idx}
                  style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: idx === 0 ? '#DC2626' : '#5C6861',
                    padding: '0.5rem 0'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {/* Empty leading slots */}
              {[...Array(firstDayOfMonth)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    minHeight: '85px',
                    borderRadius: '10px',
                    backgroundColor: '#FAF8F5',
                    opacity: 0.4
                  }}
                />
              ))}

              {/* Days in current month */}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const booking = getBookingForDate(day);
                const isBooked = !!booking;

                let cellBg = '#F0FDF4';
                let cellBorder = '#DCFCE7';
                if (isBooked) {
                  if (booking.TrangThai === 'DaXacNhan' || booking.TrangThai === 'DangLuuTru') {
                    cellBg = '#EFF6FF';
                    cellBorder = '#BFDBFE';
                  } else if (booking.TrangThai === 'ChoXacNhan') {
                    cellBg = '#FFFBEB';
                    cellBorder = '#FDE68A';
                  } else if (booking.TrangThai === 'DaHoanThanh') {
                    cellBg = '#F8FAFC';
                    cellBorder = '#E2E8F0';
                  }
                }

                return (
                  <div
                    key={`day-${day}`}
                    style={{
                      minHeight: '85px',
                      borderRadius: '10px',
                      backgroundColor: cellBg,
                      border: `1px solid ${cellBorder}`,
                      padding: '0.45rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          color: '#1C231F'
                        }}
                      >
                        {day}
                      </span>
                      {isBooked ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor:
                              booking.TrangThai === 'DaXacNhan' ? '#3B82F6' :
                              booking.TrangThai === 'DangLuuTru' ? '#0284C7' :
                              booking.TrangThai === 'ChoXacNhan' ? '#F59E0B' : '#64748B',
                            color: '#FFFFFF'
                          }}
                        >
                          KÍN
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#16A34A' }}>
                          Trống
                        </span>
                      )}
                    </div>

                    {isBooked ? (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: '#1E293B', lineHeight: '1.2' }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          👤 {booking.NGUOI_DUNG?.HoTen || 'Khách'}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '0.68rem' }}>
                          Đơn #{booking.MaDatPhong}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: '#15803D', fontStyle: 'italic' }}>
                        Sẵn sàng đón khách
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </OwnerLayout>
  );
}

