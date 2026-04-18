let YOUR_UID = "";
let db, auth, resetTimer, html5QrCode;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let searchTerm = "";

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
        if(confirm("Master Reset?")) {
            db.ref('/').set({ products: [], queue: [], history: [], orderCounter: 0 }).then(() => window.location.reload());
        }
    }, 2000);
};
window.stopResetTimer = () => clearTimeout(resetTimer);

function render() {
    const navb = document.getElementById('nav-badge');
    if(navb) navb.classList.toggle('hidden', queue.length === 0);

    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm)).sort((a,b) => b.fav - a.fav);

    // Cashier View
    document.getElementById('view-cashier').innerHTML = filtered.map(p => `
        <div id="prod-${p.id}" class="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm" onclick="handleProductTap(${p.id})">
            <div class="aspect-square mb-3 overflow-hidden rounded-[1.8rem] bg-slate-50 relative">
                <img src="${p.img || ''}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-4 h-4 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-[13px] truncate px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${parseFloat(p.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    // Pending Orders (With Items)
    document.getElementById('pending-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4">Pending</h2>` + queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2.5rem] border-2 border-blue-100">
            <div class="bg-white px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-2 mb-3">
                <span class="text-blue-600 font-black text-[10px]">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc || ''}" onchange="updateTag(${idx}, this.value)" placeholder="Note..." class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
            </div>
            <div class="flex flex-wrap gap-2 mb-4">
                ${ord.items.map(i => `<span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">${i.name} x${i.qty}</span>`).join('')}
            </div>
            <div class="flex gap-2">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Approve $${ord.total.toFixed(2)}</button>
            </div>
        </div>
    `).join('');

    // Completed History (Restored)
    document.getElementById('history-list').innerHTML = `<h2 class="font-black text-lg px-2 mb-4 text-slate-400">History</h2>` + history.map((h, idx) => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center mb-2">
            <div><p class="font-black text-xs text-slate-700">#${h.orderNum} ${h.desc || ''}</p><p class="text-[10px] text-slate-400 font-bold">${h.date}</p></div>
            <p class="font-black text-blue-600">$${h.total.toFixed(2)}</p>
        </div>
    `).join('');

    // Inventory View (Restored Star and Image Link)
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img || ''}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" onchange="editItem(${p.id}, 'img', this.value)" placeholder="URL" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] text-center font-bold">
            </div>
            <div class="flex-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-transparent outline-none">
                <div class="flex items-center gap-2 mt-1">
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

    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const topBadge = document.getElementById('cart-count-top');
    if(topBadge) { topBadge.innerText = totalQty; topBadge.classList.toggle('hidden', totalQty === 0); }
    lucide.createIcons();
}

window.handleProductTap = id => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.add('tap-feedback'); setTimeout(() => el.classList.remove('tap-feedback'), 200); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    queue.unshift({ orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString() });
    cart = []; render(); pushData();
};

window.approveOrder = idx => {
    history.unshift({ ...queue[idx], date: new Date().toLocaleString() });
    queue.splice(idx, 1); pushData();
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-2 p-3 active-tab':'flex flex-col items-center gap-2 p-3 text-slate-400';
};

window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
};

window.toggleFav = id => { const p = products.find(x => x.id === id); if(p) { p.fav = !p.fav; pushData(); } };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); p[f] = (f==='price'?parseFloat(v):v); pushData(); };
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false }); pushData(); };
window.removeItem = id => { products = products.filter(x => x.id !== id); pushData(); };
window.updateTag = (idx, v) => { queue[idx].desc = v; pushData(); };

initTapMS();
