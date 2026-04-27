let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
let searchTerm = "", currentCat = "All", summaryEnabled = false;
let selectedIds = new Set(); // For bulk actions

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
    // 1. Navigation Badges
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);
    
    // 2. Category Tabs
    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" class="px-5 py-2 rounded-full text-[10px] font-black uppercase flex-shrink-0 transition-all ${currentCat === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    // 3. Cashier View
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).sort((a,b) => b.fav - a.fav);
    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = filtered.map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative select-none cursor-pointer" onclick="handleProductTap(event, ${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                    <img src="${p.img || ''}" class="product-image" onerror="this.src='https://placehold.co/400x400?text=No+Image'">
                    ${p.fav ? '<div class="absolute top-2 left-2 text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>`;
        }).join('');
    }

    // 4. Summary Button Toggle UI
    const summaryBtn = document.getElementById('summary-toggle-ui');
    if (summaryBtn) {
        const dot = document.getElementById('toggle-dot');
        const label = summaryBtn.querySelector('span');
        if (summaryEnabled) {
            dot.className = "w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]";
            label.innerText = "Summary: ON";
            label.className = "text-[10px] font-black uppercase text-blue-600";
            summaryBtn.className = "flex items-center gap-3 bg-blue-50 px-4 py-4 rounded-2xl border border-blue-200 shadow-sm flex-1 active:scale-95 transition-all";
        } else {
            dot.className = "w-2.5 h-2.5 rounded-full bg-slate-300";
            label.innerText = "Summary: OFF";
            label.className = "text-[10px] font-black uppercase text-slate-500";
            summaryBtn.className = "flex items-center gap-3 bg-white px-4 py-4 rounded-2xl border border-slate-100 shadow-sm flex-1 active:scale-95 transition-all";
        }
    }

    // 5. Bulk Bar
    const bulkBar = document.getElementById('bulk-bar');
    if(bulkBar) {
        bulkBar.classList.toggle('hidden', selectedIds.size === 0);
        document.getElementById('selected-count').innerText = `${selectedIds.size} SELECTED`;
    }

    // 6. Inventory List
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border ${selectedIds.has(p.id) ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100'} space-y-4 shadow-sm transition-all">
                <div class="flex items-center gap-4">
                    <input type="checkbox" class="bulk-check" ${selectedIds.has(p.id) ? 'checked' : ''} onchange="toggleSelectProduct(${p.id})">
                    <div class="flex flex-col gap-1">
                        <button onclick="moveItem(${idx}, -1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                        <button onclick="moveItem(${idx}, 1)" class="p-1.5 bg-slate-50 rounded-lg text-slate-400"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                    </div>
                    <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                        <img src="${p.img || ''}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/100x100?text=x'">
                        <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold" placeholder="URL">
                    </div>
                    <div class="flex-1 min-w-0">
                        <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-extrabold text-sm bg-transparent outline-none truncate block">
                        <div class="flex items-center mt-1"><span class="text-blue-600 font-black text-[11px] mr-1">$</span><input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="w-24 font-black text-sm bg-transparent outline-none text-blue-600"></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                        <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400 active:scale-95 transition-all"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="editItem(${p.id}, 'cat', '')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${!p.cat ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}">None</button>
                    ${categories.filter(c => c !== "All").map(c => `<button onclick="editItem(${p.id}, 'cat', '${c}')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${p.cat === c ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}">${c}</button>`).join('')}
                </div>
            </div>`).join('');
    }

    renderPendingAndHistory();
    lucide.createIcons();
}

// --- CSV & BULK LOGIC ---
window.importCSV = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split('\n').slice(1).filter(r => r.trim() !== '');
        const newItems = rows.map(row => {
            const [name, price, img, cat] = row.split(',').map(i => i.trim());
            return { id: Date.now() + Math.random(), name: name || 'New', price: parseFloat(price) || 0, img: img || '', fav: false, cat: cat || '' };
        });
        products = [...newItems, ...products];
        pushData();
        alert(`Success! ${newItems.length} items added.`);
    };
    reader.readAsText(file);
    e.target.value = '';
};

window.toggleSelectProduct = (id) => {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    render();
};

window.deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} products?`)) {
        products = products.filter(p => !selectedIds.has(p.id));
        selectedIds.clear();
        pushData();
    }
};

// --- REST OF THE POS LOGIC ---
window.handleProductTap = (e, id) => {
    if (e) e.preventDefault(); 
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    setTimeout(() => render(), 150); 
};

window.toggleSummary = () => { summaryEnabled = !summaryEnabled; render(); };

window.addItem = () => { products.unshift({ id: Date.now(), name: 'New Product', price: 0, img: '', fav: false, cat: '' }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); if(selectedIds.has(id)) selectedIds.delete(id); pushData(); };

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const ord = { orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() };
    queue.unshift(ord);
    if(summaryEnabled) openSummary(ord);
    cart = []; render(); pushData();
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab transition-all':'flex flex-col items-center gap-2 p-3 text-slate-400 transition-all';
};

// Helper UI functions (kept for functionality)
window.openCart = () => { if(cart.length) { document.getElementById('cart-overlay').classList.add('active'); renderCart(); } };
window.closeCart = () => document.getElementById('cart-overlay').classList.remove('active');
function renderCart() {
    const list = document.getElementById('cart-items-list');
    list.innerHTML = cart.map((item, idx) => `
        <div class="flex items-center justify-between py-3 border-b border-slate-50">
            <div class="flex items-center gap-3">
                <img src="${item.img}" class="w-10 h-10 rounded-xl object-cover" onerror="this.src='https://placehold.co/100x100?text=x'">
                <div><p class="font-bold text-sm uppercase">${item.name}</p><p class="text-blue-600 font-black text-[10px]">$${(item.price * item.qty).toFixed(2)}</p></div>
            </div>
            <div class="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                <button onclick="updateCartQty(${idx}, -1)" class="w-7 h-7 flex items-center justify-center"><i data-lucide="minus" class="w-3 h-3"></i></button>
                <span class="font-black text-xs">${item.qty}</span>
                <button onclick="updateCartQty(${idx}, 1)" class="w-7 h-7 flex items-center justify-center"><i data-lucide="plus" class="w-3 h-3"></i></button>
            </div>
        </div>`).join('');
    lucide.createIcons();
}
window.updateCartQty = (idx, d) => { cart[idx].qty += d; if(cart[idx].qty <= 0) cart.splice(idx, 1); if(!cart.length) closeCart(); render(); renderCart(); };

function renderPendingAndHistory() {
    const pList = document.getElementById('pending-list');
    if(pList) {
        pList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
            <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100 mb-4">
                <div class="bg-white px-3 py-2 rounded-xl flex items-center gap-2 mb-3">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag('queue', ${idx}, this.value)" placeholder="Tag..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <div class="flex flex-wrap gap-2 mb-4">${ord.items.map(i => `<div class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-blue-200">${i.name} x${i.qty}</div>`).join('')}</div>
                <div class="flex gap-2">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
                    <button onclick="removeItemFromList('queue', ${idx})" class="px-5 bg-white border border-red-100 text-red-400 rounded-2xl"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>`).join('');
    }
    const hList = document.getElementById('history-list');
    if(hList) {
        hList.innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3"><span class="text-slate-400 font-black text-[10px]">#${h.orderNum}</span><p class="font-bold text-slate-700 text-sm">${h.desc || 'Order'}</p></div>
                    <p class="font-black text-blue-600 text-sm">$${h.total.toFixed(2)}</p>
                </div>
            </div>`).join('');
    }
}

// System helpers
window.setCategory = (cat) => { currentCat = cat; render(); };
window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = (f==='price'?parseFloat(v):v); pushData(); } };
window.moveItem = (idx, step) => { const n = idx + step; if(n < 0 || n >= products.length) return; [products[idx], products[n]] = [products[n], products[idx]]; pushData(); };
window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? "px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600" : "px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400";
};
window.toggleCategoryManager = () => document.getElementById('category-manager-card').classList.toggle('manager-expanded');
window.openSummary = (ord) => { document.getElementById('sum-id').innerText = `#${ord.orderNum}`; document.getElementById('sum-total').innerText = `$${ord.total.toFixed(2)}`; document.getElementById('sum-details').innerHTML = ord.items.map(i => `<div class="flex justify-between text-[10px] font-bold"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join(''); document.getElementById('summary-overlay').classList.add('active'); };
window.closeSummary = () => document.getElementById('summary-overlay').classList.remove('active');
window.toggleSearch = () => { const s = document.getElementById('search-container'); s.classList.toggle('hidden'); if(!s.classList.contains('hidden')) document.getElementById('cashier-search').focus(); };
window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');

initTapMS();
