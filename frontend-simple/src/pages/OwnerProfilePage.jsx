// src/pages/OwnerProfilePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import { User, Phone, MapPin, CreditCard, Shield, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/profile`;

export default function OwnerProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    hoTen: '',
    soDienThoai: '',
    diaChi: '',
    soCCCD: '',
  });

  const token = localStorage.getItem('ownerAuthToken');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data;
      setProfile(data);
      setFormData({
        hoTen: data.HoTen || '',
        soDienThoai: data.SoDienThoai || '',
        diaChi: data.DiaChi || '',
        soCCCD: data.SoCCCD || '',
      });
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải thông tin hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.hoTen.trim()) {
      toast.error('Họ tên không được để trống.');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.put(API_URL, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updated = res.data.data;
      setProfile(updated);
      localStorage.setItem('ownerAuthUser', JSON.stringify(updated));
      toast.success('Cập nhật hồ sơ tài khoản thành công!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Cập nhật hồ sơ thất bại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OwnerLayout
      title="Hồ Sơ Tài Khoản Chủ Nhà"
      subtitle="Quản lý thông tin liên hệ và giấy tờ định danh đối tác homestay"
      actions={
        <button onClick={fetchProfile} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={15} />
          <span>Làm mới</span>
        </button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang tải thông tin tài khoản...
        </div>
      ) : profile ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E8E2D7',
              padding: '2rem',
              boxShadow: '0 2px 10px rgba(28, 59, 43, 0.04)'
            }}
          >
            {/* Header profile info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #F0ECE4' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#C9653B',
                  color: '#FFFFFF',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {profile.HoTen ? profile.HoTen.charAt(0).toUpperCase() : 'H'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1C3B2B', margin: 0 }}>
                  {profile.HoTen}
                </h3>
                <div style={{ fontSize: '0.9rem', color: '#5C6861', marginTop: '0.2rem' }}>
                  {profile.Email} &bull; Mã đối tác: <strong>#{profile.MaChu}</strong>
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  <span className={`status-pill ${profile.Quyen === 'admin' ? 'info' : 'neutral'}`}>
                    {profile.Quyen === 'admin' ? '⭐ Quản trị viên (Super Admin)' : '🏡 Chủ Homestay'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.4rem' }}>
                    <User size={15} /> Họ và tên *
                  </label>
                  <input
                    type="text"
                    value={formData.hoTen}
                    onChange={(e) => setFormData({ ...formData, hoTen: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.4rem' }}>
                    <Phone size={15} /> Số điện thoại liên hệ
                  </label>
                  <input
                    type="tel"
                    value={formData.soDienThoai}
                    onChange={(e) => setFormData({ ...formData, soDienThoai: e.target.value })}
                    placeholder="Ví dụ: 0987654321"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.4rem' }}>
                    <CreditCard size={15} /> Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    value={formData.soCCCD}
                    onChange={(e) => setFormData({ ...formData, soCCCD: e.target.value })}
                    placeholder="12 chữ số căn cước"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.4rem' }}>
                    Email đăng ký (Cố định)
                  </label>
                  <input
                    type="email"
                    value={profile.Email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      fontSize: '0.9rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div className="form-group full-span">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1C3B2B', marginBottom: '0.4rem' }}>
                    <MapPin size={15} /> Địa chỉ liên hệ / Trụ sở
                  </label>
                  <input
                    type="text"
                    value={formData.diaChi}
                    onChange={(e) => setFormData({ ...formData, diaChi: e.target.value })}
                    placeholder="Địa chỉ cư trú hoặc văn phòng quản lý"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="button-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.5rem' }}
                >
                  <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </OwnerLayout>
  );
}

