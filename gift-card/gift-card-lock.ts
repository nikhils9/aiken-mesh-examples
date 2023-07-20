import {
    Lucid,
    Blockfrost,
    SpendingValidator,
    MintingPolicy,
    applyParamsToScript,
    applyDoubleCborEncoding,
    fromText,
    Constr,
    Data,
    OutRef
} from "https://deno.land/x/lucid@0.9.5/mod.ts";
import blueprint from "./plutus.json" assert { type: "json" };

const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        Deno.env.get("BLOCKFROST_API_KEY")
    ),
    "Preprod"
);

lucid.selectWalletFromPrivateKey(await Deno.readTextFile("lucid-key.sk"));
const utxos = await lucid.wallet.getUtxos();
const utxo = utxos[0];
export const tokenName = "Gift-Card";

const appliedValidators = await applyParameters(await readValidator(), utxo, tokenName);

const rdmr = Data.to(new Constr(0, []));
const assetName = appliedValidators.policyId + fromText(tokenName);

const tx = await lucid
            .newTx()
            .collectFrom([utxo])
            .payToContract(appliedValidators.lockAddress, { inline: Data.void() }, { lovelace: BigInt(2000000) })
            .mintAssets({ [assetName] : BigInt(1) }, rdmr)
            .attachMintingPolicy(appliedValidators.giftCard)
            .complete()

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();
await lucid.awaitTx(txHash);

console.log(`Successfully created gift card with
            NFT: ${assetName}
            @lockAddress: ${appliedValidators.lockAddress}
            txHash: ${txHash}`);

type RawValidators = {
    giftCard: MintingPolicy,
    redeem: SpendingValidator
}

export type AppliedValidators = {
    giftCard: MintingPolicy,
    redeem: SpendingValidator,
    policyId: string,
    lockAddress: string
}

async function readValidator() : Promise<RawValidators> {
    const validators = blueprint.validators

    return {
        giftCard: await parseValidator(validators, "oneshot.gift_card"),
        redeem: await parseValidator(validators, "oneshot.redeem")
    }
}

async function parseValidator(validators, title: string) : Promise<any> {
    const validator = validators.find((e) => e.title === title );

    if(!validator)
        throw new Error(title + " validator not found!");

    return {
        type: "PlutusV2",
        script: validator.compiledCode
    }
}

async function applyParameters(validators: RawValidators, utxo: OutRef, tokenName: string): Promise<AppliedValidators> {
    const outRef = new Constr(0, [
        new Constr(0, [utxo.txHash]),
        BigInt(utxo.outputIndex)
    ]);

    const giftCardCode = applyParamsToScript(validators.giftCard.script, [fromText(tokenName), outRef]);
    const giftCard = {
        type: "PlutusV2",
        script: applyDoubleCborEncoding(giftCardCode)
    };

    const policyId = lucid.utils.validatorToScriptHash(giftCard);

    const redeemCode = applyParamsToScript(validators.redeem.script, [fromText(tokenName), policyId]);
    const redeem = {
        type: "PlutusV2",
        script: applyDoubleCborEncoding(redeemCode)
    }

    const lockAddress = lucid.utils.validatorToAddress(redeem);

    const appliedValidators: AppliedValidators = {
        giftCard: giftCard,
        redeem: redeem,
        policyId: policyId,
        lockAddress: lockAddress
    }

    const appliedValidatorsString = JSON.stringify(appliedValidators);
    console.log(appliedValidatorsString);
    await Deno.writeTextFile("applied-validators.json", appliedValidatorsString);

    return appliedValidators;
}