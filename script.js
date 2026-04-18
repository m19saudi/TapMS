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
                dot.className = "w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]";
                startSync();
            } else {
                dot.className = "w-3 h-3 bg-red-500 rounded-full";
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456")
                    .catch(e => console.error("Cloud connection error:", e.message));
            }
        });
    } catch (e) { console.error("Cloud Config Fetch Failed"); }
}

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

function pushData() { 
    db.ref('/').set({ products, queue, history, orderCounter }); 
}

function render() {
    const nb = document.getElementById('notif-badge');
    const navb = document.getElementById('nav-badge');
    if (queue.length > 0) {
        nb.innerText = queue.length; nb.classList.remove('hidden'); navb.classList.remove('hidden');
    } else {
        nb.classList.add('hidden'); navb.classList.add('hidden');
    }

    document.getElementById('view-cashier').innerHTML = products.sort((a,b) => b.fav - a.fav).map(p => `
        <div class="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer" onclick="addToCart(${p.id})">
            <div class="aspect-square mb-4 relative overflow-hidden rounded-[1.8rem] bg-slate-50">
                <img src="${p.img}" class="product-image">
                ${p.fav ? '<div class="absolute top-3 right-3 bg-white/90 p-1.5 rounded-full text-amber-500"><i data-lucide="star" class="w-3 h-3 fill-current"></i></div>' : ''}
            </div>
            <h3 class="font-bold text-slate-800 text-center text-sm truncate px-2">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${p.price.toFixed(2)}</p>
        </div>
    `).join('');

    document.getElementById('pending-list').innerHTML = queue.map((ord, idx) => `
        <div class="bg-blue-50/50 p-5 rounded-[2rem] border-2 border-blue-200">
            <div class="flex justify-between items-center mb-2 gap-3">
                <div class="flex items-center bg-white px-3 py-2 rounded-xl border border-blue-100 flex-1">
                    <span class="text-blue-600 font-black text-xs mr-2">#${ord.orderNum}</span>
                    <input type="text" value="${ord.desc || ''}" placeholder="Tag/Name..." onchange="updateTag(${idx}, this.value)"
                         class="bg-transparent font-bold text-blue-600 text-sm w-full outline-none">
                </div>
                <p class="font-black text-xl text-blue-600">$${ord.total.toFixed(2)}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-blue-100 space-y-2">
                ${ord.items.map(i => `<div class="flex justify-between text-xs font-bold text-slate-500"><span>${i.name} x${i.qty}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('')}
                <div class="flex gap-2 pt-3">
                    <button onclick="approveOrder(${idx})" class="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase">Approve</button>
                    <button onclick="editOrder(${idx}, 'queue')" class="px-4 bg-white border border-blue-100 text-blue-600 rounded-2xl text-[10px] font-black uppercase">Edit</button>
                </div>
            </div>
        </div>
    `).join('') || '<p class="text-center py-10 text-slate-300 font-bold italic">No pending reviews</p>';

    document.getElementById('history-list').innerHTML = history.map((h, idx) => `
        <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
            <div class="flex justify-between items-center cursor-pointer" onclick="toggleDetails(${idx})">
                <div class="flex items-center gap-3">
                    <span class="bg-slate-100 text-slate-400 font-black text-[10px] px-2 py-1 rounded-lg">#${h.orderNum}</span>
                    <div>
                        <p class="text-[10px] font-black text-blue-500 uppercase leading-tight">${h.desc || 'Walk-in'}</p>
                        <p class="font-bold text-slate-800 text-[10px]">${h.date}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="reorderFast(${idx}); event.stopPropagation();" class="bg-blue-50 text-blue-600 p-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                    </button>
                    <p class="font-black text-xl">$${h.total.toFixed(2)}</p>
                </div>
            </div>
            <div id="details-${idx}" class="hidden mt-4 pt-4 border-t border-slate-50 space-y-3">
                ${h.items.map(i => `<div class="flex justify-between text-xs font-bold text-slate-500"><span>${i.name} x${i.qty}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join('')}
                <div class="flex gap-2 pt-2">
                    <button onclick="editOrder(${idx}, 'history')" class="flex-1 bg-slate-100 text-slate-500 rounded-xl py-3 text-[10px] font-bold uppercase">Edit Record</button>
                    <button onclick="history.splice(${idx},1); pushData();" class="px-4 text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-slate-50">
                <img src="${p.img}" class="w-full h-full object-cover">
                <input type="text" value="${p.img}" onchange="editItem(${p.id}, 'img', this.value)" class="absolute inset-0 opacity-0 focus:opacity-100 bg-white/95 p-1 text-[8px] outline-none">
            </div>
            <div class="flex-1 flex gap-3">
                <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="flex-1 font-bold text-sm bg-slate-50 p-2 rounded-xl outline-none">
                <div class="flex items-center bg-slate-50 p-2 rounded-xl w-24">
                    <span class="text-blue-600 font-black text-xs mr-1">$</span>
                    <input type="number" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="bg-transparent w-full font-black text-sm outline-none">
                </div>
            </div>
            <button onclick="openScanner(${p.id})" class="bg-slate-50 p-2 rounded-xl text-slate-400"><i data-lucide="scan" class="w-4 h-4"></i></button>
            <button onclick="toggleFav(${p.id})" class="${p.fav ? 'text-amber-500' : 'text-slate-200'}"><i data-lucide="star" class="w-5 h-5 ${p.fav ? 'fill-current' : ''}"></i></button>
            <button onclick="removeItem(${p.id})" class="text-red-100 hover:text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
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
        <div class="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div class="flex items-center gap-3">
                <img src="${i.img}" class="w-10 h-10 rounded-xl object-cover">
                <div><p class="font-bold text-sm">${i.name}</p><p class="text-[10px] text-slate-400">Qty: ${i.qty}</p></div>
            </div>
            <button onclick="cart.splice(${idx},1); updateSidebarUI();" class="text-slate-300"><i data-lucide="x-circle" class="w-5 h-5"></i></button>
        </div>
    `).join('') || '<div class="text-center py-24 opacity-20 font-black italic">Cart Empty</div>';
    lucide.createIcons();
}

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    queue.unshift({ 
        orderNum: orderCounter, 
        items: [...cart], 
        total, 
        desc: "", 
        date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    });
    cart = []; updateSidebarUI(); pushData();
};

window.approveOrder = (idx) => {
    const ord = queue[idx];
    history.unshift({ ...ord, date: new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) });
    queue.splice(idx, 1);
    pushData();
};

window.reorderFast = (idx) => {
    orderCounter++;
    const h = history[idx];
    queue.unshift({ ...h, orderNum: orderCounter, date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    pushData();
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
        if(id) { products.find(x => x.id === id).sku = text; pushData(); }
        else { const p = products.find(x => x.sku === text); if(p) addToCart(p.id); }
        closeScanner();
    }).catch(() => closeScanner());
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
window.toggleDetails = (idx) => { document.getElementById(`details-${idx}`).classList.toggle('hidden'); };
window.editItem = (id, f, v) => { 
    const p = products.find(x => x.id === id);
    p[f] = (f==='price'?parseFloat(v):v); pushData(); 
};
window.addItem = () => { 
    products.push({ id: Date.now(), name: 'New Item', price: 0, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', fav: false, sku: '' }); 
    pushData(); 
};
window.removeItem = (id) => { products = products.filter(x => x.id !== id); pushData(); };
window.toggleFav = (id) => { const p = products.find(x => x.id === id); p.fav = !p.fav; pushData(); };

initTapMS();
