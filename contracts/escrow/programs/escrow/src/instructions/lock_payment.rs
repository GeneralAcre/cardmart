use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Trade, TradeStatus},
};

#[derive(Accounts)]
#[instruction(trade_id: u64, amount: u64)]
pub struct LockPayment<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: only recorded as the future payout recipient. A wrong value
    /// here only locks the buyer's own funds into a trade that can never
    /// legitimately release anywhere else — `release_to_seller` re-checks
    /// this exact pubkey against the trade record before paying out.
    pub seller: UncheckedAccount<'info>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Trade::INIT_SPACE,
        seeds = [TRADE_SEED, buyer.key().as_ref(), trade_id.to_le_bytes().as_ref()],
        bump
    )]
    pub trade: Account<'info, Trade>,
    pub system_program: Program<'info, System>,
}

pub fn handle_lock_payment(ctx: Context<LockPayment>, trade_id: u64, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.buyer.to_account_info(),
        to: ctx.accounts.trade.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(anchor_lang::system_program::ID, cpi_accounts);
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    let trade = &mut ctx.accounts.trade;
    trade.buyer = ctx.accounts.buyer.key();
    trade.seller = ctx.accounts.seller.key();
    trade.amount = amount;
    trade.trade_id = trade_id;
    trade.status = TradeStatus::Locked;
    trade.bump = ctx.bumps.trade;

    msg!("Locked {} lamports for trade {}", amount, trade_id);
    Ok(())
}
