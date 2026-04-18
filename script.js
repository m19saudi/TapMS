let YOUR_UID = "";
let db, auth;
let products = [], queue = [], history = [], orderCounter = 0, cart = [];

async function initTapMS() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        YOUR_UID = config.adminUid;

        firebase.initializeApp(config);
        db = firebase.database();
        auth = firebase.auth();
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        // AUTO-LOGIN BYPASS
        auth.onAuthStateChanged((user) => {
            const dot = document.getElementById('status-dot');
            if (user && user.uid === YOUR_UID) {
                dot.className = "w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]";
                startSync();
            } else {
                dot.className = "w-3 h-3 bg-red-500 rounded-full";
                // Auto-attempt login with your specified credentials
                auth.signInWithEmailAndPassword("admin@gmail.com", "123456")
                    .catch(e => console.error("Auto-sync failed:", e.message));
            }
        });
    } catch (e) { console.error("Initialization error"); }
}

initTapMS();

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

// --- RESTORED ACTIONS ---
window.showView = (v) => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    
    // UI Tab toggle logic
    const isManage = v === 'manage';
    document.getElementById('btn-cashier').className = !isManage ? 'flex flex-col items-center gap-1 p-3 active-tab' : 'flex flex-col items-center gap-1 p-3 text-slate-400';
    document.getElementById('btn-manage').className = isManage ? 'flex flex-col items-center gap-1 p-3 active-tab' : 'flex flex-col items-center gap-1 p-3 text-slate-400';
};

window.toggleManageSection = (s) => {
    const isStock = s === 'stock';
    document.getElementById('sec-orders').classList.toggle('hidden', isStock);
    document.getElementById('sec-stock').classList.toggle('hidden', !isStock);
    
    // Toggle Button Styles
    document.getElementById('sub-btn-orders').className = !isStock ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
    document.getElementById('sub-btn-stock').className = isStock ? 'px-6 py-2 rounded-xl text-xs font-black uppercase bg-white shadow-sm text-blue-600' : 'px-6 py-2 rounded-xl text-xs font-black uppercase text-slate-400';
};

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty:1});
    render();
};

window.checkoutToQueue = () => {
    if(!cart.length) return;
    orderCounter++;
    queue.unshift({ orderNum: orderCounter, items: [...cart], total: cart.reduce((s,i)=>s+(i.price*i.qty),0), desc: "", date: new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) });
    cart = []; pushData();
};

window.approveOrder = (idx) => {
    history.unshift({...queue[idx]});
    queue.splice(idx, 1); pushData();
};

window.updateTag = (idx, val) => { queue[idx].desc = val; pushData(); };

window.addItem = () => {
    products.push({ id: Date.now(), name: 'New Item', price: 0.00, img: '', fav: false });
    pushData();
};

window.removeItem = (id) => { products = products.filter(x => x.id !== id); pushData(); };

function render() {
    // Cashier Grid
    document.getElementById('view-cashier').innerHTML = products.map(p => `
        <div onclick="addToCart(${p.id})" class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm product-card cursor-pointer">
            <div class="aspect-square rounded-2xl bg-slate-100 mb-3 overflow-hidden">
                <img src="${p.img || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover">
            </div>
            <h3 class="font-bold text-xs text-center truncate px-2">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-[10px] mt-1">$${p.price.toFixed(2)}</p>
        </div>
    `).join('');

    // Sidebar
    document.getElementById('side-total').innerText = `$${cart.reduce((s,i)=>s+(i.price*i.qty),0).toFixed(2)}`;
    document.getElementById('sidebar-items').innerHTML = cart.map((i, idx) => `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div class="font-bold text-xs">${i.name} <span class="text-blue-600 ml-1">x${i.qty}</span></div>
            <button onclick="cart.splice(${idx},1); render();" class="text-slate-300"><i data-lucide="x-circle" class="w-4 h-4"></i></button>
        </div>
    `).join('') || '<div class="text-center py-20 opacity-20 italic text-sm">Cart Empty</div>';

    // Orders Queue
    document.getElementById('pending-list').innerHTML = queue.map((ord, idx) => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3">
                <span class="bg-slate-100 text-slate-900 font-black text-[10px] px-2 py-1 rounded-lg">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc}" onchange="updateTag(${idx}, this.value)" placeholder="Order Tag..." class="font-bold text-sm outline-none bg-transparent w-32">
            </div>
            <div class="flex items-center gap-4">
                <span class="font-black text-sm">$${ord.total.toFixed(2)}</span>
                <button onclick="approveOrder(${idx})" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
            </div>
        </div>
    `).join('') || '<div class="text-center py-10 opacity-30 text-xs font-bold">No pending reviews</div>';

    // Inventory List (Product Master)
    document.getElementById('inventory-list').innerHTML = products.map(p => `
        <div class="bg-white p-4 rounded-3xl border border-slate-50 flex items-center gap-4">
            <div class="w-12 h-12 bg-slate-100 rounded-2xl flex-shrink-0"></div>
            <input type="text" value="${p.name}" class="flex-1 font-bold text-sm bg-transparent outline-none">
            <div class="bg-slate-50 px-3 py-2 rounded-xl flex items-center gap-1">
                <span class="text-blue-600 font-black text-xs">$</span>
                <input type="number" value="${p.price}" class="w-12 bg-transparent font-black text-xs outline-none">
            </div>
            <button class="text-slate-300"><i data-lucide="maximize" class="w-4 h-4"></i></button>
            <button class="text-orange-400"><i data-lucide="star" class="w-4 h-4"></i></button>
            <button onclick="removeItem(${p.id})" class="text-red-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
    `).join('');

    lucide.createIcons();
}
