let YOUR_UID = "";
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let html5QrCode;

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        YOUR_UID = config.adminUid;
        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        auth.onAuthStateChanged((user) => {
            const dot = document.getElementById('status-dot');
            if (user && user.uid === YOUR_UID) {
                dot.className = "w-3 h-3 rounded-full dot-connected"; // Switch to Green
                startSync();
            } else {
                dot.className = "w-3 h-3 rounded-full dot-connecting animate-pulse"; // Keep Yellow
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456").catch(e => console.error(e));
            }
        });
    } catch (e) { console.error(e); }
}

// Reset Protocol: Resets order count to 0 (next order will be 1)
window.resetTapMS = () => {
    if(confirm("Wipe everything and start fresh from Order #1?")) {
        db.ref('/').set({ products, queue: [], history: [], orderCounter: 0 });
    }
};

function startSync() {
    db.ref('/').on('value', (snap) => {
        const data = snap.val() || {};
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

function render() {
    // Red Badge for Manage Tab
    const navb = document.getElementById('nav-badge');
    navb.classList.toggle('hidden', queue.length === 0);

    // Cashier Grid
    document.getElementById('view-cashier').innerHTML = products.sort((a,b) => b.fav - a.fav).map(p => `
        <div class="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm" onclick="addToCart(${p.id})">
            <div class="aspect-square mb-4 overflow-hidden rounded-[1.8rem] bg-slate-50 relative">
                <img src="${p.img || 'https://placehold.co/400x400/f8fafc/cbd5e1?text=?'}" class="product-image">
                ${p.fav ? '<div class="absolute top-2 right-2 text-amber-500"><i data-lucide="star" class="w-4 h-4 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-center text-sm truncate px-1">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs">$${parseFloat(p.price).toFixed(2)}</p>
        </div>
    `).join('');

    // Pending Queue
    document.getElementById('pending-list').innerHTML = queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2rem] border-2 border-blue-200">
            <div class="flex justify-between items-center mb-3">
                <div class="bg-white px-3 py-1.5 rounded-xl border border-blue-100 flex-1 flex items-center gap-2">
                    <span class="text-blue-600 font-black text-xs">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" onchange="updateTag(${idx}, this.value)" class="bg-transparent font-bold text-blue-600 text-sm outline-none w-full">
                </div>
                <p class="font-black text-xl text-blue-600 ml-4">$${ord.total.toFixed(2)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black uppercase text-[10px]">Approve</button>
                <button onclick="editOrder(${idx}, 'queue')" class="px-4 bg-white border border-blue-200 text-blue-600 rounded-2xl"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');

    // Approved History - CLICK TO REORDER
    document.getElementById('history-list').innerHTML = history.map((h, idx) => `
        <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm" onclick="reorderFast(${idx})">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="bg-slate-100 text-slate-400 font-black text-[10px] px-2 py-1 rounded-lg">#${h.orderNum}</span>
                    <div>
                        <p class="text-[10px] font-black text-blue-500 uppercase">${h.desc || 'Walk-in'}</p>
                        <p class="font-bold text-slate-400 text-[10px]">${h.date}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <p class="font-black text-xl">$${h.total.toFixed(2)}</p>
                    <button onclick="event.stopPropagation(); history.splice(${idx},1); pushData();" class="text-red-200 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    // Inventory - Fixed Image URL & SKU Assignment
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50 group">
                <img src="${p.img || 'https://placehold.co/100x100/f1f5f9/94a3b8?text=?'}" class="w-full h-full object-cover">
                <input type="text" value="${p.img || ''}" placeholder="URL" onchange="editItem(${p.id}, 'img', this.value)" 
                    class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 text-[8px] p-1 text-center font-bold">
            </div>
            <div class="flex-1 space-y-1">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="w-full font-bold text-sm bg-slate-50 p-2 rounded-xl outline-none">
                <div class="flex items-center gap-2">
                    <div class="bg-slate-50 px-3 py-2 rounded-xl flex items-center gap-1 w-24">
                        <span class="text-blue-600 font-black text-xs">$</span>
                        <input type="number" step="0.01" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="bg-transparent w-full font-black text-sm outline-none">
                    </div>
                    <button onclick="openScanner(${p.id})" class="p-2 bg-slate-50 rounded-xl ${p.sku ? 'text-blue-600' : 'text-slate-300'}">
                        <i data-lucide="${p.sku ? 'check-circle' : 'scan'}" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-100'}"><i data-lucide="star" class="w-5 h-5 fill-current"></i></button>
            <button onclick="removeItem(${p.id})" class="text-red-100"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
        </div>
    `).join('');

    updateSidebarUI();
    lucide.createIcons();
}

function addToCart(id) {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    updateSidebarUI();
}

function updateSidebarUI() {
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    document.getElementById('side-total').innerText = `$${total.toFixed(2)}`;
    document.getElementById('sidebar-items').innerHTML = cart.map((i, idx) => `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
            <div class="flex items-center gap-3">
                <img src="${i.img}" class="w-8 h-8 rounded-lg object-cover">
                <div><p class="font-bold text-xs">${i.name}</p><p class="text-[9px] text-blue-600 font-black">x${i.qty}</p></div>
            </div>
            <button onclick="cart.splice(${idx},1); updateSidebarUI();" class="text-slate-300"><i data-lucide="x-circle" class="w-4 h-4"></i></button>
        </div>
    `).join('') || '<p class="text-center py-10 opacity-20 italic">Cart Empty</p>';
    lucide.createIcons();
}

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    queue.unshift({ orderNum: orderCounter, items: [...cart], total, desc: "", date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    cart = []; updateSidebarUI(); pushData();
};

window.approveOrder = (idx) => {
    const ord = queue[idx];
    history.unshift({ ...ord, date: new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) });
    queue.splice(idx, 1);
    pushData();
};

// DIRECT REORDER: Click history item to send it back to review with a new order number
window.reorderFast = (idx) => {
    if(!confirm("Reorder this items and send to review?")) return;
    orderCounter++;
    const h = history[idx];
    queue.unshift({ ...h, orderNum: orderCounter, date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    pushData();
    showView('manage');
};

window.editOrder = (idx, type) => {
    const source = type === 'queue' ? queue : history;
    cart = [...source[idx].items]; source.splice(idx, 1);
    pushData(); showView('cashier'); 
};

window.openScanner = (id) => {
    document.getElementById('scan-modal').classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (text) => {
        if(id) { 
            const p = products.find(x => x.id === id);
            p.sku = text; 
            pushData(); 
            alert("SKU assigned to " + p.name);
        } else {
            const p = products.find(x => x.sku === text);
            if(p) { addToCart(p.id); alert("Added: " + p.name); }
            else { alert("Unknown SKU: " + text); }
        }
        closeScanner();
    }).catch(e => closeScanner());
};

window.closeScanner = () => { 
    if(html5QrCode) html5QrCode.stop().then(() => document.getElementById('scan-modal').classList.add('hidden')); 
    else document.getElementById('scan-modal').classList.add('hidden'); 
};

window.showView = (v) => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-1 p-3 active-tab':'flex flex-col items-center gap-1 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-1 p-3 active-tab':'flex flex-col items-center gap-1 p-3 text-slate-400';
};

window.toggleManageSection = (sec) => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
    document.getElementById('sub-btn-orders').className = (sec === 'orders') ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    document.getElementById('sub-btn-stock').className = (sec === 'stock') ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    lucide.createIcons();
};

window.updateTag = (idx, v) => { queue[idx].desc = v; pushData(); };
window.editItem = (id, f, v) => { 
    const p = products.find(x => x.id === id);
    p[f] = (f==='price'?parseFloat(v):v); pushData(); 
};
window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', fav: false, sku: '' }); pushData(); };
window.removeItem = (id) => { if(confirm("Delete item?")) { products = products.filter(x => x.id !== id); pushData(); } };
window.toggleFav = (id) => { const p = products.find(x => x.id === id); p.fav = !p.fav; pushData(); };

initTapMS();
