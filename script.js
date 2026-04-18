// --- TapMS ENGINE: FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let products = [], queue = [], history = [], orderCounter = 0, cart = [];

// --- CLOUD SYNC: REAL-TIME LISTENER ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        products = data.products || [];
        queue = data.queue || [];
        history = data.history || [];
        orderCounter = data.orderCounter || 0;
        render(); // This calls the function inside the HTML file
    }
});

// Push local changes to Cloud
function pushData() {
    db.ref('/').set({ products, queue, history, orderCounter });
}

// Global functions for the HTML to call
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
    cart = [];
    pushData();
};

window.approveOrder = (idx) => {
    const ord = queue[idx];
    history.unshift({ ...ord, date: new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) });
    queue.splice(idx, 1);
    pushData();
};

window.updateTag = (idx, val) => { queue[idx].desc = val; pushData(); };
window.deleteHistory = (idx) => { history.splice(idx, 1); pushData(); };
window.toggleFav = (id) => { const p = products.find(x => x.id === id); p.fav = !p.fav; pushData(); };
window.removeItem = (id) => { products = products.filter(x => x.id !== id); pushData(); };
window.editItem = (id, field, val) => { 
    products.find(x => x.id === id)[field] = (field==='price' ? parseFloat(val) : val); 
    pushData(); 
};
window.addItem = () => {
    products.push({ id: Date.now(), name: 'New Item', price: 0, img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', fav: false });
    pushData();
};
