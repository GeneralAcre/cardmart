//! Proof escrow program.
//!
//! Holds a buyer's payment in a per-trade PDA until the platform's escrow
//! authority (the app server, not any individual buyer/seller/staff wallet)
//! releases it to the seller or refunds it to the buyer. See this crate's
//! README for the security model — in particular why the escrow authority
//! keypair is never the same as the program's upgrade authority, and why
//! neither is committed to git.

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FQwLbEBxKw5srEobsCw37c1B7QNkNaRACN5VBvUwWEuC");

#[program]
pub mod escrow {
    use super::*;

    /// One-time setup: records which pubkey is allowed to release/refund
    /// trades going forward. Anyone can call this, but it can only ever
    /// succeed once per deployment — `config` uses `init`, so a second call
    /// fails with an "account already in use" error instead of letting
    /// someone quietly swap the authority later.
    pub fn initialize_config(ctx: Context<InitializeConfig>, authority: Pubkey) -> Result<()> {
        crate::instructions::initialize_config::handle_initialize_config(ctx, authority)
    }

    /// Buyer locks `amount` lamports into a new per-trade PDA. `trade_id` is
    /// caller-chosen and just needs to be unique per buyer (it's part of the
    /// PDA seeds), so the app can use its own escrow-transaction id for it.
    pub fn lock_payment(ctx: Context<LockPayment>, trade_id: u64, amount: u64) -> Result<()> {
        crate::instructions::lock_payment::handle_lock_payment(ctx, trade_id, amount)
    }

    /// Escrow authority releases a locked trade's funds to the seller.
    pub fn release_to_seller(ctx: Context<ReleaseToSeller>, trade_id: u64) -> Result<()> {
        crate::instructions::release_to_seller::handle_release_to_seller(ctx, trade_id)
    }

    /// Escrow authority refunds a locked trade's funds back to the buyer.
    pub fn refund_to_buyer(ctx: Context<RefundToBuyer>, trade_id: u64) -> Result<()> {
        crate::instructions::refund_to_buyer::handle_refund_to_buyer(ctx, trade_id)
    }
}
