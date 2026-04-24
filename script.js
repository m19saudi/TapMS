let db, products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

// Initialize
async function init() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        firebase.initializeApp(config);
        db = firebase.database();
        db.ref('/').on('value', snap => {
            const data = snap.val() || {};
            products = data.products || [];
            queue = data.queue || [];
            history = data.history || [];
            orderCounter = data.orderCounter || 0;
            document.getElementById('status-dot').className = "w-3 h-3 rounded-full bg-green-500 shadow-md";
            render();
        });
    } catch(e) { console.error("Config Error", e); }
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

// Animations & Taps
window.handleProductTap = (id) => {
    const el = document.getElementById(`prod-${id}`);
    if (el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

// Orders
window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    if(summaryEnabled) openSummary(order);
    cart = []; render(); pushData();
};

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.reorder = idx => { const item = history[idx]; orderCounter++; queue.unshift({ ...item, orderNum: orderCounter }); pushData(); };

// Render Logic
function render() {
    // Nav Badges
    document.getElementById('nav-badge').classList.toggle('hidden', queue.length === 0);
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-count-top').innerText = totalQty;
    document.getElementById('cart-count-top').classList.toggle('hidden', totalQty === 0);

    // Categories
    const uniqueCats = [...new Set(products.map(p => p.cat || "").filter(Boolean))];
    document.getElementById('category-list').innerHTML = uniqueCats.map(c => `<option value="${c}">`).join('');
    const cats = ["All", ...uniqueCats];
    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).sort((a,b) => b.fav - a.fav);

    // Cashier UI
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock UI
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50"><img src="${p.img || ''}" class="w-full h-full object-cover"></div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                <div class="flex items-center gap-2 mt-1">
                    <input type="text" list="category-list" value="${p.cat || ''}" onchange="editItem(${p.id}, 'cat', this.value)" placeholder="Category: None" class="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md outline-none w-24">
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-xs outline-none bg-transparent">
                </div>
            </div>
            <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
            <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    // Pending
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
            <div class="flex flex-wrap gap-2 mb-4">
                ${ord.items.map(i => `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">${i.name} x${i.qty}</span>`).join('')}
            </div>
            <button onclick="approveOrder(${idx})" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Approve $${ord.total.toFixed(2)}</button>
        </div>
    `).join('');

    // History
    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
        <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 shadow-sm" onclick="toggleOrderExpand(${idx})">
            <div class="flex justify-between items-center">
                <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
                <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
            </div>
            <div class="order-detail">
                <p class="text-[10px] text-slate-400 font-bold mb-3">${h.date}</p>
                <button onclick="event.stopPropagation(); reorder(${idx})" class="w-full py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase">Re-Order</button>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

// Utility Helpers
window.setCategory = (cat) => { currentCat = cat; render(); };
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
};
window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = sec==='orders' ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    document.getElementById('sub-btn-stock').className = sec==='stock' ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
};
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.confirmWipe = () => { if (confirm("Reset system?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }); location.reload(); } };
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };
window.toggleOrderExpand = idx => document.getElementById(`hist-card-${idx}`).classList.toggle('order-expanded');
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.executeExport = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(products)], {type:"application/json"})); a.download=`TapMS_Backup.json`; a.click(); closeBackupModal(); };
window.triggerImport = () => document.getElementById('db-import-input').click();
window.importDatabase = (e) => { const r = new FileReader(); r.onload = (ev) => { products = JSON.parse(ev.target.result); pushData(); closeBackupModal(); }; r.readAsText(e.target.files[0]); };
window.toggleSummary = () => { summaryEnabled = !summaryEnabled; document.getElementById('toggle-dot').className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300"; };
function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold uppercase"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('summary-overlay').classList.add('active');
}
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');

init();
