// test/mpecdh.spec.ts
import 'mocha';
import { expect } from 'chai';
import { ethers, ContractFactory } from 'ethers';
import SafeMockArtifact from './abi/SafeMock.json' with { type: 'json' };
import SafeMPECDHArtifact from './abi/SafeMPECDH.json' with { type: 'json' };
import CreateCallArtifact from './abi/CreateCall.json' with { type: 'json' };
import initSafe from '../src/safe.js';
import chain from '../src/chain.js';
import { buf, scalarMult, kdf } from 'mpecdh';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
describe.skip('MPECDH', function () {
    this.timeout(60_000);
    let snapshotId;
    let server;
    let provider;
    let signers;
    let safeMPECDH;
    let safeMock5;
    let safeMock3;
    let safeMPECDH3;
    let safeMPECDH5;
    let createCallLib;
    let G;
    let alice, bob, charlie, dave, eve, ferdie;
    let safe;
    before(async function () {
        const config = chain['testenv'];
        const mnemonic = 'test test test test test test test test test test test junk';
        const chainId = 11155111;
        const url = 'https://base-sepolia-rpc.publicnode.com';
        const sepoliaProvider = new ethers.JsonRpcProvider(url);
        // Fetch the most recent block number as Hardhat otherwise tries to pull
        // very old data which requires access to an archival node.
        const blockNumber = await sepoliaProvider.getBlockNumber();
        const hre = await createHardhatRuntimeEnvironment({
            networks: {
                hardhat: {
                    type: 'edr-simulated',
                    forking: {
                        url,
                        blockNumber,
                        enabled: true
                    },
                    chainId,
                    accounts: {
                        mnemonic,
                        count: 6,
                        accountsBalance: ethers.parseEther('100').toString()
                    },
                    loggingEnabled: false
                }
            }
        });
        server = await hre.network.createServer('hardhat', 'localhost', 8545);
        await server.listen();
        provider = new ethers.JsonRpcProvider(config.provider, {
            chainId,
            name: 'hardhat'
        });
        signers = [];
        for (let i = 0; i < 6; i++) {
            const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), `m/44'/60'/0'/0/${i}`).connect(provider);
            signers.push(wallet);
        }
        let createCallFactory = new ContractFactory(CreateCallArtifact.abi, CreateCallArtifact.bytecode, signers[0]);
        createCallLib = (await createCallFactory.deploy());
        await createCallLib.waitForDeployment();
        G = new Uint8Array(32);
        G[0] = 9;
        safe = initSafe(config);
        let mockSafeFactory5 = new ContractFactory(SafeMockArtifact.abi, SafeMockArtifact.bytecode, signers[0]);
        safeMock5 = (await mockSafeFactory5.deploy([
            signers[0].address,
            signers[1].address,
            signers[2].address,
            signers[3].address,
            signers[4].address
        ], 3));
        await safeMock5.waitForDeployment();
        let mockSafeFactory3 = new ContractFactory(SafeMockArtifact.abi, SafeMockArtifact.bytecode, signers[0]);
        safeMock3 = (await mockSafeFactory3.deploy([signers[0].address, signers[1].address, signers[2].address], 2));
        await safeMock3.waitForDeployment();
        [alice, bob, charlie, dave, eve, ferdie] = signers;
        const deployMPECDH3Tx = await safeMock3.connect(alice).deployMPECDH();
        await deployMPECDH3Tx.wait();
        const deployMPECDH5Tx = await safeMock5.connect(alice).deployMPECDH();
        await deployMPECDH5Tx.wait();
        safeMPECDH = new ethers.ContractFactory(SafeMPECDHArtifact.abi, SafeMPECDHArtifact.bytecode, alice);
        safeMPECDH3 = safeMPECDH.attach(await safeMock3.safeMPECDH());
        safeMPECDH5 = safeMPECDH.attach(await safeMock5.safeMPECDH());
        const snapshot = await provider.send('evm_snapshot', []);
        snapshotId = snapshot;
    });
    beforeEach(async function () {
        await provider.send('evm_revert', [snapshotId]);
        const snapshot = await provider.send('evm_snapshot', []);
        snapshotId = snapshot;
        safeMPECDH3 = safeMPECDH.attach(await safeMock3.safeMPECDH());
        safeMPECDH5 = safeMPECDH.attach(await safeMock5.safeMPECDH());
    });
    after(async () => {
        if (server)
            await server.close();
    });
    describe('MPECDH', async () => {
        it('should get all safe owners', async () => {
            const expected = [alice, bob, charlie].map(s => s.address);
            const signers3 = await safeMock3.getOwners();
            expect(signers3).to.deep.equal(expected);
        });
        it('should have deployed SafeMPECDH through Safe', async function () {
            const safeMPECDH3Code = await provider
                .getCode(await safeMPECDH3.getAddress())
                .then(c => c.replace('0x', ''));
            const safeMPECDH5Code = await provider
                .getCode(await safeMPECDH5.getAddress())
                .then(c => c.replace('0x', ''));
            expect(safeMPECDH3Code.length).to.be.greaterThan(0);
            expect(safeMPECDH5Code.length).to.be.greaterThan(0);
            const signers3 = await safeMPECDH3.getSigners();
            expect(signers3.length).to.equal(3);
        });
        it('should correctly report status for all signers during ceremony', async function () {
            const safeMPECDH3Address = await safeMock3.safeMPECDH();
            const code = await provider.getCode(safeMPECDH3Address);
            if (code === '0x') {
                throw new Error('SafeMPECDH3 contract not deployed properly');
            }
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of signers) {
                let status = await choreo.status(signer);
                expect(status).to.equal(3);
                const tx = await choreo.step0(signer);
                await tx.wait();
                status = await choreo.status(signer);
                // in round robin 4 alice post step0 status is idle for the others ok
                expect(status).to.equal(signer.address === alice.address ? 2 : 1);
            }
            for (let i = 0; i < signers.length - 2; i++) {
                for (const signer of signers) {
                    let status = await choreo.status(signer);
                    expect(status).to.equal(1);
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                    status = await choreo.status(signer);
                    expect(status).to.equal(0);
                }
            }
            let sharedSecrets = [];
            for (const signer of signers) {
                let status = await choreo.status(signer);
                expect(status).to.equal(0);
                sharedSecrets.push(await choreo.stepX(signer));
            }
            const expected = sharedSecrets[0];
            expect(sharedSecrets.every(s => s === expected)).to.be.true;
        });
        it('should yield a shared secret after a threesome ceremony', async function () {
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            for (let i = 0; i < signers.length - 2; i++) {
                for (const signer of signers) {
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                }
            }
            let sharedSecrets = [];
            for (const signer of signers) {
                sharedSecrets.push(await choreo.stepX(signer));
            }
            const expected = sharedSecrets[0];
            expect(sharedSecrets.every(s => s === expected)).to.be.true;
        });
        it('should report blocking round contributors during ceremony', async function () {
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            // at every fresh round start blocking() is empty
            // once the first intermediate key within a round has been posted
            // blocking() reports remaining round contributors
            let tx;
            // round 0
            let blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([]);
            tx = await choreo.step0(bob);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([alice.address, charlie.address]);
            tx = await choreo.step0(alice);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([charlie.address]);
            tx = await choreo.step0(charlie);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([]);
            // round n
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([]);
            tx = await choreo.stepN(alice);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([bob.address, charlie.address]);
            tx = await choreo.stepN(bob);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([charlie.address]);
            tx = await choreo.stepN(charlie);
            await tx.wait();
            blocking = await choreo.blocking();
            expect(blocking).to.deep.equal([]);
            let sharedSecrets = [];
            for (const signer of signers) {
                sharedSecrets.push(await choreo.stepX(signer));
            }
            const expected = sharedSecrets[0];
            expect(sharedSecrets.every(s => s === expected)).to.be.true;
        });
        it('should yield a shared secret after a fivesome ceremony', async function () {
            const signers = [alice, bob, charlie, dave, eve];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH5.getAddress());
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            for (let i = 0; i < signers.length - 2; i++) {
                for (const signer of signers) {
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                }
            }
            let sharedSecrets = [];
            for (const signer of signers) {
                sharedSecrets.push(await choreo.stepX(signer));
            }
            const expected = sharedSecrets[0];
            expect(sharedSecrets.every(s => s === expected)).to.be.true;
        });
        it('should get all queues', async function () {
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            for (let i = 0; i < signers.length - 2; i++) {
                for (const signer of signers) {
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                }
            }
            let sharedSecrets = [];
            for (const signer of signers) {
                sharedSecrets.push(await choreo.stepX(signer));
            }
            const expected = sharedSecrets[0];
            expect(sharedSecrets.every(s => s === expected)).to.be.true;
            for (let i = 0; i < signers.length; i++) {
                const q = await safeMPECDH3.getQueue(i);
                expect(q.length).eq(2);
            }
        });
        it('should emit MPCCompleted event when ceremony finishes', async function () {
            const signers = [alice, bob, charlie];
            const expectedSigners = signers.map(s => s.address);
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            // Run all the steps but the last step
            for (let i = 0; i < signers.length - 2; i++) {
                for (let j = 0; j < signers.length - 1; j++) {
                    const tx = await choreo.stepN(signers[j]);
                    await tx.wait();
                }
            }
            const lastSigner = signers[signers.length - 1];
            const [status, key] = await safeMPECDH3.prep(lastSigner.address);
            const keyBuf = buf(key);
            const lastKey = scalarMult((await kdf(lastSigner)).secretKey, keyBuf);
            const tx = await safeMPECDH3.connect(lastSigner).step(lastKey);
            const receipt = await tx.wait();
            const readyEvent = receipt.logs.find(log => {
                try {
                    const parsed = safeMPECDH3.interface.parseLog(log);
                    return parsed?.name === 'Ready';
                }
                catch {
                    return false;
                }
            });
            expect(readyEvent).to.not.be.undefined;
            const parsedEvent = safeMPECDH3.interface.parseLog(readyEvent);
            expect(parsedEvent?.args[0]).to.deep.equal(expectedSigners);
        });
        it('should emit Reconstruct event on reconstruct', async function () {
            const signers = [alice, bob, charlie];
            const expectedSigners = signers.map(s => s.address);
            const tx = await safeMock3.connect(alice).reconstructMPECDH();
            const receipt = await tx.wait();
            const reconstructEvent = receipt.logs.find(log => {
                try {
                    const parsed = safeMPECDH3.interface.parseLog(log);
                    return parsed?.name === 'Reconstruct';
                }
                catch {
                    return false;
                }
            });
            expect(reconstructEvent).to.not.be.undefined;
            const parsedEvent = safeMPECDH3.interface.parseLog(reconstructEvent);
            expect(parsedEvent?.args[0]).to.deep.equal(expectedSigners);
        });
        it('should revert when non-signer tries to call step', async function () {
            await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            const a = await kdf(alice);
            const tx = await safeMPECDH3.connect(alice).step(a.publicKey);
            await tx.wait();
            const f = await kdf(ferdie);
            let reverted = false;
            try {
                await safeMPECDH3.connect(ferdie).step.staticCall(f.publicKey);
            }
            catch {
                reverted = true;
            }
            expect(reverted).to.equal(true);
        });
        it('should revert when non-master tries to call reconstruct', async function () {
            let reverted = false;
            try {
                await safeMPECDH3.connect(alice).reconstruct.staticCall();
            }
            catch {
                reverted = true;
            }
            expect(reverted).to.equal(true);
            reverted = false;
            try {
                await safeMPECDH3.connect(bob).reconstruct.staticCall();
            }
            catch {
                reverted = true;
            }
            expect(reverted).to.equal(true);
        });
        it('should revert when prep is called with non-signer address', async function () {
            try {
                await safeMPECDH3.connect(ferdie).prep(ferdie.address);
                expect.fail('Expected transaction to revert');
            }
            catch (error) {
                expect(error.message).to.match(/missing revert data|execution reverted|revert/i);
            }
        });
        it('should return max uint256 for non-signer in source', async function () {
            const user_slot = await safeMPECDH3.source(ferdie.address);
            expect(user_slot).to.equal(ethers.MaxUint256);
        });
        it('should check all signers have sequential slots', async function () {
            const signers = await safeMPECDH3.getSigners();
            for (let i = 0; i < signers.length; i++) {
                const signerSlot = await safeMPECDH3.source(signers[i]);
                expect(Number(signerSlot)).to.equal(i);
            }
        });
        it('should return Step.Null when signer has not contributed before ', async function () {
            for (const signer of [alice, bob, charlie]) {
                const [s, k] = await safeMPECDH3.prep(signer.address);
                expect(Number(s)).to.equal(3);
            }
        });
        it('should return Step.Idle when other signers are behind', async function () {
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            const tx = await choreo.step0(alice);
            await tx.wait();
            const [aliceStatus] = await safeMPECDH3.prep(alice.address);
            expect(Number(aliceStatus)).to.equal(2);
            const [bobStatus] = await safeMPECDH3.prep(bob.address);
            expect(Number(bobStatus)).to.equal(3);
            const [charlieStatus] = await safeMPECDH3.prep(charlie.address);
            expect(Number(charlieStatus)).to.equal(3);
        });
        it('should return Step.Ok when all signers contributed', async function () {
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of [alice, bob, charlie]) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            for (const signer of [alice, bob, charlie]) {
                const [status, key] = await safeMPECDH3.prep(signer.address);
                expect(Number(status)).to.equal(1);
            }
        });
        it('should return Step.End with key when ceremony is complete', async function () {
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            for (let i = 0; i < signers.length - 2; i++) {
                for (const signer of signers) {
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                }
            }
            for (const signer of signers) {
                const [status, key] = await safeMPECDH3.prep(signer.address);
                expect(Number(status)).to.equal(0);
            }
        });
        it('should check one signers different states during cermony flow', async function () {
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            let [nullStatus] = await safeMPECDH3.prep(alice.address);
            expect(Number(nullStatus)).to.equal(3);
            let tx;
            tx = await choreo.step0(alice);
            await tx.wait();
            let [idleStatus] = await safeMPECDH3.prep(alice.address);
            expect(Number(idleStatus)).to.equal(2);
            tx = await choreo.step0(bob);
            await tx.wait();
            tx = await choreo.step0(charlie);
            await tx.wait();
            let [OkayStatus] = await safeMPECDH3.prep(alice.address);
            expect(Number(OkayStatus)).to.equal(1);
            for (let i = 0; i < 1; i++) {
                for (const signer of [alice, bob, charlie]) {
                    const tx = await choreo.stepN(signer);
                    await tx.wait();
                }
            }
            let [endStatus] = await safeMPECDH3.prep(alice.address);
            expect(Number(endStatus)).to.equal(0);
        });
        it('should successfully propose deployment v1', async () => {
            let safe_address = await safeMock3.getAddress();
            const proposeDeploymentResult = await safe.mpecdh.proposeDeploymentViaApproveHash(bob.privateKey, safe_address, provider);
            const contractData = await safeMock3.approvedHashes(bob.address, proposeDeploymentResult.safeTxHash);
            expect(contractData).to.equal(1n);
        });
        it('should revert when signer tries to skip ahead of others', async function () {
            const signers = [alice, bob, charlie];
            const choreo = await safe.mpecdh.initKeyExchange(await safeMPECDH3.getAddress());
            // All signers complete step0
            for (const signer of signers) {
                const tx = await choreo.step0(signer);
                await tx.wait();
            }
            const tx = await choreo.stepN(alice);
            await tx.wait();
            const a = await kdf(alice);
            const aliceSlot = await safeMPECDH3.source(alice.address);
            const aliceQueue = await safeMPECDH3.getQueue(aliceSlot);
            const lastKey = aliceQueue[aliceQueue.length - 1];
            const newKey = scalarMult(a.secretKey, buf(lastKey));
            let reverted = false;
            try {
                await safeMPECDH3.connect(alice).step.staticCall(newKey);
            }
            catch {
                reverted = true;
            }
            expect(reverted).to.equal(true);
        });
    });
});
//# sourceMappingURL=mpecdh.test.js.map