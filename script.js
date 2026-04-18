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

        auth.onAuthStateChanged((user) => {
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');
            if (user && user.uid === YOUR_UID) {
                dot.className = "w-2 h-2 bg-emerald-500 rounded-full animate-pulse";
                text.innerText = "Synced";
                startSync();
            } else {
                dot.className = "w-2 h-2 bg-red-400 rounded-full";
                text.innerText = "Disconnected";
            }
        });
    } catch (e) { console.error("Sync Initialization Failed"); }
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

window.manualLoginTrigger = () => {
    if (auth.currentUser) {
        if(confirm("Logout?")) auth.signOut().then(() => location.reload());
    } else {
        const email = prompt("Admin Email:");
        const pass = prompt("Password:");
        if (email && pass) auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    }
};

// --- CORE UTILITIES ---
function pushData() { db.ref('/').set({ products, queue, history, orderCounter }); }

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty:1});
    render();
};

window.checkoutToQueue = () => {
    if(!cart.length || !auth.currentUser) return;
    orderCounter++;
    queue.unshift({ orderNum: orderCounter, items: [...cart], total: cart.reduce((s,i)=>s+(i.price*i.qty),0), desc: "", date: new Date().toLocaleTimeString() });
    cart = []; pushData();
};

window.approveOrder = (idx) => {
    history.unshift({...queue[idx], date: new Date().toLocaleString()});
    queue.splice(idx, 1); pushData();
};

window.updateTag = (idx, val) => { queue[idx].desc = val; pushData(); };

// --- UI HELPERS ---
window.showView = (v) => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
    document.getElementById('btn-cashier').className = (v==='cashier')?'flex flex-col items-center gap-1 p-3 active-tab':'flex flex-col items-center gap-1 p-3 text-slate-400';
    document.getElementById('btn-manage').className = (v==='manage')?'flex flex-col items-center gap-1 p-3 active-tab':'flex flex-col items-center gap-1 p-3 text-slate-400';
};

window.toggleManageSection = (s) => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
};

function render() {
    // Render Products
    document.getElementById('view-cashier').innerHTML = products.map(p => `
        <div onclick="addToCart(${p.id})" class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition-all">
            <img src="${p.img}" class="w-full aspect-square object-cover rounded-2xl mb-3">
            <h3 class="font-bold text-xs text-center truncate">${p.name}</h3>
            <p class="text-blue-600 font-black text-center text-xs mt-1">$${p.price.toFixed(2)}</p>
        </div>
    `).join('');

    // Render Sidebar
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    document.getElementById('side-total').innerText = `$${total.toFixed(2)}`;
    document.getElementById('sidebar-items').innerHTML = cart.map((i, idx) => `
        <div class="flex justify-between items-center bg-slate-100/50 p-4 rounded-2xl">
            <div class="font-bold text-sm">${i.name} <span class="text-slate-400 ml-2">x${i.qty}</span></div>
            <button onclick="cart.splice(${idx},1); render();" class="text-slate-300"><i data-lucide="x-circle" class="w-5 h-5"></i></button>
        </div>
    `).join('') || '<div class="text-center py-20 opacity-20 italic">Cart Empty</div>';

    // Render Queue
    document.getElementById('pending-list').innerHTML = queue.map((ord, idx) => `
        <div class="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3">
                <span class="bg-blue-100 text-blue-600 font-black text-[10px] px-2 py-1 rounded-lg">#${ord.orderNum}</span>
                <input type="text" value="${ord.desc}" onchange="updateTag(${idx}, this.value)" placeholder="Tag..." class="font-bold text-sm outline-none bg-transparent">
            </div>
            <button onclick="approveOrder(${idx})" class="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
        </div>
    `).join('');

    lucide.createIcons();
}
