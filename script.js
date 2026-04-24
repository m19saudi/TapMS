let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "", currentCat = "All", summaryEnabled = false;

// --- INITIALIZATION ---
async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        YOUR_UID = config.adminUid;
        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.onAuthStateChanged(user => {
            if (user && user.uid === YOUR_UID) {
                document.getElementById('status-dot').className = "w-3 h-3 rounded-full dot-connected";
                startSync();
            } else { auth.signInWithEmailAndPassword("admin@gmail.com", "123456").catch(e => console.error(e)); }
        });
    } catch (e) { console.error(e); }
}

function startSync() {
    db.ref('/').on('value', snap => {
        const data = snap.val() || {};
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

// Instant Wipe Logic
window.instantWipe = () => {
    if (confirm("Wipe system and delete everything?")) {
        db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 });
        location.reload();
    }
};

// --- RENDER ENGINE ---
function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Categories List
    const uniqueCats = [...new Set(products.map(p => p.cat || "Other"))];
    const cats = ["All", ...uniqueCats];
    
    // Update Datalist for easy category selection in Stock
    document.getElementById('category-options').innerHTML = uniqueCats.map(c => `<option value="${c}">`).join('');

    document.getElementById('cat-bar').innerHTML = cats.map(c => `
        <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
    `).join('');

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && 
        (currentCat === "All" || (p.cat || "Other") === currentCat)
    ).sort((a,b) => b.fav - a.fav);

    // Cashier Grid
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm cursor-pointer" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[11px] truncate px-1 pointer-events-none">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-0.5 pointer-events-none">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Stock Management (Order by most recent first)
    const stockList = [...products].sort((a,b) => b.id - a.id);
    document.getElementById('inventory-list').innerHTML = stockList.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                <div class="flex items-center gap-2 mt-1">
                    <input type="text" list="category-options" value="${p.cat || 'Other'}" onchange="editItem(${p.id}, 'cat', this.value)" placeholder="Category" class="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md outline-none w-24">
                    <span class="text-blue-600 font-black text-xs">$</span>
                    <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-16 font-black text-xs outline-none">
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    // Render logic for Orders/History remains the same...
    renderOrders();
    lucide.createIcons();
}

// Fixed Animation Handler
window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) {
        el.classList.remove('tap-feedback');
        void el.offsetWidth; // Force reflow
        el.classList.add('tap-feedback');
    }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    
    // Quick badge update without full re-render for performance
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    topBadge.innerText = totalQty;
    topBadge.classList.remove('hidden');
};

// --- DATA HANDLERS ---
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, cat: 'Other' }); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    if(summaryEnabled) openSummary(order);
    cart = []; render(); pushData();
};

// ... [Keep helper functions: renderOrders, toggleSummary, openSummary, backups from previous code] ...

function renderOrders() {
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
            <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-2 mb-3">
                <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Tag..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
            </div>
            <div class="flex gap-2">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
                <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>`).join('');

    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
        <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 shadow-sm transition-all overflow-hidden" onclick="toggleOrderExpand(${idx})">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span>
                    <input type="text" value="${h.desc || ''}" onchange="event.stopPropagation(); updateTag('history', ${idx}, this.value)" class="font-bold text-slate-700 text-sm bg-transparent outline-none">
                </div>
                <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
            </div>
        </div>`).join('');
}

// Backup Functions
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.executeExport = () => { const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `TapMS_Backup.json`; a.click(); closeBackupModal(); };
window.triggerImport = () => document.getElementById('db-import-input').click();
window.importDatabase = (e) => { const reader = new FileReader(); reader.onload = (ev) => { try { products = JSON.parse(ev.target.result); pushData(); alert("Restored!"); closeBackupModal(); } catch { alert("Invalid File!"); }}; reader.readAsText(e.target.files[0]); };

// View Handlers
window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
};
window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
};

initTapMS();
