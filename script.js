/* ============================================================
   SISTEM PENGGAJIAN - SINGLE JS FILE (WITH ROLE-BASED ACCESS)
   ============================================================ */

/* ============================================================
   1. KONFIGURASI SUPABASE
   ============================================================ */
const SUPABASE_URL = 'https://lzktzvwebvcomzmmgtzk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6a3R6dndlYnZjb216bW1ndHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzg2MTYsImV4cCI6MjEwNTc1NDYxNn0.l_mQPgNEMrhVlV5nT5tnOSZas8p-h3WlGU9dHnWD-3s';

/* ============================================================
   2. CEK KONFIGURASI & PROTOCOL
   ============================================================ */
const CONFIG_VALID = !SUPABASE_URL.includes('xxxxx') && !SUPABASE_ANON_KEY.includes('...');
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

let db = null;
let currentUser = null;
let currentRole = 'karyawan';
let currentUserName = '';

try {
  if (CONFIG_VALID) {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase terinisialisasi:', SUPABASE_URL);
  } else {
    console.error('❌ Supabase URL/Key belum diisi!');
  }
} catch (err) {
  console.error('❌ Gagal inisialisasi Supabase:', err);
}

/* ============================================================
   3. UTILITY
   ============================================================ */
function rupiah(angka) {
  return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = ''; }, 3000);
}

function setLoginMsg(text, type = 'error') {
  const msg = document.getElementById('loginMsg');
  if (!msg) return;
  const colors = { error: '#ef4444', warning: '#f59e0b', success: '#16a34a' };
  msg.style.color = colors[type] || '#ef4444';
  msg.innerHTML = text;
}

/* ============================================================
   4. AUTH
   ============================================================ */
async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btnLogin');

  if (!CONFIG_VALID) {
    setLoginMsg('⚠️ Supabase URL/Key belum diisi di kode!');
    return;
  }
  if (IS_FILE_PROTOCOL) {
    setLoginMsg('⚠️ File dibuka via file:// — harus via HTTP server (GitHub Pages / Live Server).');
    return;
  }
  if (!email || !password) {
    setLoginMsg('Email dan password wajib diisi');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memproses...';
  setLoginMsg('');

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginMsg(error.message);
      return;
    }

    setLoginMsg('Login berhasil! Memuat data...', 'success');
    await initApp();

  } catch (err) {
    console.error('Login error:', err);
    setLoginMsg('Gagal terhubung ke server. Cek koneksi internet.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

async function handleRegister() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!CONFIG_VALID) { setLoginMsg('⚠️ Supabase URL/Key belum diisi!'); return; }
  if (!email || !password) { setLoginMsg('Isi email dan password dulu'); return; }
  if (password.length < 6) { setLoginMsg('Password minimal 6 karakter'); return; }

  setLoginMsg('Memproses registrasi...', 'warning');

  try {
    const { error } = await db.auth.signUp({ email, password });
    if (error) { setLoginMsg(error.message); return; }
    setLoginMsg('Registrasi berhasil! Cek email untuk verifikasi.', 'success');
  } catch (err) {
    console.error('Register error:', err);
    setLoginMsg('Gagal terhubung. Cek konfigurasi Supabase.');
  }
}

async function handleLogout() {
  try { await db.auth.signOut(); } catch (e) {}
  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
  setLoginMsg('');
  currentRole = 'karyawan';
  currentUserName = '';
}

async function initApp() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appView').style.display = 'block';

  // 1. Load profile user (untuk dapat role)
  await loadProfile();

  // 2. Load semua data
  await loadJabatan();
  await loadKaryawan();
  await loadAbsensi();
  await loadPenggajian();

  // 3. Atur tampilan sesuai role
  applyRoleUI();
}

async function cekSession() {
  if (!CONFIG_VALID || IS_FILE_PROTOCOL) {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
    return;
  }
  try {
    const { data } = await db.auth.getSession();
    if (data?.session) {
      await initApp();
    } else {
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('appView').style.display = 'none';
    }
  } catch (err) {
    console.error('Cek session error:', err);
    document.getElementById('loginView').style.display = 'flex';
  }
}

/* ============================================================
   5. ROLE MANAGEMENT
   ============================================================ */
async function loadProfile() {
  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;

    currentUser = user;

    const { data, error } = await db.from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('Profile belum ada, default role: karyawan');
      currentRole = 'karyawan';
      currentUserName = user.email;
      return;
    }

    currentRole = data?.role || 'karyawan';
    currentUserName = data?.nama_lengkap || user.email;
    console.log(`👤 Login: ${currentUserName} | Role: ${currentRole}`);
  } catch (err) {
    console.error('Load profile error:', err);
    currentRole = 'karyawan';
    currentUserName = 'User';
  }
}

function renderUserBadge() {
  const badge = document.getElementById('userBadge');
  if (!badge) return;
  badge.innerHTML = `
    ${currentUserName}
    <span class="role-tag ${currentRole}">${currentRole}</span>
  `;
}

function applyRoleUI() {
  renderUserBadge();

  // Aturan akses tab per role
  const aksesTabs = {
    admin:    ['jabatan', 'karyawan', 'absensi', 'penggajian'],
    hrd:      ['karyawan', 'absensi', 'penggajian'],
    manager:  ['penggajian'],
    karyawan: ['absensi']
  };

  const allowed = aksesTabs[currentRole] || [];

  // Sembunyikan tab yang gak boleh
  document.querySelectorAll('nav .tab').forEach(tab => {
    if (allowed.includes(tab.dataset.view)) {
      tab.style.display = 'inline-block';
    } else {
      tab.style.display = 'none';
    }
  });

  // Sembunyikan form input kalau read-only
  const formMap = {
    jabatan: 'formJabatan',
    karyawan: 'formKaryawan',
    absensi: 'formAbsensi',
    penggajian: 'formPenggajian'
  };

  for (const [entitas, formId] of Object.entries(formMap)) {
    const formEl = document.getElementById(formId);
    if (formEl) {
      formEl.style.display = bolehWrite(entitas) ? '' : 'none';
    }
  }

  // Pindah ke tab pertama yang boleh
  if (allowed.length > 0) {
    switchTab(allowed[0]);
  }
}

function bolehWrite(entitas) {
  const izin = {
    jabatan:    ['admin'],
    karyawan:   ['admin', 'hrd'],
    absensi:    ['admin', 'hrd'],
    penggajian: ['admin']
  };
  return (izin[entitas] || []).includes(currentRole);
}

/* ============================================================
   6. TAB NAVIGATION
   ============================================================ */
function switchTab(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('nav .tab').forEach(t => t.classList.remove('active'));
  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');
  const tabBtn = document.querySelector(`nav .tab[data-view="${name}"]`);
  if (tabBtn) tabBtn.classList.add('active');
}

/* ============================================================
   7. CRUD JABATAN
   ============================================================ */
let jabatanList = [];

async function loadJabatan() {
  try {
    const { data, error } = await db.from('jabatan').select('*').order('id', { ascending: false });
    if (error) throw error;

    jabatanList = data || [];
    const bisaEdit = bolehWrite('jabatan');

    document.getElementById('tbodyJabatan').innerHTML = jabatanList.length
      ? jabatanList.map(j => `
          <tr>
            <td>${j.nama_jabatan}</td>
            <td>${rupiah(j.gaji_pokok)}</td>
            <td>${rupiah(j.tunjangan)}</td>
            <td>
              ${bisaEdit ? `
                <button onclick='editJabatan(${JSON.stringify(j)})'>Edit</button>
                <button class="danger" onclick="hapusJabatan(${j.id})">Hapus</button>
              ` : '<span class="read-only-badge">👁️ Read only</span>'}
            </td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="empty">Belum ada data jabatan</td></tr>';

    const sel = document.getElementById('karyawan_jabatan');
    sel.innerHTML = '<option value="">-- Pilih Jabatan --</option>' +
      jabatanList.map(j => `<option value="${j.id}">${j.nama_jabatan}</option>`).join('');
  } catch (err) {
    console.error(err);
    toast('Gagal load jabatan: ' + err.message, 'error');
  }
}

async function simpanJabatan(e) {
  e.preventDefault();
  const id = document.getElementById('jabatan_id_edit').value;
  const payload = {
    nama_jabatan: document.getElementById('jabatan_nama').value,
    gaji_pokok: Number(document.getElementById('jabatan_gaji').value),
    tunjangan: Number(document.getElementById('jabatan_tunjangan').value)
  };
  try {
    const { error } = id
      ? await db.from('jabatan').update(payload).eq('id', id)
      : await db.from('jabatan').insert(payload);
    if (error) throw error;

    toast(id ? 'Jabatan diperbarui' : 'Jabatan ditambahkan');
    resetFormJabatan();
    loadJabatan();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function editJabatan(j) {
  document.getElementById('jabatan_id_edit').value = j.id;
  document.getElementById('jabatan_nama').value = j.nama_jabatan;
  document.getElementById('jabatan_gaji').value = j.gaji_pokok;
  document.getElementById('jabatan_tunjangan').value = j.tunjangan;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function hapusJabatan(id) {
  if (!confirm('Yakin hapus jabatan ini?')) return;
  try {
    const { error } = await db.from('jabatan').delete().eq('id', id);
    if (error) throw error;
    toast('Jabatan dihapus');
    loadJabatan();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function resetFormJabatan() {
  document.getElementById('formJabatan').reset();
  document.getElementById('jabatan_id_edit').value = '';
}

/* ============================================================
   8. CRUD KARYAWAN
   ============================================================ */
let karyawanList = [];

async function loadKaryawan() {
  try {
    const { data, error } = await db.from('karyawan')
      .select('*, jabatan(nama_jabatan)')
      .order('id', { ascending: false });
    if (error) throw error;

    karyawanList = data || [];
    const bisaEdit = bolehWrite('karyawan');

    document.getElementById('tbodyKaryawan').innerHTML = karyawanList.length
      ? karyawanList.map(k => `
          <tr>
            <td>${k.nip}</td>
            <td>${k.nama}</td>
            <td>${k.email || '-'}</td>
            <td>${k.jabatan?.nama_jabatan || '-'}</td>
            <td>${k.tanggal_masuk || '-'}</td>
            <td><span class="badge ${k.status}">${k.status}</span></td>
            <td>
              ${bisaEdit ? `
                <button onclick='editKaryawan(${JSON.stringify(k)})'>Edit</button>
                <button class="danger" onclick="hapusKaryawan(${k.id})">Hapus</button>
              ` : '<span class="read-only-badge">👁️ Read only</span>'}
            </td>
          </tr>`).join('')
      : '<tr><td colspan="7" class="empty">Belum ada data karyawan</td></tr>';

    const opts = '<option value="">-- Pilih Karyawan --</option>' +
      karyawanList.map(k => `<option value="${k.id}">${k.nip} - ${k.nama}</option>`).join('');
    document.getElementById('absensi_karyawan').innerHTML = opts;
    document.getElementById('penggajian_karyawan').innerHTML = opts;
  } catch (err) {
    console.error(err);
    toast('Gagal load karyawan: ' + err.message, 'error');
  }
}

async function simpanKaryawan(e) {
  e.preventDefault();
  const id = document.getElementById('karyawan_id_edit').value;
  const payload = {
    nip: document.getElementById('karyawan_nip').value,
    nama: document.getElementById('karyawan_nama').value,
    email: document.getElementById('karyawan_email').value || null,
    jabatan_id: document.getElementById('karyawan_jabatan').value || null,
    tanggal_masuk: document.getElementById('karyawan_tanggal').value || null,
    status: document.getElementById('karyawan_status').value
  };
  try {
    const { error } = id
      ? await db.from('karyawan').update(payload).eq('id', id)
      : await db.from('karyawan').insert(payload);
    if (error) throw error;

    toast(id ? 'Karyawan diperbarui' : 'Karyawan ditambahkan');
    resetFormKaryawan();
    loadKaryawan();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function editKaryawan(k) {
  document.getElementById('karyawan_id_edit').value = k.id;
  document.getElementById('karyawan_nip').value = k.nip;
  document.getElementById('karyawan_nama').value = k.nama;
  document.getElementById('karyawan_email').value = k.email || '';
  document.getElementById('karyawan_jabatan').value = k.jabatan_id || '';
  document.getElementById('karyawan_tanggal').value = k.tanggal_masuk || '';
  document.getElementById('karyawan_status').value = k.status;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function hapusKaryawan(id) {
  if (!confirm('Yakin hapus karyawan ini?')) return;
  try {
    const { error } = await db.from('karyawan').delete().eq('id', id);
    if (error) throw error;
    toast('Karyawan dihapus');
    loadKaryawan();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function resetFormKaryawan() {
  document.getElementById('formKaryawan').reset();
  document.getElementById('karyawan_id_edit').value = '';
}

/* ============================================================
   9. CRUD ABSENSI
   ============================================================ */
async function loadAbsensi() {
  try {
    const { data, error } = await db.from('absensi')
      .select('*, karyawan(nip, nama)')
      .order('tanggal', { ascending: false })
      .limit(100);
    if (error) throw error;

    const bisaEdit = bolehWrite('absensi');

    document.getElementById('tbodyAbsensi').innerHTML = (data && data.length)
      ? data.map(a => `
          <tr>
            <td>${a.karyawan?.nip || '-'} - ${a.karyawan?.nama || '-'}</td>
            <td>${a.tanggal}</td>
            <td><span class="badge ${a.status}">${a.status}</span></td>
            <td>${a.jam_masuk || '-'}</td>
            <td>${a.jam_keluar || '-'}</td>
            <td>
              ${bisaEdit ? `
                <button onclick='editAbsensi(${JSON.stringify(a)})'>Edit</button>
                <button class="danger" onclick="hapusAbsensi(${a.id})">Hapus</button>
              ` : '<span class="read-only-badge">👁️ Read only</span>'}
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Belum ada data absensi</td></tr>';
  } catch (err) {
    console.error(err);
    toast('Gagal load absensi: ' + err.message, 'error');
  }
}

async function simpanAbsensi(e) {
  e.preventDefault();
  const id = document.getElementById('absensi_id_edit').value;
  const payload = {
    karyawan_id: document.getElementById('absensi_karyawan').value,
    tanggal: document.getElementById('absensi_tanggal').value,
    status: document.getElementById('absensi_status').value,
    jam_masuk: document.getElementById('absensi_masuk').value || null,
    jam_keluar: document.getElementById('absensi_keluar').value || null
  };
  try {
    const { error } = id
      ? await db.from('absensi').update(payload).eq('id', id)
      : await db.from('absensi').insert(payload);
    if (error) throw error;

    toast(id ? 'Absensi diperbarui' : 'Absensi ditambahkan');
    resetFormAbsensi();
    loadAbsensi();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function editAbsensi(a) {
  document.getElementById('absensi_id_edit').value = a.id;
  document.getElementById('absensi_karyawan').value = a.karyawan_id;
  document.getElementById('absensi_tanggal').value = a.tanggal;
  document.getElementById('absensi_status').value = a.status;
  document.getElementById('absensi_masuk').value = a.jam_masuk || '';
  document.getElementById('absensi_keluar').value = a.jam_keluar || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function hapusAbsensi(id) {
  if (!confirm('Yakin hapus data absensi ini?')) return;
  try {
    const { error } = await db.from('absensi').delete().eq('id', id);
    if (error) throw error;
    toast('Absensi dihapus');
    loadAbsensi();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function resetFormAbsensi() {
  document.getElementById('formAbsensi').reset();
  document.getElementById('absensi_id_edit').value = '';
}

/* ============================================================
   10. CRUD PENGGAJIAN
   ============================================================ */
async function loadPenggajian() {
  try {
    const { data, error } = await db.from('v_laporan_gaji').select('*');
    if (error) throw error;

    const bisaWrite = bolehWrite('penggajian');

    document.getElementById('tbodyPenggajian').innerHTML = (data && data.length)
      ? data.map(p => `
          <tr>
            <td>${p.nip}</td>
            <td>${p.nama_karyawan}</td>
            <td>${p.periode}</td>
            <td>${rupiah(p.gaji_pokok)}</td>
            <td>${rupiah(p.tunjangan)}</td>
            <td>${rupiah(p.potongan)}</td>
            <td><b>${rupiah(p.total_gaji)}</b></td>
            <td><span class="badge ${p.status}">${p.status}</span></td>
            <td>
              ${bisaWrite ? `
                <button onclick="bayarGaji(${p.id})" ${p.status === 'dibayar' ? 'disabled' : ''}>Bayar</button>
                <button class="danger" onclick="hapusPenggajian(${p.id})">Hapus</button>
              ` : '<span class="read-only-badge">👁️ Read only</span>'}
            </td>
          </tr>`).join('')
      : '<tr><td colspan="9" class="empty">Belum ada data penggajian</td></tr>';
  } catch (err) {
    console.error(err);
    toast('Gagal load penggajian: ' + err.message, 'error');
  }
}

async function autoFillGaji() {
  const id = document.getElementById('penggajian_karyawan').value;
  if (!id) return;
  const { data } = await db.from('karyawan')
    .select('jabatan(gaji_pokok, tunjangan)')
    .eq('id', id)
    .single();
  if (data?.jabatan) {
    document.getElementById('penggajian_pokok').value = data.jabatan.gaji_pokok;
    document.getElementById('penggajian_tunjangan').value = data.jabatan.tunjangan;
    hitungTotal();
  }
}

function hitungTotal() {
  const pokok = Number(document.getElementById('penggajian_pokok').value || 0);
  const tunj = Number(document.getElementById('penggajian_tunjangan').value || 0);
  const pot = Number(document.getElementById('penggajian_potongan').value || 0);
  document.getElementById('totalPreview').textContent = rupiah(pokok + tunj - pot);
}

async function simpanPenggajian(e) {
  e.preventDefault();
  const payload = {
    karyawan_id: document.getElementById('penggajian_karyawan').value,
    periode: document.getElementById('penggajian_periode').value,
    gaji_pokok: Number(document.getElementById('penggajian_pokok').value),
    tunjangan: Number(document.getElementById('penggajian_tunjangan').value),
    potongan: Number(document.getElementById('penggajian_potongan').value || 0),
    status: 'pending'
  };
  try {
    const { error } = await db.from('penggajian').insert(payload);
    if (error) throw error;
    toast('Penggajian ditambahkan');
    resetFormPenggajian();
    loadPenggajian();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function bayarGaji(id) {
  try {
    const { error } = await db.from('penggajian')
      .update({
        status: 'dibayar',
        tanggal_bayar: new Date().toISOString().slice(0, 10)
      })
      .eq('id', id);
    if (error) throw error;
    toast('Gaji ditandai sudah dibayar');
    loadPenggajian();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function hapusPenggajian(id) {
  if (!confirm('Yakin hapus data penggajian ini?')) return;
  try {
    const { error } = await db.from('penggajian').delete().eq('id', id);
    if (error) throw error;
    toast('Penggajian dihapus');
    loadPenggajian();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function resetFormPenggajian() {
  document.getElementById('formPenggajian').reset();
  document.getElementById('totalPreview').textContent = 'Rp 0';
}

/* ============================================================
   11. BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Supabase URL:', SUPABASE_URL);
  console.log('🔧 Protocol:', window.location.protocol);

  await cekSession();

  const passEl = document.getElementById('password');
  if (passEl) {
    passEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  if (db) {
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        document.getElementById('appView').style.display = 'none';
        document.getElementById('loginView').style.display = 'flex';
      }
    });
  }
});
