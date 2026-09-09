// IndexedDB setup and utility functions for Meridian Intelligence

const DB_NAME = 'MeridianIntelligence';
const DB_VERSION = 1;

let db = null;

// Initialize IndexedDB
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // Create object stores if they don't exist
            const stores = ['leads', 'caseStudies', 'faqs', 'demoSchedules'];

            stores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            });
        };
    });
}

// Save data to database
async function saveToDatabase(storeName, key, data) {
    if (!db) {
        await initDatabase();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(data, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Load data from database
async function loadFromDatabase(storeName, key) {
    if (!db) {
        await initDatabase();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Get all data from a store
async function getAllFromDatabase(storeName) {
    if (!db) {
        await initDatabase();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Delete data from database
async function deleteFromDatabase(storeName, key) {
    if (!db) {
        await initDatabase();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Clear all data from a store
async function clearStore(storeName) {
    if (!db) {
        await initDatabase();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Initialize database on script load
initDatabase().catch(err => console.error('Database initialization error:', err));
