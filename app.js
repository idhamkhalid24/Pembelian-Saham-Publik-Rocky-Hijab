const SUPABASE_URL = 'https://ismjupxoiywttkrekmfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWp1cHhvaXl3dHRrcmVrbWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzc4MDEsImV4cCI6MjA5NDg1MzgwMX0.WVwqEdkPQ_x9NWR8QXTm85mIAvN8d9V2FaMJ2NiAMC0';
const MIDTRANS_WORKER_URL = 'https://midtrans-worker.alfajrihanif24.workers.dev';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const rp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(n || 0)))}`;

let catalogData = [];
let purchasesData = [];

function toast(msg, err = false) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  setTimeout(() => { el.className = 'toast'; }, 3000);
}
function setBusy(v) { 
  const el = $('loading');
  if (el) el.className = v ? 'loading-overlay show' : 'loading-overlay'; 
}

async function loadCatalog() {
  setBusy(true);
  try {
    const { data: catData, error: catErr } = await sb.from('investment_batch_catalog')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    
    if (catErr) throw catErr;
    catalogData = catData || [];

    const catalogIds = catalogData.map(c => c.id);
    if (catalogIds.length > 0) {
      // Ambil portofolio investasi aktif dari investment_batches
      const { data: invBatches, error: invErr } = await sb.from('investment_batches')
        .select('batch_name, amount_invested, investors(name)')
        .eq('status', 'active');
        
      if (invErr) throw invErr;
      purchasesData = invBatches || [];
    }

    renderCatalog();
  } catch (err) {
    console.error(err);
    toast('Gagal memuat data batch investasi', true);
  } finally {
    setBusy(false);
  }
}

function updateLotTotal(catalogId, pricePerLot) {
  const input = document.getElementById(`lots-${catalogId}`);
  const totalEl = document.getElementById(`lot-total-${catalogId}`);
  if (!input || !totalEl) return;
  const lots = Math.max(1, parseInt(input.value) || 1);
  totalEl.textContent = rp(lots * pricePerLot);
}

function renderCatalog() {
  const container = $('catalog-container');
  
  if (catalogData.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <i class="fas fa-box-open" style="font-size:3rem;margin-bottom:1rem;color:var(--secondary);"></i>
        <div style="font-weight:800; font-size: 1.2rem;">Belum ada batch tersedia</div>
        <div style="color:var(--text-muted); font-size:0.9rem;">Nantikan batch investasi kami selanjutnya.</div>
      </div>
    `;
    return;
  }
  
  let html = '';
  catalogData.forEach(c => {
    const slotsLeft = c.max_lots - c.lots_sold - c.lots_pending;
    const pct = c.max_lots > 0 ? Math.min(100, Math.round((c.lots_sold / c.max_lots) * 100)) : 0;
    const isFull = slotsLeft <= 0;
    
    // Hitung investor untuk batch ini
    const batchNameLower = String(c.batch_name || '').trim().toLowerCase();
    const batchPurchases = purchasesData.filter(p => String(p.batch_name || '').trim().toLowerCase() === batchNameLower);
    const investorsMap = {};
    batchPurchases.forEach(p => {
      const name = p.investors?.name || 'Anonim';
      if (!investorsMap[name]) investorsMap[name] = 0;
      const calcLots = Math.floor(Number(p.amount_invested || 0) / Number(c.price_per_lot || 1));
      investorsMap[name] += calcLots;
    });
    
    const investorList = Object.keys(investorsMap).map(name => {
      return `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed var(--border);">
        <span style="font-weight:800; text-transform:capitalize;">${esc(name)}</span>
        <span style="font-weight:900; color:#059669;">${investorsMap[name]} lot</span>
      </div>`;
    }).join('');
    
    const investorHtml = Object.keys(investorsMap).length > 0 ? `
      <div style="background:#FFF; padding:12px; border-radius:8px; border:2px solid var(--border); margin-bottom:16px;">
        <div style="font-size:0.9rem; font-weight:900; margin-bottom:8px; border-bottom:2px solid var(--border); padding-bottom:6px;"><i class="fas fa-users"></i> Daftar Pemegang Saham:</div>
        ${investorList}
      </div>
    ` : `<div style="background:#FFF; padding:12px; border-radius:8px; border:2px dashed var(--border); margin-bottom:16px; text-align:center; font-weight:700; color:var(--text-muted); font-size:0.85rem;">Belum ada pemegang saham. Jadilah yang pertama!</div>`;
    
    html += `
      <div class="card mb-4" style="border-left: 5px solid var(--text-main);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <div style="font-weight:900;font-size:1.25rem;color:var(--text-main); text-transform:uppercase;">${esc(c.batch_name)}</div>
            <div style="font-size:0.9rem;color:var(--text-muted); font-weight:700;">${esc(c.description || '')}</div>
          </div>
          <span class="badge ${isFull ? 'pending' : 'success'}" style="font-size: 0.8rem; padding: 4px 8px;">${isFull ? 'PENUH' : 'TERBUKA'}</span>
        </div>
        
        <div class="row" style="margin-bottom:16px; background:#FDFBF7; padding: 12px; border-radius:8px; border:2px dashed var(--border);">
          <div><div class="stat-label" style="font-size:0.75rem;">Harga / Lot</div><div style="font-weight:900;color:#059669;font-size:1.1rem;">${rp(c.price_per_lot)}</div></div>
          <div><div class="stat-label" style="font-size:0.75rem;">Aktif Mulai</div><div style="font-weight:800;font-size:1rem;">${esc(c.active_month)}</div></div>
          <div><div class="stat-label" style="font-size:0.75rem;">Lot Terjual</div><div style="font-weight:900;font-size:1.1rem;">${c.lots_sold} / ${c.max_lots}</div></div>
        </div>
        
        <div style="background:var(--bg-body);border-radius:999px;height:12px;margin-bottom:16px;overflow:hidden;border:2px solid var(--border);">
          <div style="height:100%;width:${pct}%;background:var(--text-main);border-radius:999px;transition:width 0.4s;"></div>
        </div>
        
        ${investorHtml}
        
        ${!isFull ? `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" id="lots-${c.id}" min="1" max="${slotsLeft}" value="1"
              style="width:70px;padding:8px;border-radius:8px;border:3px solid var(--border);font-weight:800;text-align:center;font-size:1.1rem;"
              oninput="updateLotTotal('${c.id}', ${c.price_per_lot})">
            <span style="font-size:0.9rem;font-weight:800;color:var(--text-muted);">lot =</span>
          </div>
          <div style="flex:1; display:flex; align-items:center; gap:12px;">
            <span id="lot-total-${c.id}" style="font-weight:900;color:var(--primary);background:var(--text-main);padding:8px 12px;border-radius:8px;display:inline-block;min-width:120px;text-align:center;font-size:1.1rem;">${rp(c.price_per_lot)}</span>
            <button class="btn primary" style="flex:1; padding: 12px;" onclick="promptBuyLot('${c.id}', '${esc(c.batch_name)}', ${c.price_per_lot}, ${slotsLeft})">Beli Sekarang</button>
          </div>
        </div>` : `<div style="color:var(--danger);font-size:0.95rem;font-weight:800; text-align:center; padding: 8px; border:2px dashed var(--danger); border-radius:8px;">Semua lot sudah habis terjual.</div>`}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.promptBuyLot = function(catalogId, batchName, pricePerLot, maxLots) {
  const input = document.getElementById(`lots-${catalogId}`);
  const lots = Math.max(1, parseInt(input?.value || '1'));
  if (lots > maxLots) {
    toast(`Maksimal pembelian sisa ${maxLots} lot`, true);
    return;
  }
  
  const amount = lots * pricePerLot;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:3px solid #000; padding-bottom:12px;">
        <h3 style="margin:0;font-size:1.25rem;font-weight:900;text-transform:uppercase;">Data Pembeli</h3>
        <button class="btn" style="padding:4px 8px; font-size:1rem;" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
      </div>
      
      <p style="font-size:0.95rem;font-weight:700;margin-bottom:20px;color:var(--text-muted)">Anda akan membeli <strong style="color:#000">${lots} lot</strong> batch <strong style="color:#000">${batchName}</strong> (Total: <strong style="color:var(--success);font-size:1.1rem;">${rp(amount)}</strong>). Silakan isi data berikut:</p>
      
      <div class="input-group mb-3">
        <label>Nama Lengkap (Username)</label>
        <input type="text" id="buyerName" class="input" placeholder="Contoh: Budi Santoso" autocomplete="name">
      </div>
      
      <div class="input-group mb-4">
        <label>Nomor WhatsApp</label>
        <input type="tel" id="buyerPhone" class="input" placeholder="Contoh: 081234567890" autocomplete="tel">
      </div>
      
      <button class="btn success full" style="padding: 14px; font-size:1.1rem;" id="processBuyBtn">Lanjut Pembayaran</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#processBuyBtn').onclick = async () => {
    const name = modal.querySelector('#buyerName').value.trim();
    const phone = modal.querySelector('#buyerPhone').value.trim();
    
    if (!name) { toast('Nama Lengkap harus diisi', true); return; }
    if (!phone) { toast('Nomor WhatsApp harus diisi', true); return; }
    
    modal.remove();
    await processPurchase(name, phone, catalogId, batchName, lots, amount);
  };
};

async function processPurchase(name, phone, catalogId, batchName, lots, amount) {
  setBusy(true);
  try {
    // 1. Cari atau buat Investor
    let investorId = null;
    
    // Coba cari berdasar nama (ilike) atau nomor telepon
    const { data: existing, error: errSearch } = await sb.from('investors')
      .select('id')
      .or(`name.ilike.${name},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();
      
    if (existing) {
      investorId = existing.id;
    } else {
      // Buat baru jika belum ada
      const { data: newInvestor, error: errCreate } = await sb.from('investors').insert([{
        name: name,
        phone: phone,
        pin: 'PENDING'
      }]).select('id').single();
      
      if (errCreate) throw new Error('Gagal membuat profil investor: ' + errCreate.message);
      investorId = newInvestor.id;
    }
    
    // 2. Buat Transaksi Pembelian
    const { data: trx, error: errTrx } = await sb.from('investment_purchases').insert([{
      investor_id: investorId,
      catalog_id: catalogId,
      lots: lots,
      amount: amount,
      payment_status: 'pending',
      approval_status: 'waiting'
    }]).select().single();
    if (errTrx) throw errTrx;
    
    // 3. Request Snap Token
    const res = await fetch(MIDTRANS_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: trx.id,
        gross_amount: amount,
        first_name: name,
        phone: phone
      })
    });
    
    if (!res.ok) throw new Error('Gagal menghubungi server pembayaran');
    const data = await res.json();
    
    if (!data.token) {
      const errMsg = data.error_messages ? data.error_messages.join(', ') : JSON.stringify(data);
      throw new Error('Gagal mendapatkan token Midtrans: ' + errMsg);
    }
    
    // 4. Update Snap Token di DB
    await sb.from('investment_purchases').update({ midtrans_snap_token: data.token }).eq('id', trx.id);
    
    // 5. Tampilkan Popup Midtrans
    if (window.snap) {
      window.snap.pay(data.token, {
        onSuccess: async function(result) {
          await sb.from('investment_purchases').update({ 
            payment_status: 'paid',
            midtrans_order_id: result.order_id,
            paid_at: new Date().toISOString()
          }).eq('id', trx.id);
          toast('Pembayaran berhasil! Mengarahkan ke WhatsApp...');
          
          const waMsg = `Halo Admin, saya telah melakukan pembayaran investasi lot saham. Berikut datanya:\n\nNama: ${name}\nNo. WhatsApp: ${phone}\nBatch: ${batchName}\nJumlah: ${lots} lot\nTotal Bayar: ${rp(amount)}\n\n(Mohon lampirkan screenshot bukti pembayaran dari Midtrans di bawah ini)`;
          const waUrl = `https://wa.me/6285172107731?text=${encodeURIComponent(waMsg)}`;
          
          setTimeout(() => { window.location.href = waUrl; }, 1500);
        },
        onPending: async function(result) {
          toast('Silakan selesaikan pembayaran. Mengarahkan ke WhatsApp...');
          
          const waMsg = `Halo Admin, saya sedang memproses pembayaran investasi lot saham. Berikut datanya:\n\nNama: ${name}\nNo. WhatsApp: ${phone}\nBatch: ${batchName}\nJumlah: ${lots} lot\nTotal Bayar: ${rp(amount)}\n\n(Mohon infokan jika butuh bantuan lebih lanjut)`;
          const waUrl = `https://wa.me/6285172107731?text=${encodeURIComponent(waMsg)}`;
          
          setTimeout(() => { window.location.href = waUrl; }, 1500);
        },
        onError: function(result) {
          toast('Pembayaran gagal.', true);
        },
        onClose: function() {
          toast('Popup ditutup. Pembayaran pending.');
        }
      });
    } else {
      toast('Sistem Midtrans belum siap, mohon refresh halaman.', true);
    }
    
  } catch(e) {
    console.error(e);
    toast(e.message || 'Terjadi kesalahan sistem', true);
  } finally {
    setBusy(false);
  }
}

// Initial Load
loadCatalog();
