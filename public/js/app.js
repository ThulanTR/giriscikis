// Lucide İkonlarını Başlat
function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Yardımcı: Tarih/Saati YYYY-MM-DDTHH:mm formatına dönüştür (Yerel saat)
function getLocalDateTimeString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Canlı Saat Güncelleme
function startLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    clockEl.textContent = now.toLocaleDateString('tr-TR', options);
  }

  update();
  setInterval(update, 1000);
}

// Çalışan ve Çalışma Yeri Önerilerini Yükle
async function loadSuggestions() {
  try {
    const res = await fetch('/api/shifts/suggestions');
    const data = await res.json();
    if (data.success) {
      const empList = document.getElementById('employeeSuggestions');
      const workList = document.getElementById('workplaceSuggestions');

      if (empList) {
        empList.innerHTML = data.employees.map(name => `<option value="${name}">`).join('');
      }
      if (workList) {
        workList.innerHTML = data.workplaces.map(place => `<option value="${place}">`).join('');
      }
    }
  } catch (err) {
    console.warn('Öneriler yüklenirken hata:', err);
  }
}

// Canlı Süre Hesaplama ve Önizleme
function updateDurationPreview() {
  const entryInput = document.getElementById('entryTime');
  const exitInput = document.getElementById('exitTime');
  const ongoingCheck = document.getElementById('ongoingShiftCheck');
  const previewBox = document.getElementById('durationPreviewBox');
  const durationText = document.getElementById('durationText');

  if (!entryInput || !exitInput || !previewBox || !durationText) return;

  if (ongoingCheck && ongoingCheck.checked) {
    previewBox.classList.remove('hidden');
    durationText.textContent = 'Vardiya Devam Ediyor';
    durationText.className = 'font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-500/30';
    return;
  }

  const entryVal = entryInput.value;
  const exitVal = exitInput.value;

  if (entryVal && exitVal) {
    const start = new Date(entryVal);
    const end = new Date(exitVal);
    const diffMs = end - start;

    if (diffMs > 0) {
      const totalMinutes = Math.round(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;

      let formatted = '';
      if (hours > 0 && mins > 0) formatted = `${hours} Saat ${mins} Dakika`;
      else if (hours > 0) formatted = `${hours} Saat`;
      else formatted = `${mins} Dakika`;

      durationText.textContent = formatted;
      durationText.className = 'font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30';
      previewBox.classList.remove('hidden');
    } else {
      durationText.textContent = 'Çıkış saati girişten önce olamaz!';
      durationText.className = 'font-bold text-rose-300 bg-rose-950/60 px-2.5 py-0.5 rounded-lg border border-rose-500/30';
      previewBox.classList.remove('hidden');
    }
  } else {
    previewBox.classList.add('hidden');
  }
}

// Son Kayıtları Getir (Mini feed)
async function loadRecentPublicShifts() {
  const container = document.getElementById('recentPublicShiftsList');
  if (!container) return;

  try {
    const res = await fetch('/api/shifts/suggestions');
    const data = await res.json();

    // Örnek akış için yerel son kayıtları listele
    const shiftsRes = await fetch('/api/stats/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`
      }
    });

    if (shiftsRes.ok) {
      const statsData = await shiftsRes.json();
      if (statsData.success && statsData.timeline) {
        const shiftEvents = statsData.timeline.filter(t => t.type === 'shift').slice(0, 4);
        if (shiftEvents.length > 0) {
          container.innerHTML = shiftEvents.map(s => `
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span class="font-semibold text-slate-200">${s.title}</span>
                <span class="text-slate-400">(${s.description})</span>
              </div>
              <span class="text-slate-500 text-[11px]">${s.timeAgo}</span>
            </div>
          `).join('');
          return;
        }
      }
    }

    container.innerHTML = `
      <div class="text-xs text-slate-400 text-center py-2 flex items-center justify-center gap-2">
        <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>
        <span>Sistem aktif. Yeni giriş-çıkış bildirimleri doğrudan işlenmektedir.</span>
      </div>
    `;
    refreshIcons();
  } catch (e) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 text-center py-2">
        Sistem aktif. Yeni giriş-çıkış bildirimleri doğrudan işlenmektedir.
      </div>
    `;
  }
}

// DOM Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  startLiveClock();
  loadSuggestions();
  loadRecentPublicShifts();

  // Form Elemanları
  const shiftForm = document.getElementById('shiftForm');
  const entryTimeInput = document.getElementById('entryTime');
  const exitTimeInput = document.getElementById('exitTime');
  const setEntryNowBtn = document.getElementById('setEntryNowBtn');
  const setExitNowBtn = document.getElementById('setExitNowBtn');
  const ongoingCheck = document.getElementById('ongoingShiftCheck');
  const exitTimeWrapper = document.getElementById('exitTimeWrapper');

  // Varsayılan giriş saatini şu an olarak ayarla
  if (entryTimeInput && !entryTimeInput.value) {
    entryTimeInput.value = getLocalDateTimeString();
  }

  // "Şimdi" Butonları
  if (setEntryNowBtn) {
    setEntryNowBtn.addEventListener('click', () => {
      entryTimeInput.value = getLocalDateTimeString();
      updateDurationPreview();
    });
  }

  if (setExitNowBtn) {
    setExitNowBtn.addEventListener('click', () => {
      if (ongoingCheck) ongoingCheck.checked = false;
      if (exitTimeInput) exitTimeInput.disabled = false;
      exitTimeInput.value = getLocalDateTimeString();
      updateDurationPreview();
    });
  }

  // Süre hesaplama dinleyicileri
  if (entryTimeInput) entryTimeInput.addEventListener('change', updateDurationPreview);
  if (exitTimeInput) exitTimeInput.addEventListener('change', updateDurationPreview);

  if (ongoingCheck) {
    ongoingCheck.addEventListener('change', () => {
      if (ongoingCheck.checked) {
        exitTimeInput.value = '';
        exitTimeInput.disabled = true;
      } else {
        exitTimeInput.disabled = false;
      }
      updateDurationPreview();
    });
  }

  // Vardiya Formunu Gönder
  if (shiftForm) {
    shiftForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const employee_name = document.getElementById('employeeName').value.trim();
      const workplace = document.getElementById('workplace').value.trim();
      const entry_time = entryTimeInput.value;
      const exit_time = (!ongoingCheck || !ongoingCheck.checked) ? exitTimeInput.value : null;
      const notes = document.getElementById('shiftNotes').value.trim();

      if (!employee_name || !workplace || !entry_time) {
        Swal.fire({
          icon: 'warning',
          title: 'Eksik Alan!',
          text: 'Lütfen çalışan adını, çalışma yerini ve giriş saatini eksiksiz doldurunuz.',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }

      if (exit_time && new Date(exit_time) <= new Date(entry_time)) {
        Swal.fire({
          icon: 'error',
          title: 'Hatalı Tarih/Saat',
          text: 'Çıkış tarihi ve saati, giriş tarihinden daha sonraki bir zaman olmalıdır!',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }

      const submitBtn = document.getElementById('submitShiftBtn');
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Kaydediliyor...</span>
      `;

      try {
        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_name,
            workplace,
            entry_time,
            exit_time,
            notes
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          Swal.fire({
            icon: 'success',
            title: 'Kayıt Başarılı!',
            html: `
              <p class="text-sm text-slate-300 mb-2"><strong>${employee_name}</strong> için vardiya kaydı sisteme kaydedildi.</p>
              <div class="p-3 bg-slate-800 rounded-lg text-xs text-slate-200 text-left space-y-1">
                <div><strong>Yer:</strong> ${workplace}</div>
                <div><strong>Giriş:</strong> ${new Date(entry_time).toLocaleString('tr-TR')}</div>
                ${exit_time ? `<div><strong>Çıkış:</strong> ${new Date(exit_time).toLocaleString('tr-TR')}</div><div><strong>Hesaplanan Süre:</strong> <span class="text-emerald-400 font-bold">${result.durationFormatted}</span></div>` : '<div class="text-amber-400">Vardiya devam ediyor olarak kaydedildi.</div>'}
              </div>
            `,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Tamam'
          });

          // Formu temizle ve yeni saate hazırla
          shiftForm.reset();
          entryTimeInput.value = getLocalDateTimeString();
          if (ongoingCheck) ongoingCheck.checked = false;
          if (exitTimeInput) exitTimeInput.disabled = false;
          updateDurationPreview();
          loadSuggestions();
          loadRecentPublicShifts();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Kayıt Başarısız',
            text: result.message || 'Kayıt sırasında bir hata oluştu.',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5'
          });
        }
      } catch (error) {
        console.error('Gönderim hatası:', error);
        Swal.fire({
          icon: 'error',
          title: 'Bağlantı Hatası',
          text: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olunuz.',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        refreshIcons();
      }
    });
  }

  // --- YÖNETİCİ GİRİŞ MODALI İŞLEMLERİ ---
  const loginModal = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginModalBtn');
  const closeLoginBtn = document.getElementById('closeLoginModalBtn');
  const loginForm = document.getElementById('loginForm');
  const togglePassBtn = document.getElementById('togglePasswordVisibility');
  const passInput = document.getElementById('adminPassword');

  function openModal() {
    if (loginModal) {
      // Eğer zaten giriş yapılmışsa doğrudan admin sayfasına yönlendir
      const token = localStorage.getItem('adminToken');
      if (token) {
        window.location.href = '/admin';
        return;
      }
      loginModal.classList.remove('hidden');
      refreshIcons();
    }
  }

  function closeModal() {
    if (loginModal) {
      loginModal.classList.add('hidden');
    }
  }

  if (openLoginBtn) openLoginBtn.addEventListener('click', openModal);
  if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeModal);

  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeModal();
    });
  }

  // Şifre Göster/Gizle
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
      } else {
        passInput.type = 'password';
        togglePassBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
      }
      refreshIcons();
    });
  }

  // Giriş Yap Form Gönderimi
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('adminUsername').value.trim();
      const password = passInput.value;

      const submitBtn = document.getElementById('loginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Giriş Yapılıyor...</span>
      `;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminUser', JSON.stringify(data.user));

          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true,
            background: '#1e293b',
            color: '#f8fafc'
          });

          Toast.fire({
            icon: 'success',
            title: 'Giriş Başarılı! Yönlendiriliyorsunuz...'
          });

          setTimeout(() => {
            window.location.href = '/admin';
          }, 1000);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Giriş Başarısız',
            text: data.message || 'Kullanıcı adı veya şifre hatalı.',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5'
          });
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Panele Giriş Yap</span>`;
        }
      } catch (err) {
        console.error('Giriş isteği hatası:', err);
        Swal.fire({
          icon: 'error',
          title: 'Hata',
          text: 'Sunucuya ulaşılamadı.',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Panele Giriş Yap</span>`;
      }
    });
  }
});
