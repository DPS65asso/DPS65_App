
import { initDB } from './db';
import { Bag, BagConsumption, BagItem, BagType } from '../types';
import { generateUUID } from '../utils/security';
import { BAG_TEMPLATES } from '../data/bagInventory';
import { syncService } from './syncService';
import { supabase, isLive } from './supabaseClient';

export const bagService = {
    getBags: async (): Promise<Bag[]> => {
        const db = await initDB();
        let bags = await db.getAll('bags');

        // Récupération automatique depuis Supabase si le cache local est vide
        if (bags.length === 0 && isLive && navigator.onLine) {
            try {
                const { data, error } = await supabase.from('bags').select('*');
                if (!error && data && data.length > 0) {
                    const tx = db.transaction('bags', 'readwrite');
                    for (const b of data) {
                        await tx.store.put(b);
                    }
                    await tx.done;
                    bags = await db.getAll('bags');
                }
            } catch (e) {
                console.warn("[bagService] Auto-pull bags failed:", e);
            }
        }

        // Si aucun sac n'existe (mode preview ou premier démarrage), initialisation des sacs opérationnels par défaut
        if (bags.length === 0) {
            const defaultBags: { name: string; type: BagType; description: string }[] = [
                { name: 'Lot A (PMA)', type: 'LOT_A', description: 'Sac complet premiers secours & PMA' },
                { name: 'Lot B - Alpha', type: 'LOT_B', description: 'Sac intervention binôme secouriste' },
                { name: 'Lot B - Bravo', type: 'LOT_B', description: 'Sac intervention binôme secouriste' },
                { name: 'Sac IDE (Médical)', type: 'SAC_IDE', description: 'Dotation médicale pour infirmier / médecin' }
            ];

            for (const b of defaultBags) {
                await bagService.createBag(b.name, b.type, b.description);
            }
            bags = await db.getAll('bags');
        }

        return bags;
    },

    createBag: async (name: string, type: BagType, description: string = ''): Promise<Bag> => {
        const id = generateUUID(); 
        const newBag: Bag = {
            id,
            name,
            description,
            type,
            assignedTeam: 'DEPOT',
            lastCheckedDate: Date.now()
        };

        const db = await initDB();
        const tx = db.transaction(['bags', 'bag_items', 'sync_queue'], 'readwrite');
        
        // 1. Sauvegarder Sac
        await tx.objectStore('bags').put(newBag);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'bags',
            action: 'UPSERT',
            data: newBag,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        
        // 2. Initialiser Items
        const template = BAG_TEMPLATES[type] || [];
        const items: BagItem[] = template.map(t => ({
            id: generateUUID(),
            bagId: id,
            name: t.name,
            quantity: t.quantity,
            targetQuantity: t.quantity,
            expiryDate: '' 
        }));

        for(const item of items) {
            await tx.objectStore('bag_items').put(item);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bag_items',
                action: 'UPSERT',
                data: item,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
        }

        await tx.done;
        syncService.processQueue();
        return newBag;
    },

    updateBag: async (bagId: string, updates: Partial<Bag>): Promise<void> => {
        const db = await initDB();
        const bag = await db.get('bags', bagId);
        if (bag) {
            const updatedBag = { ...bag, ...updates };
            const tx = db.transaction(['bags', 'sync_queue'], 'readwrite');
            await tx.objectStore('bags').put(updatedBag);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bags',
                action: 'UPSERT',
                data: updatedBag,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            await tx.done;
            syncService.processQueue();
        }
    },

    deleteBag: async (bagId: string): Promise<void> => {
        const db = await initDB();
        
        // Suppression Items
        const itemsKeys = await db.getAllKeysFromIndex('bag_items', 'by-bag', bagId);
        const tx = db.transaction(['bags', 'bag_items', 'sync_queue'], 'readwrite');
        
        for (const key of itemsKeys) {
            await tx.objectStore('bag_items').delete(key);
            // Sync Delete Item
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bag_items',
                action: 'DELETE',
                data: { id: key },
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
        }
        
        // Suppression Sac
        await tx.objectStore('bags').delete(bagId);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'bags',
            action: 'DELETE',
            data: { id: bagId },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        syncService.processQueue();
    },

    assignBag: async (bagId: string, team: string): Promise<void> => {
        const db = await initDB();
        const bag = await db.get('bags', bagId);
        if (bag) {
            bag.assignedTeam = team;
            
            const tx = db.transaction(['bags', 'sync_queue'], 'readwrite');
            await tx.objectStore('bags').put(bag);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bags',
                action: 'UPSERT',
                data: bag,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            await tx.done;
            syncService.processQueue();
        }
    },

    getBagItems: async (bagId: string): Promise<BagItem[]> => {
        const db = await initDB();
        let items = await db.getAllFromIndex('bag_items', 'by-bag', bagId);
        if (items.length === 0 && isLive && navigator.onLine) {
            try {
                const { data, error } = await supabase.from('bag_items').select('*').eq('bagId', bagId);
                if (!error && data && data.length > 0) {
                    const tx = db.transaction('bag_items', 'readwrite');
                    for (const item of data) {
                        await tx.store.put(item);
                    }
                    await tx.done;
                    items = await db.getAllFromIndex('bag_items', 'by-bag', bagId);
                }
            } catch (e) {
                console.warn("[bagService] Auto-pull bag_items failed:", e);
            }
        }
        return items;
    },

    addBagItem: async (bagId: string, itemData: {name: string, quantity: number, targetQuantity: number}): Promise<BagItem> => {
        const newItem: BagItem = {
            id: generateUUID(),
            bagId,
            name: itemData.name,
            quantity: itemData.quantity,
            targetQuantity: itemData.targetQuantity,
            expiryDate: ''
        };

        const db = await initDB();
        const tx = db.transaction(['bag_items', 'sync_queue'], 'readwrite');
        await tx.objectStore('bag_items').put(newItem);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'bag_items',
            action: 'UPSERT',
            data: newItem,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
        
        return newItem;
    },

    updateBagItem: async (itemId: string, updates: Partial<BagItem>): Promise<void> => {
        const db = await initDB();
        const item = await db.get('bag_items', itemId);
        if (item) {
            const updatedItem = { ...item, ...updates };
            const tx = db.transaction(['bag_items', 'sync_queue'], 'readwrite');
            await tx.objectStore('bag_items').put(updatedItem);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bag_items',
                action: 'UPSERT',
                data: updatedItem,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            await tx.done;
            syncService.processQueue();
        }
    },

    deleteBagItem: async (itemId: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['bag_items', 'sync_queue'], 'readwrite');
        await tx.objectStore('bag_items').delete(itemId);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'bag_items',
            action: 'DELETE',
            data: { id: itemId },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
    },

    logConsumption: async (bagId: string, itemName: string, quantity: number, user: string, eventId?: string): Promise<void> => {
        const db = await initDB();
        const consumption: BagConsumption = {
            id: generateUUID(),
            bagId,
            itemName,
            quantity,
            timestamp: Date.now(),
            user,
            eventId
        };

        const tx = db.transaction(['bag_consumptions', 'bag_items', 'sync_queue'], 'readwrite');
        
        // 1. Log Consommation
        await tx.objectStore('bag_consumptions').put(consumption);
        // Sync consumption (optionnel, mais bien pour audit)
        
        // 2. Mise à jour Stock
        const itemCursor = await tx.objectStore('bag_items').index('by-bag').openCursor(IDBKeyRange.only(bagId));
        let targetItem: BagItem | null = null;
        
        // Parcours manuel car on est dans une transaction
        let cursor = itemCursor;
        while (cursor) {
            if (cursor.value.name === itemName) {
                targetItem = cursor.value;
                break;
            }
            cursor = await cursor.continue();
        }

        if (targetItem) {
            targetItem.quantity = Math.max(0, targetItem.quantity - quantity);
            await tx.objectStore('bag_items').put(targetItem);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bag_items',
                action: 'UPSERT',
                data: targetItem,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
        }
        await tx.done;
        syncService.processQueue();
    },

    getRestockList: async (bagId: string): Promise<{name: string, missing: number}[]> => {
        const items = await bagService.getBagItems(bagId);
        return items
            .filter(i => i.quantity < i.targetQuantity)
            .map(i => ({
                name: i.name,
                missing: i.targetQuantity - i.quantity
            }));
    },

    updateExpiryDate: async (itemId: string, date: string, batch?: string): Promise<void> => {
        const db = await initDB();
        const item = await db.get('bag_items', itemId);
        if (item) {
            item.expiryDate = date;
            if (batch) item.batchNumber = batch;
            const tx = db.transaction(['bag_items', 'sync_queue'], 'readwrite');
            await tx.objectStore('bag_items').put(item);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'bag_items',
                action: 'UPSERT',
                data: item,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            await tx.done;
            syncService.processQueue();
        }
    },

    checkExpiringItems: async (): Promise<{bagName: string, items: BagItem[]}[]> => {
        const db = await initDB();
        const allItems = await db.getAll('bag_items');
        const bags = await db.getAll('bags');
        
        const now = new Date();
        const warningDate = new Date();
        warningDate.setDate(now.getDate() + 15); 

        const expiring: {bagName: string, items: BagItem[]}[] = [];

        for (const bag of bags) {
            const bagItems = allItems.filter(i => i.bagId === bag.id && i.expiryDate);
            const alerts = bagItems.filter(i => {
                if (!i.expiryDate) return false;
                const exp = new Date(i.expiryDate);
                return exp <= warningDate;
            });

            if (alerts.length > 0) {
                expiring.push({ bagName: bag.name, items: alerts });
            }
        }
        return expiring;
    }
};
