import { 
    AppWallet, 
    BlockfrostProvider, 
    PlutusScript,
    Data,
    Transaction,
    UTxO,
    resolvePaymentKeyHash,
    resolvePlutusScriptAddress,
    resolveDataHash  
} from "npm:@meshsdk/core@1.5.4";
import { fromHex, toHex, utf8ToHex } from "https://deno.land/x/lucid@0.8.3/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

const blockchainProvider = new BlockfrostProvider(Deno.env.get("BLOCKFROST_API_KEY"));

const wallet = new AppWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
      type: 'root',
      bech32: await Deno.readTextFile("./key.sk")
    },
});

const address = await wallet.getPaymentAddress();

const validator = await readValidator();

const publicKeyHash = resolvePaymentKeyHash(address);

const datum: Data = {
    alternative: 0,
    fields: [publicKeyHash]
};

const redeemer = {
    data: {
        alternative: 0,
        fields: [utf8ToHex("Hello World!")]
    }
};

const contractAddress = resolvePlutusScriptAddress(validator, 0);

const assetUTxO = await _getAssetUtxo({scriptAddress: contractAddress, datum: datum});
console.log(assetUTxO);

const utxo: UTxO = { 
    input: {txHash: Deno.args[0], outputIndex: 0}, 
    output: {address: contractAddress, amount: [{unit:'lovelace', quantity:'1500000'}]}
};

const utxoOut: UTxO = { output:{address: address, amount: [{unit:'lovelace', quantity:'1300000'}]}}
// const utxo: UTxO = { input: {txHash: Deno.args[0], outputIndex: 0}, output: {address: address, amount: [{unit:'lovelace', quantity:'1500000'}]}};

const collateral: UTxO = {input: {txHash: Deno.args[1], outputIndex: Deno.args[2]}, output: {address: address, amount: []}};
  
const txHash = await unlock(utxo, { from: validator, using: redeemer });

console.log(`1.5 tADA locked into the contract at:
    Tx ID: ${txHash}
    Datum: ${redeemer}
`);

// --- Supporting functions

async function unlock(
  utxo: UTxO,
  { from, using }: { from: PlutusScript; using: any },
): Promise<string> {

    const tx = new Transaction({ initiator: wallet })
        .setTxInputs([assetUTxO])
        .setCollateral([collateral])
        .sendValue({address: address}, utxoOut)
        .setRequiredSigners([address]);

    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}

async function readValidator(): Promise<PlutusScript> {
    const validator = JSON
        .parse(await Deno.readTextFile("plutus.json"))
        .validators[0];

    return {
        version: "V2",
        code: toHex(cbor.encode(fromHex(validator.compiledCode)))
    };
}

async function _getAssetUtxo({ scriptAddress, datum }) {
  
    const utxos = await blockchainProvider.fetchAddressUTxOs(scriptAddress);
  
    const dataHash = resolveDataHash(datum);
  
    let utxo = utxos.find((utxo: any) => {
      return utxo.output.dataHash == dataHash;
    });
  
    return utxo;
  }
  