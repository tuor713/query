# Risk Data

The `memory.default.risk` table contains risk data per business date, book and product. Books further rollup to strategies and organizations codes (`goc`) via `memory.dafult.account`.


Below sample query shows how to aggregate risk metrics by strategy.

```malloy
##! experimental.parameters

source: accounts is trino.table('memory.default.account') extend {
    primary_key: mnemonic
}

source: trisk(t0::number) is trino.table('memory.default.risk') extend {
    where: businessdate = t0
    join_one: account is accounts on book = account.mnemonic
}

run: trisk(t0 is 20250131) -> {
    group_by:
        account.strategy
    aggregate:
        jtd is sum(jtd),
        mtm is sum(mtm),
        cr01 is sum(cr01)
}
```
