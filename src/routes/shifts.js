const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

// Süre hesaplama fonksiyonu (dakika cinsinden)
function calculateDurationMinutes(entryTime, exitTime) {
  if (!entryTime || !exitTime) return 0;
  const start = new Date(entryTime);
  const end = new Date(exitTime);
  const diffMs = end - start;
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60));
}

// Süreyi okunabilir metne dönüştürme (Örn: "8 sa 30 dk")
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return 'Devam Ediyor / Belirtilmedi';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} sa ${mins} dk`;
  if (hours > 0) return `${hours} saat`;
  return `${mins} dakika`;
}

// Otomatik tamamlama için kayıtlı çalışanlar ve çalışma yerleri (Herkese açık)
router.get('/suggestions', (req, res) => {
  try {
    const employeeRows = db.prepare('SELECT DISTINCT employee_name FROM shifts ORDER BY employee_name ASC').all();
    const workplaceRows = db.prepare('SELECT DISTINCT workplace FROM shifts ORDER BY workplace ASC').all();

    res.json({
      success: true,
      employees: employeeRows.map(r => r.employee_name),
      workplaces: workplaceRows.map(r => r.workplace)
    });
  } catch (error) {
    console.error('Öneri getirme hatası:', error);
    res.status(500).json({ success: false, message: 'Veriler alınamadı.' });
  }
});

// Çalışan Formu Üzerinden Giriş/Çıkış Kaydetme (Herkese Açık - POST /api/shifts)
router.post('/', (req, res) => {
  const { employee_name, workplace, entry_time, exit_time, notes } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Çalışan adı, çalışma yeri ve giriş saati zorunludur.'
    });
  }

  try {
    let durationMinutes = 0;
    if (exit_time) {
      durationMinutes = calculateDurationMinutes(entry_time, exit_time);
    }

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      entry_time,
      exit_time || null,
      durationMinutes,
      notes ? notes.trim() : null
    );

    res.status(201).json({
      success: true,
      message: 'Giriş-çıkış kaydınız başarıyla sisteme işlendi.',
      shiftId: result.lastInsertRowid,
      durationFormatted: formatDuration(durationMinutes)
    });
  } catch (error) {
    console.error('Vardiya kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kayıt işlenirken sunucu hatası oluştu.'
    });
  }
});

// Yönetici: Tüm Giriş-Çıkış Kayıtlarını Listele ve Filtrele (GET /api/shifts)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, workplace, startDate, endDate } = req.query;

    let query = 'SELECT * FROM shifts WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (employee_name LIKE ? OR notes LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (workplace && workplace.trim() !== '') {
      query += ' AND workplace = ?';
      params.push(workplace.trim());
    }

    if (startDate && startDate.trim() !== '') {
      query += ' AND entry_time >= ?';
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim() !== '') {
      query += ' AND entry_time <= ?';
      // Gün sonuna kadar dahil etmek için
      params.push(endDate.trim().includes('T') ? endDate.trim() : `${endDate.trim()}T23:59:59`);
    }

    query += ' ORDER BY entry_time DESC, id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Süreleri ve tarihleri zenginleştir
    const enrichedRows = rows.map(row => ({
      ...row,
      durationFormatted: formatDuration(row.duration_minutes)
    }));

    // Filtrelenmiş toplam süre
    const totalMinutes = enrichedRows.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    res.json({
      success: true,
      data: enrichedRows,
      count: enrichedRows.length,
      totalHours: parseFloat(totalHours),
      totalFormatted: formatDuration(totalMinutes)
    });
  } catch (error) {
    console.error('Vardiya listeleme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıtlar listelenirken hata oluştu.' });
  }
});

// Yönetici: Manuel Giriş-Çıkış Ekleme (POST /api/shifts/admin)
router.post('/admin', authenticateToken, (req, res) => {
  const { employee_name, workplace, entry_time, exit_time, notes } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen zorunlu alanları doldurunuz.'
    });
  }

  try {
    const durationMinutes = exit_time ? calculateDurationMinutes(entry_time, exit_time) : 0;

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      entry_time,
      exit_time || null,
      durationMinutes,
      notes ? notes.trim() : null
    );

    res.status(201).json({
      success: true,
      message: 'Kayıt yönetici tarafından başarıyla eklendi.',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Yönetici kayıt hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt eklenemedi.' });
  }
});

// Yönetici: Giriş-Çıkış Kaydını Güncelle (PUT /api/shifts/:id)
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { employee_name, workplace, entry_time, exit_time, notes } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen zorunlu alanları doldurunuz.'
    });
  }

  try {
    const durationMinutes = exit_time ? calculateDurationMinutes(entry_time, exit_time) : 0;

    const stmt = db.prepare(`
      UPDATE shifts
      SET employee_name = ?, workplace = ?, entry_time = ?, exit_time = ?, duration_minutes = ?, notes = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      entry_time,
      exit_time || null,
      durationMinutes,
      notes ? notes.trim() : null,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Kayıt başarıyla güncellendi.'
    });
  } catch (error) {
    console.error('Kayıt güncelleme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt güncellenemedi.' });
  }
});

// Yönetici: Giriş-Çıkış Kaydını Sil (DELETE /api/shifts/:id)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM shifts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Silinecek kayıt bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Giriş-çıkış kaydı başarıyla silindi.'
    });
  } catch (error) {
    console.error('Kayıt silme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt silinemedi.' });
  }
});

module.exports = router;
