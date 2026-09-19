use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Config, Trade},
};

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct RefundToBuyer<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [TRADE_SEED, buyer.key().as_ref(), trade_id.to_le_bytes().as_ref()],
        bump = trade.bump,
        close = buyer,
    )]
    pub trade: Account<'info, Trade>,
    #[account(mut, address = trade.buyer)]
    pub buyer: SystemAccount<'info>,
}

pub fn handle_refund_to_buyer(ctx: Context<RefundToBuyer>, _trade_id: u64) -> Result<()> {
    // Nothing to drain manually — `close = buyer` above returns the full
    // remaining balance (principal + rent) straight back to the buyer.
    msg!(
        "Refunded {} lamports to buyer for trade {}",
        ctx.accounts.trade.amount,
        ctx.accounts.trade.trade_id
    );
    Ok(())
}
