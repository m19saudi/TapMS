let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
let searchTerm = "", currentCat = "All", summaryEnabled = false;

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
            } else {
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456").catch(e => console.error(e));
            }
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
        categories = data.categories || ["All"];
        if (!categories.includes("All")) categories.unshift("All");
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter, categories }); }

function render() {
    // Nav Badge logic
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Category Bar (Top of Store)
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    // Product Grid (Store)
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).sort((a,b) => b.fav - a.fav);
    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div class="product-card bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative select-none cursor-pointer" onclick="handleProductTap(${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10 scale-105">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 pointer-events-none">
                    <img src="${p.img || ''}" class="product-image">
                </div>
                <h3 class="font-extrabold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>`;
        }).join('');
    }

    // Inventory List (Manage View) - RESTORED FULL CATEGORY TYPING
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 space-y-4 shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                        <img src="${p.img || ''}" class="w-full h-full object-cover">
                        <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold" placeholder="IMG URL">
                    </div>
                    <div class="flex-1">
                        <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-black text-sm bg-transparent outline-none truncate" placeholder="Product Name">
                        <div class="flex items-center mt-1">
                            <span class="text-blue-600 font-black text-[11px] mr-1">$</span>
                            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-24 font-black text-sm bg-transparent outline-none text-blue-600">
                        </div>
                    </div>
                    <button onclick="removeItem(${p.id})" class="text-red-200 hover:text-red-400 transition-colors"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
                
                <div class="bg-slate-50 rounded-[1.5rem] p-3 border border-slate-100">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="tag" class="w-3 h-3 text-slate-400"></i>
                        <input type="text" value="${p.cat || ''}" onchange="editItem(${p.id}, 'cat', this.value)" placeholder="Enter category manually..." class="flex-1 bg-white px-3 py-2 rounded-xl text-[11px] font-black text-blue-600 border border-slate-200 outline-none uppercase shadow-sm">
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="editItem(${p.id}, 'cat', '')" class="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-400 uppercase">Clear</button>
                        ${categories.filter(c => c !== "All").map(c => `
                            <button onclick="editItem(${p.id}, 'cat', '${c}')" class="px-3 py-1 rounded-lg text-[9px] font-black uppercase ${p.cat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}">${c}</button>
                        `).join('')}
                    </div>
                </div>
            </div>`).join('');
    }

    // Category Manager List - RESTORED
    const catManager = document.getElementById('category-manager-list');
    if(catManager) {
        catManager.innerHTML = categories.filter(c => c !== "All").map((c, idx) => `
            <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 group">
                <div class="bg-white w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] text-slate-400 shadow-sm">${idx+1}</div>
                <input type="text" value="${c}" onchange="editCatName(${idx+1}, this.value)" class="flex-1 bg-transparent font-black text-xs outline-none px-2 uppercase text-slate-700">
                <button onclick="removeCat(${idx+1})" class="p-2 text-red-100 group-hover:text-red-400 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
    }

    renderPendingAndHistory();
    lucide.createIcons();
}

// --- CORE PRODUCT LOGIC ---
window.handleProductTap = (id) => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.openCart = () => { if(cart.length) { document.getElementById('cart-overlay').classList.add('active'); renderCart(); } };
window.closeCart = () => document.getElementById('cart-overlay').classList.remove('active');
window.confirmWipeCart = () => { if(confirm("Discard current cart?")) { cart = []; closeCart(); render(); } };

function renderCart() {
    const list = document.getElementById('cart-items-list');
    list.innerHTML = cart.map((item, idx) => `
        <div class="flex items-center justify-between border-b border-slate-50 py-4">
            <div class="flex items-center gap-3">
                <img src="${item.img}" class="w-11 h-11 rounded-2xl object-cover bg-slate-100">
                <div><p class="font-black text-sm truncate w-32 uppercase">${item.name}</p><p class="text-blue-600 font-black text-[10px]">$${(item.price * item.qty).toFixed(2)}</p></div>
            </div>
            <div class="flex items-center gap-3 bg-slate-100 p-1 rounded-2xl">
                <button onclick="updateCartQty(${idx}, -1)" class="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm"><i data-lucide="minus" class="w-3 h-3"></i></button>
                <span class="font-black text-xs w-6 text-center">${item.qty}</span>
                <button onclick="updateCartQty(${idx}, 1)" class="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm"><i data-lucide="plus" class="w-3 h-3"></i></button>
            </div>
        </div>`).join('');
    lucide.createIcons();
}

window.updateCartQty = (idx, d) => { cart[idx].qty += d; if(cart[idx].qty <= 0) cart.splice(idx, 1); if(!cart.length) closeCart(); render(); renderCart(); };

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    if(summaryEnabled) openSummary(order);
    cart = []; render(); pushData();
};

// --- RESTORED: ADVANCED HISTORY & ORDERS ---
function renderPendingAndHistory() {
    const pList = document.getElementById('pending-list');
    if(pList) {
        pList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Live Orders</h2>` + queue.map((ord, idx) => `
            <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100 shadow-sm">
                <div class="bg-white px-3 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-2 mb-3">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Customer Name / Table..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <div class="flex flex-wrap gap-2 mb-5">
                    ${ord.items.map(i => `<span class="bg-white text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-100 active:scale-95 transition-transform">Complete $${ord.total.toFixed(2)}</button>
                    <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-300 rounded-2xl active:bg-red-50"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>`).join('');
    }
    
    const hList = document.getElementById('history-list');
    if(hList) {
        hList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">Order History</h2>` + history.map((h, idx) => `
            <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3 transition-all cursor-pointer" onclick="this.classList.toggle('order-expanded')">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-[10px] text-slate-400">#${h.orderNum}</div>
                        <span class="font-black text-slate-700 text-sm uppercase truncate w-32">${h.desc || 'No Tag'}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-300 transition-transform"></i>
                    </div>
                </div>
                <div class="order-detail">
                    <div class="flex items-center justify-between mb-4">
                        <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest">${h.date}</p>
                        <span class="bg-green-50 text-green-500 text-[8px] font-black px-2 py-1 rounded-lg uppercase">Completed</span>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-5">
                        ${h.items.map(i => `<span class="bg-slate-50 text-slate-500 text-[10px] font-black px-3 py-1.5 rounded-xl border border-slate-100">${i.name} x${i.qty}</span>`).join('')}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); reorder(${idx})" class="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-transform">Duplicate Order</button>
                        <button onclick="event.stopPropagation(); removeItemFromList('history', ${idx})" class="px-5 bg-red-50 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            </div>`).join('');
    }
    
    const tq = cart.reduce((s, i) => s + i.qty, 0);
    const tb = document.getElementById('cart-count-top');
    if(tb) { tb.innerText = tq; tb.classList.toggle('hidden', tq === 0); }
}

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.reorder = idx => { orderCounter++; queue.unshift({ ...history[idx], orderNum: orderCounter, date: new Date().toLocaleTimeString() }); pushData(); };
window.removeItemFromList = (l, i) => { if(confirm("Remove this record?")) { if(l === 'queue') queue.splice(i, 1); else history.splice(i, 1); pushData(); } };
window.updateTag = (l, i, v) => { if(l === 'queue') queue[i].desc = v; else history[i].desc = v; pushData(); };

// --- UI HELPERS ---
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
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black bg-white text-blue-600 shadow-sm" : "px-6 py-2 rounded-xl text-xs font-black text-slate-400";
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black bg-white text-blue-600 shadow-sm" : "px-6 py-2 rounded-xl text-xs font-black text-slate-400";
};

// --- SYSTEM UTILS ---
window.toggleCategoryManager = () => document.getElementById('category-manager-card').classList.toggle('manager-expanded');
window.addCat = () => { const n = prompt("New Category Name:"); if(n) { categories.push(n); pushData(); } };
window.editCatName = (i, n) => { const old = categories[i]; categories[i] = n; products.forEach(p => { if(p.cat === old) p.cat = n; }); pushData(); };
window.removeCat = i => { if(confirm("Delete category? Items using this will have no category.")) { const old = categories[i]; categories.splice(i, 1); products.forEach(p => { if(p.cat === old) p.cat = ""; }); pushData(); } };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.removeItem = id => { if(confirm("Delete product?")) { products = products.filter(x => x.id !== id); pushData(); } };
window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };
window.toggleSummary = () => { summaryEnabled = !summaryEnabled; document.getElementById('toggle-dot').className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300"; document.getElementById('summary-toggle-ui').querySelector('span').innerText = summaryEnabled ? "Auto-Summary: ON" : "Auto-Summary: OFF"; };
function openSummary(ord) { document.getElementById('sum-id').innerText = `#${ord.orderNum}`; document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`; document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-black uppercase"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join(''); document.getElementById('summary-overlay').classList.add('active'); }
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.executeExport = () => { const b = new Blob([JSON.stringify({products, categories}, null, 2)], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup.json`; a.click(); closeBackupModal(); };
window.resetOnlyOrders = () => { if(confirm("Wipe all order history? (Product stock will remain)")) { queue = []; history = []; orderCounter = 0; pushData(); closeBackupModal(); } };
window.confirmWipe = () => { if (confirm("DANGER: This wipes everything (Products + History). Continue?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0, categories: ["All"] }); location.reload(); } };

initTapMS();
