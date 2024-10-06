import suidouble from 'suidouble'; 
import config from './config.js';
import FomoMiner from './includes/fomo/FomoMiner.js';
import fs from 'fs/promises'; 

const { SuiMaster } = suidouble;

const loadPrivateKeysFromFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8'); 
        return data.split('\n').map(line => line.trim()).filter(line => line); 
    } catch (error) {
        throw new Error(`Failed to load private keys from file: ${error.message}`);
    }
};

const run = async() => {
    const chain = config.chain;
    const filePath = './private_keys.txt'; 

    if (!config.chain) {
        throw new Error('Chain parameter is required');
    }

    const phrases = await loadPrivateKeysFromFile(filePath);

    if (!phrases || phrases.length === 0) {
        throw new Error('No private keys found in the file');
    }

    const miners = {};

    const createSuiMaster = async(phrase) => {
        const suiMasterParams = {
            client: chain,
            debug: !!config.debug,
        };

        if (phrase.indexOf('suiprivkey') === 0) {
            suiMasterParams.privateKey = phrase;
        } else {
            suiMasterParams.phrase = phrase;
        }

        const suiMaster = new SuiMaster(suiMasterParams);
        await suiMaster.initialize();
        console.log('SuiMaster connected as', suiMaster.address);

        return suiMaster;
    };

    const doMine = async(minerInstance) => {
        while (true) {
            await minerInstance.mine();
            await new Promise((res) => setTimeout(res, 1000));
        }
    };

    const minerTasks = []; 

    for (const phrase of phrases) {
        const suiMaster = await createSuiMaster(phrase);

        if (config.do.fomo) {
            const fomoMiner = new FomoMiner({
                suiMaster,
                packageId: config.fomo.packageId,
                configId: config.fomo.configId,
                buses: config.fomo.buses,
            });

            miners[suiMaster.address] = fomoMiner;
            minerTasks.push(doMine(miners[suiMaster.address])); 
        }
    }

    await Promise.all(minerTasks);
};

run()
    .then(() => {
        console.log('Mining started for all miners');
    })
    .catch((err) => {
        console.error('Error in mining process:', err);
    });
