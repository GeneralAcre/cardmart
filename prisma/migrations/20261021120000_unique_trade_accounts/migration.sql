-- One escrow lock can back only one bid, offer or sale. verifyEscrowLock checks
-- this too, but a count-then-insert check races; the index makes it airtight.
-- NULLs are allowed repeatedly, so rows without an on-chain lock are unaffected.

-- CreateIndex
CREATE UNIQUE INDEX "Bid_tradeAccount_key" ON "Bid"("tradeAccount");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOffer_cashTradeAccount_key" ON "TradeOffer"("cashTradeAccount");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_tradeAccount_key" ON "EscrowTransaction"("tradeAccount");
