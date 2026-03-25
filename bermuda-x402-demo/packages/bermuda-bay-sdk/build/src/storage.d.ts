import { IConfig, IStorageProvider, IStorageGetInputs, IStorageSetInputs, IStorageDelInputs } from './types.js';
export declare const inMemoryStorage: {
    items: {};
    setItem(key: string, value: string): void;
    getItem(key: string): any;
    removeItem(key: string): void;
};
export declare function fileSystemStorage(filePath: string): {
    setItem(key: string, value: string): void;
    getItem(key: string): any;
    removeItem(key: string): void;
};
export default function init(config: IConfig, provider?: IStorageProvider): {
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
    set<T>({ namespace, key, value, prefix, serializer }: IStorageSetInputs<T>): boolean;
    /**
     * Retrieves a value from local storage based on its key.
     *
     * @param namespace Namespace for stored data
     * @param key Key used to lookup the value
     * @param prefix Prefix that should be used to avoid name collisions
     * @param deserializer Function to deserialize the stored value
     * @returns The value (if it was found) or null.
     */
    get<T>({ namespace, key, prefix, deserializer }: IStorageGetInputs<T>): null | T;
    /**
     * Removes a value from local storage based on its key.
     *
     * @param namespace Namespace for stored data
     * @param key Key used to lookup the value
     * @param prefix Prefix that should be used to avoid name collisions
     * @returns Boolean which indicates if the removal was successful.
     */
    del<T>({ namespace, key, prefix }: IStorageDelInputs<T>): boolean;
};
