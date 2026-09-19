use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Config, Trade},
};

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct ReleaseToSeller<'info> {
    /// The platform's escrow authority, checked against `config.authority`
    /// below — never the buyer or seller themselves.
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
    #[account(mut, address = trade.seller @ ErrorCode::InvalidSeller)]
    pub seller: SystemAccount<'info>,
}

pub fn handle_release_to_seller(ctx: Context<ReleaseToSeller>, _trade_id: u64) -> Result<()> {
    let amount = ctx.accounts.trade.amount;

    // Drain the escrowed principal to the seller now; the `close = buyer`
    // constraint above then returns whatever's left (just the rent-exempt
    // reserve) to the buyer once this handler returns.
    **ctx.accounts.trade.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += amount;

    msg!(
        "Released {} lamports to seller for trade {}",
        amount,
        ctx.accounts.trade.trade_id
    );
    Ok(())
}
