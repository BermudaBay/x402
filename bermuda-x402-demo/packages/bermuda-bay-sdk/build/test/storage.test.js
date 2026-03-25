import 'mocha';
import { expect } from 'chai';
import initStorage, { fileSystemStorage } from '../src/storage.js';
import { Contract, JsonRpcProvider } from 'ethers';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const key = 'key-1';
const namespace = 'tests';
const value = { key: 'value' };
const storagePrefix = 'bermuda';
const fullKey = `${storagePrefix}:${namespace}:${key}`;
const config = {
    chainId: 1n,
    startBlock: 0n,
    merkleTreeHeight: 1,
    pool: new Contract('0x0', []),
    registry: new Contract('0x0', []),
    provider: new JsonRpcProvider(),
    signMsgHashLib: '',
    uniswapV2Router: '',
    zkAssetsBaseUrl: '',
    uniswapV2Adapter: '',
    storagePrefix: storagePrefix
};
function getStorageProvider() {
    const storage = {
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
    return storage;
}
describe('storage', () => {
    describe('with localStorage available', () => {
        let storage;
        beforeEach(() => {
            globalThis.localStorage = getStorageProvider();
            storage = initStorage(config);
        });
        afterEach(() => {
            globalThis.localStorage = undefined;
        });
        it('set / get / del', () => {
            const isSet = storage.set({ namespace, key, value });
            expect(isSet).to.be.true;
            expect(globalThis.localStorage.getItem(fullKey)).to.equal(JSON.stringify(value));
            const result1 = storage.get({ namespace, key });
            expect(result1).to.deep.equal(value);
            const isDeleted = storage.del({ namespace, key });
            expect(isDeleted).to.be.true;
            expect(globalThis.localStorage.getItem(fullKey)).to.equal(undefined);
            const result2 = storage.get({ namespace, key });
            expect(result2).to.equal(null);
        });
    });
    describe('with localStorage unavailable', () => {
        let storage;
        beforeEach(() => {
            globalThis.localStorage = undefined;
            storage = initStorage(config);
        });
        it('set / get / del', () => {
            const isSet = storage.set({ namespace, key, value });
            expect(isSet).to.be.true;
            const result1 = storage.get({ namespace, key });
            expect(result1).to.deep.equal(value);
            const isDeleted = storage.del({ namespace, key });
            expect(isDeleted).to.be.true;
            const result2 = storage.get({ namespace, key });
            expect(result2).to.equal(null);
        });
    });
    describe('with custom storage provider', () => {
        let storage;
        let provider;
        beforeEach(() => {
            globalThis.localStorage = undefined;
            provider = getStorageProvider();
            storage = initStorage(config, provider);
        });
        it('set / get / del', () => {
            const isSet = storage.set({ namespace, key, value });
            expect(isSet).to.be.true;
            expect(provider.getItem(fullKey)).to.equal(JSON.stringify(value));
            const result1 = storage.get({ namespace, key });
            expect(result1).to.deep.equal(value);
            const isDeleted = storage.del({ namespace, key });
            expect(isDeleted).to.be.true;
            expect(provider.getItem(fullKey)).to.equal(undefined);
            const result2 = storage.get({ namespace, key });
            expect(result2).to.equal(null);
        });
    });
    describe('with filesystem storage provider', () => {
        let storage;
        let provider;
        beforeEach(async () => {
            globalThis.localStorage = undefined;
            const dirPath = tmpdir();
            const filePath = join(dirPath, 'sdk-storage-test.json');
            await mkdir(dirPath, { recursive: true });
            await writeFile(filePath, '{}');
            provider = fileSystemStorage(filePath);
            storage = initStorage(config, provider);
        });
        it('set / get / del', () => {
            const isSet = storage.set({ namespace, key, value });
            expect(isSet).to.be.true;
            expect(provider.getItem(fullKey)).to.equal(JSON.stringify(value));
            const result1 = storage.get({ namespace, key });
            expect(result1).to.deep.equal(value);
            const isDeleted = storage.del({ namespace, key });
            expect(isDeleted).to.be.true;
            expect(provider.getItem(fullKey)).to.equal(undefined);
            const result2 = storage.get({ namespace, key });
            expect(result2).to.equal(null);
        });
    });
});
//# sourceMappingURL=storage.test.js.map