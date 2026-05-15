let YOUR_UID = "YOUR_ADMIN_UID_HERE"; 
let db, auth;
let products = [], cart = [], queue = [], history = [], orderCounter = 0;
let categories = ["All"];
let searchTerm = "", currentCat = "All";
let mobileGridCols = 4; // Use this variable to change grid size

function startSync() {
    db.ref('/').on('value', snap => {
        const data = snap.val() || {};
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        categories = data.categories || ["All"];
        render();
    });
}

function pushData() { db.ref('/').set({ products, queue, history, orderCounter, categories }); }

function render() {
    // 1. Cashier Logic: Hide "خضار" from "All", and sort Newest Last
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCat = (currentCat === "All" || p.cat === currentCat);
        
        // Exclude "خضار" if current view is "All"
        if (currentCat === "All" && p.cat === "خضار") return false;
        
        return matchesSearch && matchesCat;
    });

    // Cashier: Newest Last (Oldest ID first)
    filtered.sort((a, b) => a.id - b.id);

    const cashierView = document.getElementById('view-cashier');
    if(cashierView) {
        // Changeable grid option
        cashierView.className = `px-6 grid grid-cols-${mobileGridCols} gap-2`;
        
        cashierView.innerHTML = filtered.map(p => {
            const qty = (cart.find(c => c.id === p.id) || {qty:0}).qty;
            return `
            <div id="prod-${p.id}" class="bg-white p-2 rounded-2xl border border-slate-100 relative" onclick="handleProductTap(${p.id})">
                ${qty > 0 ? `<div class="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">${qty}</div>` : ''}
                <img src="${p.img || ''}" class="aspect-square rounded-xl object-cover bg-slate-50 mb-1">
                <h3 class="font-bold text-center text-[9px] truncate px-1">${p.name}</h3>
                <p class="text-blue-600 font-black text-center text-[8px]">$${p.price}</p>
            </div>`;
        }).join('');
    }

    // 2. Stock Logic: Newest First
    const inventoryList = document.getElementById('inventory-list');
    if(inventoryList) {
        const stockItems = [...products].sort((a, b) => b.id - a.id);
        
        inventoryList.innerHTML = stockItems.map((p) => {
            const idx = products.findIndex(orig => orig.id === p.id);
            return `
            <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                <img src="${p.img}" class="w-12 h-12 rounded-xl object-cover">
                <div class="flex-1">
                    <input type="text" value="${p.name}" onchange="editItem(${p.id}, 'name', this.value)" class="font-bold text-sm w-full outline-none">
                    <input type="number" value="${p.price}" onchange="editItem(${p.id}, 'price', this.value)" class="text-blue-600 font-black text-xs outline-none">
                </div>
                <button onclick="removeItem(${p.id})" class="text-red-400"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </div>`;
        }).join('');
    }

    const catBar = document.getElementById('cat-bar');
    if(catBar) {
        catBar.innerHTML = categories.map(c => `
            <button onclick="setCategory('${c}')" class="px-4 py-2 rounded-full text-[10px] font-bold ${currentCat === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}">${c}</button>
        `).join('');
    }

    lucide.createIcons();
}

// Option to change columns: call setGrid(2) or setGrid(4)
window.setGrid = (num) => { mobileGridCols = num; render(); };

window.setCategory = (c) => { currentCat = c; render(); };
window.filterProducts = (v) => { searchTerm = v.toLowerCase(); render(); };
window.handleProductTap = (id) => { 
    const p = products.find(x => x.id === id);
    const item = cart.find(i => i.id === id);
    if(item) item.qty++; else cart.push({...p, qty: 1});
    render(); 
};

window.addItem = () => { products.push({ id: Date.now(), name: 'New Item', price: 0, img: '', cat: '' }); pushData(); };
window.editItem = (id, f, v) => { const p = products.find(x => x.id === id); if(p) { p[f] = v; pushData(); } };
window.removeItem = (id) => { products = products.filter(x => x.id !== id); pushData(); };

window.showView = (v) => {
    document.getElementById('view-cashier').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('cat-bar').classList.toggle('hidden', v !== 'cashier');
    document.getElementById('view-manage').classList.toggle('hidden', v !== 'manage');
};

window.toggleManageSection = (s) => {
    document.getElementById('sec-orders').classList.toggle('hidden', s !== 'orders');
    document.getElementById('sec-stock').classList.toggle('hidden', s !== 'stock');
};

// Initialize Firebase here...
