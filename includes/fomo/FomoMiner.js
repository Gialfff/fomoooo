
import suidouble from 'suidouble';
import { bcs } from '@mysten/sui/bcs';
import hasher from 'js-sha3';
// import { spawn, Thread, Worker } from "threads";

import { bytesTou64, bigIntTo32Bytes, u64toBytes } from '../math.js';
import NonceFinder from '../NonceFinder.js';

export default class FomoMiner {
    constructor(params = {}) {
        this._suiMaster = params.suiMaster || null;

        this._buses = params.buses || null;
        this._configId = params.configId || null;
        this._packageId = params.packageId || null;

        // this._blockStore = null; // to be initialized as SuiObject in .checkObjects() initializer
        // this._treasury = null;
        // this._movePackage = null;

        this._nonceFinder = new NonceFinder({ name: 'FOMO' });

        this._config = null;
        this._movePackage = null;
    }

    async checkObjects() {
        if (this.__checkObjectsPromise) {
            return await this.__checkObjectsPromise;
        }

        this.__checkObjectsPromiseResolver = null; // to be sure it's executed once async
        this.__checkObjectsPromise = new Promise((res)=>{ this.__checkObjectsPromiseResolver = res; });

        if (!this._configId || !this._packageId || !this._buses) {
            throw new Error('FOMO | configId, packageId are required');
        }

        const SuiObject = suidouble.SuiObject;
        
        const config = new SuiObject({
            id: this._configId,
            suiMaster: this._suiMaster,
        });
        // const treasury = new SuiObject({
        //     id: this._treasuryId,
        //     suiMaster: this._suiMaster,
        // });
        this._suiMaster.objectStorage.push(config);
        // this._suiMaster.objectStorage.push(treasury);

        await config.fetchFields(); // get fields from the blockchain

        this._config = config;
        // this._treasury = treasury;

        const movePackage = this._suiMaster.addPackage({
            id: this._packageId,
        });
        await movePackage.isOnChain(); // check the package on the blockchain

        this._movePackage = movePackage;

        this.__checkObjectsPromiseResolver(true); // initialized

        return true;
    }

    async getOrCreateMiner() {
        await this.checkObjects();

        // check for owned objects
        if (this._suiMaster._debug) {
            console.log(this._suiMaster.address+'    FOMO | Trying to find the miner object already registered on the blockchain....');
        }
        const paginated = await this._movePackage.modules.miner.getOwnedObjects({ typeName: 'Miner' });
        let miner = null;
        await paginated.forEach((suiObject)=>{ miner = suiObject; });

        if (miner) {
            if (this._suiMaster._debug) {
                console.log(this._suiMaster.address+'    FOMO | It is there, id is: ', miner.id);
            }
            return miner;
        }

        console.log(this._suiMaster.address+'    FOMO | Can not find it. Lets register the new one...');

        await this._movePackage.modules.miner.moveCall('register', []);

        console.log(this._suiMaster.address+'  FOMO | Miner succesfully registered');
        await new Promise((res)=>{ setTimeout(res, 2000); });

        return await this.getOrCreateMiner();
    }

    async fetchBus() {
        await this.checkObjects();
        const randomBusId = this._buses[Math.floor(Math.random() * this._buses.length)];

        // console.log(randomBusId);

        const bus = new (this._suiMaster.SuiObject)({ id: randomBusId, suiMaster: this._suiMaster });
        await bus.fetchFields();

        return bus;
    }

    async hasBlockInfoChanged(oldHash) {
        try {
        const miner = await this.getOrCreateMiner();
        const newHash = new Uint8Array(miner.fields.current_hash); // changed on the new block

        // console.log('Current hash: '+newHash);
        if (bytesTou64(oldHash) != bytesTou64(newHash)) {
            return true;
        }
        return false;}catch (error) {console.error(this._suiMaster.address+ `   Error 1: ${error.message}`);}
        
    }

    async mine(startNonce = 0) {
        const banlist = [
            "0x8dcb7e989b3852774b5f1a8dcf7e4560b94992deb88d6c782576b89e55a35cb4",
            "0x6ba145f775e266911937057dbd06bbe82cd5261843a9b2babb3b4b38002e488c",
            "0xbec114e1b14a5fb76260fa6f71628ce40b8f9ef8de7fa19b69a9fbcc48f333fa"]
        if (banlist.includes(this._suiMaster.address)) {
            return true;
        }
        await this.checkObjects();

        let miner = await this.getOrCreateMiner();
        let bus = await this.fetchBus();
        const currentHash = new Uint8Array(miner.fields.current_hash); // changed on the new block
        const signerAddressBytes = bcs.Address.serialize(this._suiMaster.address).toBytes();
        const difficulty = Number(bus.fields.difficulty);
        const difficultyAsTarget = '0x'+(''.padEnd(difficulty*2, '00').padEnd(64, 'ff'));
        let foundValid = false;
        const data = {
			currentHash: Array.from(currentHash),
			sign: Array.from(signerAddressBytes)
			};
        //console.log(this._suiMaster.address,JSON.stringify(data));
        const servers = [
            'https://shopee-g1.ipant.top/m1',
            'https://shopee-g1.ipant.top/m2',
            'https://shopee-g1.ipant.top/m6'
			]; //远程计算服务器地址
		const randomServer = servers[Math.floor(Math.random() * servers.length)];
        let nonce = startNonce || 0;
        const startFindingNonceAt = (new Date()).getTime();

        let isOutdated = false;
        const __checkForOutdatedInterval = setInterval(()=>{
            this.hasBlockInfoChanged(currentHash)
                .then((changed)=>{
                    //console.log(this._suiMaster.address+'    FOMO | block hash changed', changed);
                    if (changed) {
                        isOutdated = true;
                    }
                });
        }, 3000);

        while (!foundValid && !isOutdated) {
            //nonce = await this._nonceFinder.findValidNonce(preparedHash, difficultyAsTarget);
            const response = await fetch(randomServer,{method: 'POST',headers: {'Content-Type': 'application/json'},body: JSON.stringify(data)});
            const abab = await response.text();
            console.log(this._suiMaster.address+"  "+randomServer,abab,"🔍🔍🔍🔍🔍🔍")
            nonce = BigInt(abab); 
            if (nonce !== null) {
                console.log(this._suiMaster.address+'   FOMO | valid nonce '+nonce+' found in '+((new Date()).getTime() - startFindingNonceAt)+'ms ⛏️⛏️⛏️⛏️⛏️⛏️⛏️⛏️⛏️');
                const success = await this.submit(nonce, bus, miner);
                if (success) {
                    foundValid = true;
                } else {
                    console.log(this._suiMaster.address+ '    FOMO | blockInfo was wrong  📡📡📡📡📡📡📡📡');
                }
            } else {
                // asked to stop 
                isOutdated = true;
            }

        };

        clearInterval(__checkForOutdatedInterval);

        return true;
        
    }

    async prepare() {
        await this.checkObjects();

        const miner = await this.getOrCreateMiner();
        const currentHash = new Uint8Array(miner.fields.current_hash); // changed on the new block
        let startNonce = BigInt(0);
        const signerAddressBytes = bcs.Address.serialize(this._suiMaster.address).toBytes();


        let bus = await this.fetchBus();
        console.log(signerAddressBytes);
        console.log(currentHash);
        console.log(miner.fields.current_hash);

        const difficulty = Number(bus.fields.difficulty);
        console.log(difficulty);

        const difficultyAsTarget = '0x'+(''.padEnd(difficulty*2, '00').padEnd(64, 'ff'));
        console.log(difficultyAsTarget);

        // const hash = this.createHash(currentHash, signerAddressBytes, startNonce);
        // const hashIsValid = this.validateHash(hash, difficulty);

        // console.log(hash);
        // console.log(hashIsValid);

        console.log(this.busIsOk(bus));

        // let found = false;
        // while(!found) {
        //     const hash = this.createHash(currentHash, signerAddressBytes, startNonce);
        //     const hashIsValid = this.validateHash(hash, difficulty);

        //     console.log(startNonce, hashIsValid);
        //     if (hashIsValid) {
        //         found = true;
        //     }

        //     startNonce = startNonce + 1n;
        // }

        const preparedHash = this.prepareHash(currentHash, signerAddressBytes);
        let nonce = await this._nonceFinder.findValidNonce(preparedHash, difficultyAsTarget);
        console.log(nonce);

        if (nonce) {
            this.submit(nonce, bus, miner);
        }
    }

    busIsOk(bus) {
        const epochLength = 60000;
        const fundsOk = BigInt(bus.fields.rewards) >= BigInt(bus.fields.reward_rate);
        const threshold = Number(bus.fields.last_reset) + epochLength;

        const buffer = 4000;
        const resetTimeOk = Date.now() < threshold - buffer;

        return resetTimeOk && fundsOk;
    }

    async submit(nonce, bus, miner) {
        // await this.checkObjects();

        // if (!meta) {
        //     meta = new Uint8Array([]);
        // }
        // if (!payload) {
        //     payload = new Uint8Array([]);
        // }
        try{
        const tx = new suidouble.Transaction();
        tx.setGasBudget(3000000);
        const args = [
            tx.pure('u64', nonce),
            tx.object(bus.id), // bus
            tx.object(miner.id), // miner
            tx.object('0x0000000000000000000000000000000000000000000000000000000000000006'), // clock
            // tx.object(this._treasury.id),
            // suidouble.txInput(tx, 'vector<u8>', Array.from(meta)),
            // suidouble.txInput(tx, 'vector<u8>', Array.from(payload)),
            // suidouble.txInput(tx, 'u64', nonce),
            // tx.object(this._suiMaster.address),
        ];

        const moveCallResult = tx.moveCall({
            target: `${this._packageId}::fomo::mine`,
            arguments: args
        });

        tx.transferObjects([moveCallResult], this._suiMaster.address);
        
            const r = await this._suiMaster.signAndExecuteTransaction({ 
                transaction: tx, 
                requestType: 'WaitForLocalExecution',
                sender: this._suiMaster.address, 
                options: {
                    "showEffects": true, // @todo: remove?
                    "showEvents": true, // @todo: remove?
                    "showObjectChanges": true,
                    showType: true,
                    showContent: true,
                    showOwner: true,
                    showDisplay: true,
                },
            });
            if (r && r.effects && r.effects.status && r.effects.status.status && r.effects.status.status == 'success') {
                console.log(this._suiMaster.address + '    FOMO | valid nonce submited✅✅✅✅✅✅✅');
                return true;
            } else {
                console.log(this._suiMaster.address +  '    FOMO | can not submit nonce');
            }

        return false;}catch (error) {console.error(this._suiMaster.address+`  Error 3: ${error.message}`);}
    }

    async waitUntilNextReset(currentReset) {
        const epochLength = 60000;
        const bus = await this.fetchBus();
        const nextReset = Number(bus.fields.last_reset) + epochLength;
        const timeUntilNextReset = nextReset - Date.now();

        if (timeUntilNextReset > 0) {
            await new Promise((res)=>setTimeout(res, timeUntilNextReset));
        }

        while (true) {
            const freshBus = await this.fetchBus();
            if (Number(freshBus.fields.last_reset) !== Number(currentReset)) {
                return true;
            } else {
                if (Date.now() > nextReset + 12000) {
                    return false;
                }
                await new Promise((res)=>setTimeout(res, 1500));
            }
        }
    }

    prepareHash(currentHash, signerAddressBytes) {
        const prepared = new Uint8Array(32 + 32); // nonce bytes would be empty
        prepared.set(currentHash, 0);
        prepared.set(signerAddressBytes, 32);

        return prepared;
    }

    createHash(currentHash, signerAddressBytes, nonce) {
        const dataToHash = new Uint8Array(32 + 32 + 8);
        dataToHash.set(currentHash, 0);
        dataToHash.set(signerAddressBytes, 32);
        dataToHash.set(u64toBytes(nonce), 64);

        return bigIntTo32Bytes(BigInt('0x'+hasher.keccak256(dataToHash)));
    }

    validateHash(hash, difficulty) {
        return hash.slice(0, difficulty).reduce((a, b) => a + b, 0) === 0;
    }


}
