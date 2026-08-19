const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

// Veritabanı klasörünü güvenceye al
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'giriscikis.db');
const db = new DatabaseSync(dbPath);

// WAL modu ve performans ayarları
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Tabloları oluştur
function initDatabase() {
  db.exec(`
    -- Personel Giriş-Çıkış / Vardiya Kayıtları Tablosu
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      workplace TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      duration_minutes INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Finans ve Ödemeler Tablosu
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      recipient TEXT NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Nakit',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Yönetici Kullanıcıları Tablosu
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  createAdminIfEmpty();
}

// Sadece varsayılan yöneticiyi oluşturur, örnek verileri içermez
function createAdminIfEmpty() {
  // Yönetici kontrolü
  const adminStmt = db.prepare('SELECT COUNT(*) as count FROM admins');
  const adminCount = adminStmt.get().count;

  if (adminCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Giriscikis', salt);
    const insertAdmin = db.prepare(`
      INSERT INTO admins (username, password_hash, full_name)
      VALUES (?, ?, ?)
    `);
    insertAdmin.run('admin', hash, 'Sistem Yöneticisi');
    console.log('✅ Varsayılan yönetici oluşturuldu (Kullanıcı: admin, Şifre: )');
  }
}

// İlk başlatma
initDatabase();

module.exports = {
  db,
  initDatabase
};
