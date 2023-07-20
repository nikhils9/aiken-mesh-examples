import {
    Lucid,
    Data,
    Blockfrost,
    fromText,
    Constr,
    MintingPolicy,
    SpendingValidator
} from "https://deno.land/x/lucid@0.9.5/mod.ts";

const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0",
    Deno.env.get("BLOCKFROST_API_KEY")),
    "Preprod"
);

await lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./lucid-key.sk"));

type AppliedValidators = {
    giftCard: MintingPolicy,
    redeem: SpendingValidator,
    policyId: string,
    lockAddress: string
}
const appliedValidators: AppliedValidators = JSON.parse(await Deno.readTextFile("./applied-validators.json"));

const tokenName = "Gift-Card";
const assetName = appliedValidators.policyId + fromText(tokenName);

const lockedUtxos = await lucid.utxosAt(appliedValidators.lockAddress);
const rdmr = Data.to(new Constr(1, []));

const tx = await lucid
            .newTx()
            .collectFrom(lockedUtxos, Data.void())
            .mintAssets({[assetName]: BigInt(-1)}, rdmr)
            .attachMintingPolicy(appliedValidators.giftCard)
            .attachSpendingValidator(appliedValidators.redeem)
            .complete();

const signedTx = await tx.sign().complete();

const txHash = await signedTx.submit();

await lucid.awaitTx(txHash);

console.log(`Successfully redeemed gift card with
            NFT: ${assetName}
            @lockAddress: ${appliedValidators.lockAddress}
            txHash: ${txHash}`);