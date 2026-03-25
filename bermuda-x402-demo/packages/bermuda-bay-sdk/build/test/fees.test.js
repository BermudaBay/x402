import 'mocha';
import { expect } from 'chai';
import { http, HttpResponse } from 'msw';
import { DummyAddress } from '../src/utils.js';
import sinon from 'sinon';
import { JsonRpcProvider } from 'ethers';
import { setupServer } from 'msw/node';
import { calcFeeEthValue, getTokenEthValue, calcExecutionCost, getNativePriceURL, calcExecutionFee, calcTokenAmount } from '../src/fees.js';
describe('fees', () => {
    let provider;
    let sandbox;
    const token1Decimals = 6;
    const token2Decimals = 18;
    let interceptor;
    const token1Address = '0x0101010101010101010101010101010101010101';
    const token2Address = '0x0202020202020202020202020202020202020202';
    beforeEach(() => {
        const token1NativePrice = 100_000_000.1234;
        const token2NativePrice = 0.0001;
        const handlers = [
            http.get(getNativePriceURL(token1Address), () => {
                return HttpResponse.json({
                    price: token1NativePrice
                });
            }),
            http.get(getNativePriceURL(token2Address), () => {
                return HttpResponse.json({
                    price: token2NativePrice
                });
            })
        ];
        sandbox = sinon.createSandbox();
        provider = new JsonRpcProvider();
        sandbox.stub(provider, 'estimateGas').resolves(10000000n);
        sandbox.stub(provider, 'getFeeData').resolves({
            gasPrice: 99999999n,
            maxFeePerGas: 100000000n,
            maxPriorityFeePerGas: 100000001n,
            toJSON: () => { }
        });
        interceptor = setupServer(...handlers);
        interceptor.listen({ onUnhandledRequest: 'bypass' });
    });
    afterEach(() => {
        sandbox.restore();
        interceptor.close();
    });
    describe('calcTokenAmount', () => {
        const slippage = 0.1;
        const tokenEthValue = 1000000001234000n;
        const executionFee = 1100000000000000n;
        describe('slippage validation', () => {
            it('should throw an error if the slippage is negative', () => {
                const slippage = -1;
                expect(() => calcTokenAmount({ slippage, executionFee, tokenEthValue })).to.throw(/range 0 to 1/);
            });
            it('should throw an error if the slippage is greater than 1', () => {
                const slippage = 1.1;
                expect(() => calcTokenAmount({ slippage, executionFee, tokenEthValue })).to.throw(/range 0 to 1/);
            });
        });
        it('should calculate the token amount without slippage', () => {
            const slippage = 0;
            const tokenAmount = calcTokenAmount({
                slippage,
                executionFee,
                tokenEthValue
            });
            expect(tokenAmount).to.be.approximately(1.099, 0.001);
        });
        it('should calculate the token amount with slippage', () => {
            const tokenEthValue = 1000000001234000n;
            const executionFee = 1100000000000000n;
            const tokenAmount = calcTokenAmount({
                slippage,
                executionFee,
                tokenEthValue
            });
            expect(tokenAmount).to.be.approximately(1.209, 0.001);
        });
    });
    describe('calcExecutionFee', () => {
        it('should calculate the execution fee', () => {
            const feeEthValue = 100000000000000n;
            const executionCost = 1000000000000000n;
            const executionFee = calcExecutionFee({
                feeEthValue,
                executionCost
            });
            expect(executionFee).to.equal(1100000000000000n);
        });
    });
    describe('getTokenEthValue', () => {
        describe('with a token that has 6 decimals', () => {
            it("should return the token's ETH value", async () => {
                const token = token1Address;
                const decimals = token1Decimals;
                const amount = 10n * BigInt(10 ** decimals); // 10 TOKEN1
                const tokenEthValue = await getTokenEthValue({
                    token,
                    decimals,
                    amount
                });
                expect(tokenEthValue).to.equal(1000000001234000n);
            });
        });
        describe('with a token that has 18 decimals', () => {
            it("should return the token's ETH value", async () => {
                const token = token2Address;
                const decimals = token2Decimals;
                const amount = 10n * BigInt(10 ** decimals); // 10 TOKEN2
                const tokenEthValue = await getTokenEthValue({
                    token,
                    decimals,
                    amount
                });
                expect(tokenEthValue).to.equal(1000000000000000n);
            });
        });
    });
    describe('calcExecutionCost', () => {
        const data = '0x';
        const to = DummyAddress;
        it('should calculate the execution cost of a transaction', async () => {
            const executionCost = await calcExecutionCost({
                to,
                data,
                provider
            });
            expect(executionCost).to.equal(1000000000000000n);
        });
    });
    describe('calcFeeEthValue', () => {
        const fee = 0.1; // 10%
        const executionCost = 1000000000000000n;
        describe('fee validation', () => {
            it('should throw an error if the fee is negative', () => {
                const fee = -1;
                expect(() => calcFeeEthValue({ fee, executionCost })).to.throw(/range 0 to 1/);
            });
            it('should throw an error if the fee is greater than 1', () => {
                const fee = 1.1;
                expect(() => calcFeeEthValue({ fee, executionCost })).to.throw(/range 0 to 1/);
            });
        });
        it('should calculate the fee expressed in ETH', () => {
            const feeEthValue = calcFeeEthValue({
                fee,
                executionCost
            });
            expect(feeEthValue).to.equal(100000000000000n);
        });
    });
});
//# sourceMappingURL=fees.test.js.map