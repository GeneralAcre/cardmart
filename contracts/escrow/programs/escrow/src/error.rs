use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the platform's escrow authority can release or refund a trade")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Seller account does not match the trade record")]
    InvalidSeller,
}
