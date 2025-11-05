// src/controllers/complaint.controller.js
import * as complaintService from '../services/complaint.service.js';

/**
 * Controller để giải quyết khiếu nại
 */
export const resolveComplaint = async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id); // Lấy MaKhieuNai
    const ownerId = req.owner.MaChu; // Lấy từ middleware
    const { ketQua } = req.body; // Lấy nội dung giải quyết

    if (!ketQua) {
      return res.status(400).json({ message: 'Kết quả không được để trống' });
    }

    const resolution = await complaintService.resolveComplaint(
      complaintId,
      ownerId,
      ketQua
    );

    res.status(201).json({
      message: 'Giải quyết khiếu nại thành công!',
      data: resolution,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy khiếu nại')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};