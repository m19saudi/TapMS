let YOUR_UID = "";
let db, auth, resetTimer;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let html5QrCode, searchTerm = "";

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
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

window.startResetTimer = () => {
    resetTimer = setTimeout(() => {
        if(confirm("⚠️ MASTER RESET? Clears all data and starts Order #1.")) {
            db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }).then(() => window.location.reload());
        }
    }, 2000);
};
window.stopResetTimer = () => clearTimeout(resetTimer);

function render() {
    // Badge logic
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);

    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm)).sort((a,b) => b.fav - a.fav);

    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-3 overflow-hidden rounded-[1.8rem] bg-slate-50 relative border border-slate-50">
                <img src="${p.img || 'https://placehold.co/400x400/f8fafc/cbd5e1?text=?'}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-4 h-4 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[13px] leading-tight truncate px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending Review</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
            <div class="flex justify-between items-center mb-4">
                <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex-1 flex items-center gap-2">
                    <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag(${idx}, this.value)" class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <p class="font-black text-xl text-blue-600 ml-4">$${ord.total.toFixed(2)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve</button>
                <button onclick="editOrder(${idx}, 'queue')" class="px-5 bg-white border border-blue-200 text-blue-600 rounded-2xl"><i data-lucide="edit-3" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">Approved History</h2>` + history.map((h, idx) => `
        <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
            <div class="flex justify-between items-center" onclick="toggleDetails(${idx})">
                <div class="flex items-center gap-3">
                    <span class="bg-slate-100 text-slate-400 font-black text-[10px] px-2 py-1 rounded-lg">#${h.orderNum}</span>
                    <div><p class="text-[10px] font-black text-blue-500 uppercase">${h.desc || 'Walk-in'}</p><p class="font-bold text-slate-400 text-[10px]">${h.date}</p></div>
                </div>
                <div class="flex items-center gap-4">
                    <button onclick="event.stopPropagation(); reorderFast(${idx})" class="p-2 bg-blue-50 text-blue-600 rounded-xl"><i data-lucide="rotate-ccw" class="w-4 h-4"></i></button>
                    <p class="font-black text-lg text-slate-700">$${h.total.toFixed(2)}</p>
                </div>
            </div>
            <div id="details-${idx}" class="hidden mt-4 pt-4 border-t border-slate-50 space-y-2">
                ${h.items.map(i => `<div class="flex justify-between text-xs font-bold text-slate-500"><span>${i.name} x${i.qty}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('')}
                <div class="flex gap-2 pt-3">
                    <button onclick="editOrder(${idx}, 'history')" class="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase text-[10px]">Edit</button>
                    <button onclick="history.splice(${idx},1); pushData();" class="text-red-400 px-4"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div id="inv-${p.id}" class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 transition-all">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || 'https://placehold.co/100x100/f1f5f9/94a3b8?text=?'}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" placeholder="URL" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] p-1 text-center font-bold">
            </div>
            <div class="flex-1 space-y-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-slate-50 p-2 rounded-xl outline-none">
                <div class="flex items-center gap-2">
                    <div class="bg-slate-100 px-2 py-1 rounded-xl flex items-center gap-1 w-20">
                        <span class="text-blue-600 font-black text-xs">$</span>
                        <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="bg-transparent w-full font-black text-xs outline-none">
                    </div>
                    <button onclick="openScanner(${p.id})" class="p-2 bg-slate-50 rounded-xl ${p.sku ? 'text-blue-600' : 'text-slate-400'}"><i data-lucide="scan" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="flex flex-col gap-3">
                <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'} transition-all"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
                <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400 p-1"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>
        </div>
    `).join('');

    updateSidebarUI();
    lucide.createIcons();
}

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.add('tap-feedback'); setTimeout(() => el.classList.remove('tap-feedback'), 150); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    updateSidebarUI();
};

function updateSidebarUI() {
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.toggle('hidden', totalQty === 0); }
    lucide.createIcons();
}

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    queue.unshift({ orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    cart = []; updateSidebarUI(); pushData();
};

window.approveOrder = idx => {
    const ord = queue[idx];
    history.unshift({ ...ord, date: new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) });
    queue.splice(idx, 1); pushData();
};

window.reorderFast = idx => {
    orderCounter++;
    const h = history[idx];
    queue.unshift({ ...h, orderNum: orderCounter, date: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
    pushData(); showView('manage');
};

window.toggleSearch = () => {
    const container = document.getElementById('search-container');
    container.classList.toggle('hidden');
    if(!container.classList.contains('hidden')) document.getElementById('cashier-search').focus();
};

window.filterProducts = val => { searchTerm = val.toLowerCase(); render(); };

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
};

window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    lucide.createIcons();
};

window.updateTag = (idx, v) => { queue[idx].desc = v; pushData(); };
window.editItem = (id, f, v) => { 
    const p = products.find(x => x.id === id);
    if(p) { p[f] = (f==='price' ? parseFloat(v) || 0 : v); pushData(); }
};
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, sku: '' }); pushData(); };

window.removeItem = id => { 
    const el = document.getElementById(`inv-${id}`);
    if(el) { el.classList.add('deleting'); setTimeout(() => { products = products.filter(x => x.id !== id); pushData(); }, 350); }
};

window.toggleFav = id => { const p = products.find(x => x.id === id); p.fav = !p.fav; pushData(); };
window.toggleDetails = idx => document.getElementById(`details-${idx}`).classList.toggle('hidden');

// HIGH PERFORMANCE SCANNER CONFIG
window.openScanner = id => {
    document.getElementById('scan-modal').classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    
    const config = {
        fps: 30, // Max fluid speed
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0, // Force square center-crop for non-distorted feed
        videoConstraints: {
            facingMode: "environment",
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            focusMode: "continuous",
            advanced: [{ brightness: 100 }, { contrast: 100 }] // Force high visibility
        }
    };

    html5QrCode.start({ facingMode: "environment" }, config, text => {
        if(id) { 
            const p = products.find(x => x.id === id);
            p.sku = text; pushData();
        } else {
            const p = products.find(x => x.sku === text);
            if(p) handleProductTap(p.id);
        }
        closeScanner();
    }).catch(() => closeScanner());
};

window.closeScanner = () => {
    if(html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => document.getElementById('scan-modal').classList.add('hidden'));
    } else document.getElementById('scan-modal').classList.add('hidden');
};

window.editOrder = (idx, type) => {
    const source = type === 'queue' ? queue : history;
    cart = [...source[idx].items]; source.splice(idx, 1);
    pushData(); showView('cashier'); 
};

initTapMS();
