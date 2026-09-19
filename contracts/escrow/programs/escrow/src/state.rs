use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    /// The platform's escrow authority — the only signer allowed to release
    /// or refund a locked trade. Deliberately NOT the same key as the
    /// program's upgrade authority: upgrade authority controls the
    /// program's *code*, this controls day-to-day fund movement. Keeping
    /// them separate means the day-to-day signer (held by the app server)
    /// never has the power to redeploy or replace the program logic.
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Trade {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub trade_id: u64,
    pub status: TradeStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum TradeStatus {
    Locked,
    Released,
    Refunded,
}
