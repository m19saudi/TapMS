let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
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

function pushData() { 
    db.ref('/').set({ products, queue, history, orderCounter, categories }); 
}

// --- CORE RENDERING ---
function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // Category Bar
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" 
                class="px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">
                ${c}
            </button>
        `).join('');
    }

    // Cashier Grid
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) && 
        (currentCat === "All" || (p.cat || "") === currentCat)
    ).sort((a,b) => b.fav - a.fav);

    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => {
            const cartItem = cart.find(c => c.id === p.id);
            const qty = cartItem ? cartItem.qty : 0;
            return `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative select-none cursor-pointer" onclick="handleProductTap(event, ${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10 animate-in zoom-in duration-200">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                    <img src="${p.img || ''}" class="product-image">
                    ${p.fav ? '<div class="absolute top-2 left-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>
            `;
        }).join('');
    }

    // Stock Management
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 space-y-4">
                <div class="flex items-center gap-4">
                    <div class="flex flex-col gap-1">
                        <button onclick="moveItem(${idx}, -1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                        <button onclick="moveItem(${idx}, 1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                    </div>
                    <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                        <img src="${p.img || ''}" class="w-full h-full object-cover">
                        <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold" placeholder="URL">
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-extrabold text-sm bg-transparent outline-none truncate block">
                        <div class="flex items-center mt-1">
                            <span class="text-blue-600 font-black text-[11px] mr-1">$</span>
                            <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-24 font-black text-sm bg-transparent outline-none text-blue-600">
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'} transition-all"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                        <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 px-1">
                        <i data-lucide="tag" class="w-3 h-3 text-slate-300"></i>
                        <span class="text-[9px] font-black uppercase text-slate-400">Category: <span class="${p.cat ? 'text-blue-600' : 'text-slate-300'}">${p.cat || 'NONE'}</span></span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="editItem(${p.id}, 'cat', '')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${!p.cat ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'}">None</button>
                        ${categories.filter(c => c !== "All").map(c => `
                            <button onclick="editItem(${p.id}, 'cat', '${c}')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${p.cat === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-100'}">${c}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    const catManager = document.getElementById('category-manager-list');
    if(catManager) {
        catManager.innerHTML = categories.filter(c => c !== "All").map((c, idx) => `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div class="flex flex-col">
                    <button onclick="moveCat(${idx+1}, -1)" class="p-1 text-slate-400 hover:text-blue-600"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                    <button onclick="moveCat(${idx+1}, 1)" class="p-1 text-slate-400 hover:text-blue-600"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
                </div>
                <input type="text" value="${c}" onchange="editCatName(${idx+1}, this.value)" class="flex-1 bg-transparent font-bold text-xs outline-none px-2">
                <button onclick="removeCat(${idx+1})" class="p-2 text-red-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
    }

    renderPendingAndHistory();
    lucide.createIcons();
}

// --- CART MGMT ---
window.openCart = () => { if(cart.length) { document.getElementById('cart-overlay').classList.add('active'); renderCart(); } else { alert("Cart is empty!"); } };
window.closeCart = () => document.getElementById('cart-overlay').classList.remove('active');
window.confirmWipeCart = () => { if(confirm("Clear entire cart?")) { cart = []; closeCart(); render(); } };
function renderCart() {
    const list = document.getElementById('cart-items-list');
    list.innerHTML = cart.map((item, idx) => `
        <div class="flex items-center justify-between border-b border-slate-50 py-3">
            <div class="flex items-center gap-3">
                <img src="${item.img}" class="w-10 h-10 rounded-xl object-cover bg-slate-100">
                <div><p class="font-bold text-sm truncate w-32">${item.name}</p><p class="text-blue-600 font-black text-[10px]">$${(item.price * item.qty).toFixed(2)}</p></div>
            </div>
            <div class="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button onclick="updateCartQty(${idx}, -1)" class="w-7 h-7 flex items-center justify-center"><i data-lucide="minus" class="w-3 h-3"></i></button>
                <span class="font-black text-xs w-4 text-center">${item.qty}</span>
                <button onclick="updateCartQty(${idx}, 1)" class="w-7 h-7 flex items-center justify-center"><i data-lucide="plus" class="w-3 h-3"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.updateCartQty = (idx, d) => { cart[idx].qty += d; if(cart[idx].qty <= 0) cart.splice(idx, 1); if(!cart.length) closeCart(); render(); renderCart(); };

// --- ACTIONS ---
window.handleProductTap = (e, id) => {
    if (e) e.preventDefault(); 
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const order = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(order);
    if(summaryEnabled) openSummary(order);
    cart = []; render(); pushData();
};

// --- SYSTEM UTILS ---
window.resetOnlyOrders = () => { if(confirm("Clear all orders?")) { queue = []; history = []; orderCounter = 0; pushData(); closeBackupModal(); } };
window.toggleCategoryManager = () => document.getElementById('category-manager-card').classList.toggle('manager-expanded');
window.addCat = () => { const n = prompt("Category name:"); if(n) { categories.push(n); pushData(); } };
window.editCatName = (i, n) => { const old = categories[i]; categories[i] = n; products.forEach(p => { if(p.cat === old) p.cat = n; }); pushData(); };
window.removeCat = i => { if(confirm("Delete?")) { const old = categories[i]; categories.splice(i, 1); products.forEach(p => { if(p.cat === old) p.cat = ""; }); pushData(); } };
window.moveCat = (i, s) => { const n = i + s; if(n < 1 || n >= categories.length) return; [categories[i], categories[n]] = [categories[n], categories[i]]; pushData(); };
window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Product', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.setCategory = (cat) => { currentCat = cat; render(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };
window.moveItem = (index, step) => { const newIndex = index + step; if (newIndex < 0 || newIndex >= products.length) return; [products[index], products[newIndex]] = [products[newIndex], products[index]]; pushData(); };

window.approveOrder = idx => { history.unshift({ ...queue[idx], date: new Date().toLocaleString() }); queue.splice(idx, 1); pushData(); };
window.reorder = idx => { orderCounter++; queue.unshift({ ...history[idx], orderNum: orderCounter, date: new Date().toLocaleTimeString() }); pushData(); };
window.updateTag = (l, i, v) => { if(l === 'queue') queue[i].desc = v; else history[i].desc = v; pushData(); };
window.removeItemFromList = (l, i) => { if(l === 'queue') queue.splice(i, 1); else history.splice(i, 1); pushData(); };
window.toggleOrderExpand = idx => document.getElementById(`hist-card-${idx}`).classList.toggle('order-expanded');
window.editOrderDetails = idx => { cart = JSON.parse(JSON.stringify(history[idx].items)); history.splice(idx, 1); window.showView('cashier'); render(); };

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
window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    label.innerText = summaryEnabled ? "Summary: ON" : "Summary: OFF";
};
function openSummary(ord) {
    document.getElementById('sum-id').innerText = `#${ord.orderNum}`;
    document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`;
    document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('summary-overlay').classList.add('active');
}
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');
window.executeExport = () => { const b = new Blob([JSON.stringify({products, categories}, null, 2)], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup.json`; a.click(); closeBackupModal(); };
window.triggerImport = () => document.getElementById('db-import-input').click();
window.importDatabase = (e) => { const r = new FileReader(); r.onload = (ev) => { try { const d = JSON.parse(ev.target.result); products = d.products; categories = d.categories; pushData(); } catch { alert("Invalid!"); } }; r.readAsText(e.target.files[0]); };
window.confirmWipe = () => { if (confirm("Wipe all?")) { db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0, categories: ["All"] }); location.reload(); } };

function renderPendingAndHistory() {
    const pList = document.getElementById('pending-list');
    if(pList) {
        pList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
            <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
                <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-2 mb-3">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    ${ord.items.map(i => `<div class="item-tag-hover bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-blue-200">${i.name} x${i.qty}<div class="item-preview-popup"><img src="${i.img}" class="w-full h-full object-cover rounded-lg"></div></div>`).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
                    <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        `).join('');
    }
    const hList = document.getElementById('history-list');
    if(hList) {
        hList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
            <div id="hist-card-${idx}" class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3" onclick="toggleOrderExpand(${idx})">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3"><span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span><input type="text" value="${h.desc || ''}" onchange="event.stopPropagation(); updateTag('history', ${idx}, this.value)" class="font-bold text-slate-700 text-sm bg-transparent outline-none"></div>
                    <div class="flex items-center gap-3"><p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p><button onclick="event.stopPropagation(); reorder(${idx})" class="p-2 bg-slate-50 rounded-xl text-slate-400"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button></div>
                </div>
                <div class="order-detail">
                    <p class="text-[10px] text-slate-400 font-bold mb-3">${h.date}</p>
                    <div class="flex flex-wrap gap-2 mb-4">${h.items.map(i => `<span class="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100">${i.name} x${i.qty}</span>`).join('')}</div>
                    <div class="flex gap-2"><button onclick="event.stopPropagation(); editOrderDetails(${idx})" class="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px]">Edit</button><button onclick="event.stopPropagation(); removeItemFromList('history', ${idx})" class="px-4 py-3 bg-red-50 text-red-400 rounded-xl"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
                </div>
            </div>
        `).join('');
    }
    const tq = cart.reduce((s, i) => s + i.qty, 0);
    const tb = document.getElementById('cart-count-top');
    if(tb) { tb.innerText = tq; tb.classList.toggle('hidden', tq === 0); }
}

initTapMS();
