use aiken/transaction.{ScriptContext}
use hello_world/types

validator {
  fn spend(datum: types.Datum, _redeemer: Data, _ctx: ScriptContext) -> Bool {
    datum.message == "Hello World!"
  }
}
