import { 
    Lucid,
    fromHex,
    toHex,
    Blockfrost,
    SpendingValidator,
    Data,
    TxHash
} from "https://deno.land/x/lucid@0.8.3/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        Deno.env.get("BLOCKFROST_API_KEY"),
    ), 
    "Preprod"
);

const validator = await readValidator();

async function readValidator(): Promise<SpendingValidator>{
    const validator = JSON.parse(await Deno.readTextFile("./plutus.json")).validators[0];
    return {
        type: "PlutusV2",
        script: toHex(cbor.encode(fromHex(validator.compiledCode)))
    };
}

lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./owner-lucid.sk"));

const ownerPublicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address()
  ).paymentCredential.hash;
   
  const beneficiaryPublicKeyHash =
    lucid.utils.getAddressDetails(await Deno.readTextFile("beneficiary-lucid.addr"))
      .paymentCredential.hash;
   
  const Datum = Data.Object({
    lock_until: Data.BigInt, // this is POSIX time, you can check and set it here: https://www.unixtimestamp.com
    owner: Data.String, // we can pass owner's verification key hash as byte array but also as a string
    beneficiary: Data.String, // we can beneficiary's hash as byte array but also as a string
  });
   
  type Datum = Data.Static<typeof Datum>;
   
  const datum = Data.to<Datum>(
    {
      lock_until: 1688902752n, // Wed Jan 04 2023 14:52:41 GMT+0000
      owner: ownerPublicKeyHash, // our own wallet verification key hash
      beneficiary: beneficiaryPublicKeyHash,
    },
    Datum
  );
   
  const txLock = await lock(1000000, { into: validator, datum: datum });
   
  await lucid.awaitTx(txLock);
   
  console.log(`1 ADA locked into the contract
      Tx ID: ${txLock}
      Datum: ${datum}
  `);
   
  // --- Supporting functions
   
  async function lock(lovelace, { into, datum }): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(into);
   
    const tx = await lucid
      .newTx()
      .payToContract(contractAddress, { inline: datum }, { lovelace })
      .complete();
   
    const signedTx = await tx.sign().complete();
   
    return signedTx.submit();
  }