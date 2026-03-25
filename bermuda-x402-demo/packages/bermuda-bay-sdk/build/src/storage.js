import createRequire from 'create-require';
export const inMemoryStorage = {
    items: {},
    setItem(key, value) {
        this.items[key] = value;
    },
    getItem(key) {
        return this.items[key];
    },
    removeItem(key) {
        delete this.items[key];
    }
};
export function fileSystemStorage(filePath) {
    // Ponyfill require to have sync import of node:fs and not in global scope!
    const require = createRequire(import.meta.url);
    const { existsSync, readFileSync, writeFileSync } = require('node:fs');
    return {
        setItem(key, value) {
            let data;
            if (!existsSync(filePath))
                data = {};
            else
                data = JSON.parse(readFileSync(filePath, { encoding: 'utf8' }));
            data[key] = value;
            writeFileSync(filePath, JSON.stringify(data));
        },
        getItem(key) {
            if (!existsSync(filePath))
                return undefined;
            return JSON.parse(readFileSync(filePath, { encoding: 'utf8' }))?.[key];
        },
        removeItem(key) {
            if (!existsSync(filePath))
                return;
            const data = JSON.parse(readFileSync(filePath, { encoding: 'utf8' }));
            delete data[key];
            writeFileSync(filePath, JSON.stringify(data));
        }
    };
}
export default function init(config, provider) {
    // Default to the in-memory storage provider.
    // If a custom provider is set, use it. Otherwise try to use localStorage.
    let storage = inMemoryStorage;
    if (provider) {
        storage = provider;
    }
    else if (globalThis.localStorage) {
        storage = globalThis.localStorage;
    }
    return {
        /**
         * Stores a value in local storage based on its key.
         *
         * @param namespace Namespace for stored data
         * @param key Key used to lookup the value to be stored
         * @param value Value to be stored
         * @param prefix Prefix that should be used to avoid name collisions
         * @param serializer Function to serialize the value
         * @returns Boolean which indicates if storing the key / value pair succeeded
         */
        set({ namespace, key, value, prefix = config.storagePrefix, serializer = JSON.stringify }) {
            const itemKey = `${prefix}:${namespace}:${key}`;
            try {
                const serialized = serializer(value);
                storage.setItem(itemKey, serialized);
            }
            catch (e) {
                console.error(`Error storing ${key} in local storage`, e);
                return false;
            }
            return true;
        },
        /**
         * Retrieves a value from local storage based on its key.
         *
         * @param namespace Namespace for stored data
         * @param key Key used to lookup the value
         * @param prefix Prefix that should be used to avoid name collisions
         * @param deserializer Function to deserialize the stored value
         * @returns The value (if it was found) or null.
         */
        get({ namespace, key, prefix = config.storagePrefix, deserializer = JSON.parse }) {
            const itemKey = `${prefix}:${namespace}:${key}`;
            const result = storage.getItem(itemKey);
            if (!result) {
                return null;
            }
            return deserializer(result);
        },
        /**
         * Removes a value from local storage based on its key.
         *
         * @param namespace Namespace for stored data
         * @param key Key used to lookup the value
         * @param prefix Prefix that should be used to avoid name collisions
         * @returns Boolean which indicates if the removal was successful.
         */
        del({ namespace, key, prefix = config.storagePrefix }) {
            const itemKey = `${prefix}:${namespace}:${key}`;
            const item = storage.getItem(itemKey);
            const wasStored = !!item;
            storage.removeItem(itemKey);
            return wasStored;
        }
    };
}
//# sourceMappingURL=storage.js.map