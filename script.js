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
            const dot = document.getElementById('status-dot');
            if (user && user.uid === YOUR_UID) {
                if(dot) dot.className = "w-3 h-3 rounded-full dot-connected";
                startSync();
            } else {
                if(dot) dot.className = "w-3 h-3 rounded-full dot-connecting animate-pulse";
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
    // Render Products (No uppercase)
    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        cashierView.innerHTML = products.filter(p => p.name.toLowerCase().includes(searchTerm) && (currentCat === "All" || (p.cat || "") === currentCat)).map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div id="prod-${p.id}" class="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm relative select-none cursor-pointer active:scale-95 transition-all" onclick="handleProductTap(event, ${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-10">${qty}</div>` : ''}
                <div class="aspect-square mb-2 overflow-hidden rounded-[1.5rem] bg-slate-50 relative pointer-events-none">
                    <img src="${p.img || ''}" class="product-image">
                </div>
                <h3 class="font-bold text-center text-[11px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[10px] mt-0.5">$${parseFloat(p.price || 0).toFixed(2)}</p>
            </div>`;
        }).join('');
    }

    // Render Inventory List (With Scale-Down Animation on Delete)
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        inventoryList.innerHTML = products.map((p, idx) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-4 shadow-sm">
                <img src="${p.img}" class="w-12 h-12 rounded-xl object-cover">
                <div class="flex-1">
                    <h4 class="font-bold text-sm">${p.name}</h4>
                    <p class="text-blue-600 font-black text-xs">$${p.price}</p>
                </div>
                <button onclick="removeItem(${p.id})" class="p-3 text-red-100 hover:text-red-500 active:scale-95 transition-all">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>`).join('');
    }

    // Update Badge (Only for checkout arrow)
    const tq = cart.reduce((s, i) => s + i.qty, 0);
    const tb = document.getElementById('cart-count-top');
    if(tb) { tb.innerText = tq; tb.classList.toggle('hidden', tq === 0); }
    
    lucide.createIcons();
}

window.handleProductTap = (e, id) => {
    const el = document.getElementById(`prod-${id}`);
    if(el) { el.classList.remove('tap-feedback'); void el.offsetWidth; el.classList.add('tap-feedback'); }
    const p = products.find(x => x.id === id);
    const entry = cart.find(i => i.id === id);
    if (entry) entry.qty++; else cart.push({...p, qty: 1});
    render();
};

window.addItem = () => { 
    products.unshift({ id: Date.now(), name: 'New Product', price: 0, img: '', fav: false, cat: '' }); 
    pushData(); 
};

window.removeItem = id => { 
    if(confirm("Delete product?")) { 
        products = products.filter(x => x.id !== id); 
        pushData(); 
    } 
};

window.toggleSummary = () => {
    summaryEnabled = !summaryEnabled;
    const dot = document.getElementById('toggle-dot');
    const label = document.getElementById('summary-toggle-ui').querySelector('span');
    dot.className = summaryEnabled ? "w-2.5 h-2.5 rounded-full bg-blue-600" : "w-2.5 h-2.5 rounded-full bg-slate-300";
    label.innerText = summaryEnabled ? "Summary: ON" : "Summary: OFF";
};

window.showView = v => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
};

window.toggleManageSection = sec => {
    document.getElementById('sec-orders').classList.toggle('hidden', sec !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', sec !== 'stock');
};

window.openBackupModal = () => document.getElementById('backup-overlay').classList.add('active');
window.closeBackupModal = () => document.getElementById('backup-overlay').classList.remove('active');

initTapMS();
