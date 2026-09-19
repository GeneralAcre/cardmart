use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

struct Harness {
    svm: LiteSVM,
    program_id: Pubkey,
    config: Pubkey,
    escrow_authority: Keypair,
}

fn setup() -> Harness {
    let program_id = escrow::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/escrow.so"));
    svm.add_program(program_id, bytes).unwrap();

    let escrow_authority = Keypair::new();
    svm.airdrop(&escrow_authority.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();

    let config = Pubkey::find_program_address(&[escrow::constants::CONFIG_SEED], &program_id).0;

    let ix = Instruction::new_with_bytes(
        program_id,
        &escrow::instruction::InitializeConfig {
            authority: escrow_authority.pubkey(),
        }
        .data(),
        escrow::accounts::InitializeConfig {
            payer: escrow_authority.pubkey(),
            config,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, &escrow_authority, vec![ix]).expect("initialize_config should succeed");

    Harness {
        svm,
        program_id,
        config,
        escrow_authority,
    }
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ixs: Vec<Instruction>) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{e:?}"))
}

fn send_multi(svm: &mut LiteSVM, payer: &Keypair, extra_signers: &[&Keypair], ixs: Vec<Instruction>) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&Keypair> = vec![payer];
    signers.extend(extra_signers);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{e:?}"))
}

fn trade_pda(program_id: &Pubkey, buyer: &Pubkey, trade_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[
            escrow::constants::TRADE_SEED,
            buyer.as_ref(),
            &trade_id.to_le_bytes(),
        ],
        program_id,
    )
    .0
}

fn lock_payment_ix(
    program_id: &Pubkey,
    buyer: &Pubkey,
    seller: &Pubkey,
    trade: &Pubkey,
    trade_id: u64,
    amount: u64,
) -> Instruction {
    Instruction::new_with_bytes(
        *program_id,
        &escrow::instruction::LockPayment { trade_id, amount }.data(),
        escrow::accounts::LockPayment {
            buyer: *buyer,
            seller: *seller,
            trade: *trade,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

#[test]
fn locks_then_releases_to_seller() {
    let mut h = setup();
    let buyer = Keypair::new();
    let seller = Keypair::new();
    h.svm.airdrop(&buyer.pubkey(), LAMPORTS_PER_SOL).unwrap();
    h.svm.airdrop(&seller.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let trade_id = 42u64;
    let amount = 250_000_000u64; // 0.25 SOL
    let trade = trade_pda(&h.program_id, &buyer.pubkey(), trade_id);

    send(
        &mut h.svm,
        &buyer,
        vec![lock_payment_ix(
            &h.program_id,
            &buyer.pubkey(),
            &seller.pubkey(),
            &trade,
            trade_id,
            amount,
        )],
    )
    .expect("lock_payment should succeed");

    let trade_account = h.svm.get_account(&trade).unwrap();
    let mut data: &[u8] = &trade_account.data;
    let trade_state = escrow::state::Trade::try_deserialize(&mut data).unwrap();
    assert_eq!(trade_state.amount, amount);
    assert_eq!(trade_state.buyer, buyer.pubkey());
    assert_eq!(trade_state.seller, seller.pubkey());

    let seller_balance_before = h.svm.get_balance(&seller.pubkey()).unwrap();

    let release_ix = Instruction::new_with_bytes(
        h.program_id,
        &escrow::instruction::ReleaseToSeller { trade_id }.data(),
        escrow::accounts::ReleaseToSeller {
            authority: h.escrow_authority.pubkey(),
            config: h.config,
            trade,
            buyer: buyer.pubkey(),
            seller: seller.pubkey(),
        }
        .to_account_metas(None),
    );
    send(&mut h.svm, &h.escrow_authority, vec![release_ix]).expect("release_to_seller should succeed");

    let seller_balance_after = h.svm.get_balance(&seller.pubkey()).unwrap();
    assert_eq!(seller_balance_after - seller_balance_before, amount);
    // A closed, zero-lamport account is pruned entirely, not left behind
    // with zeroed fields — get_account returns None for it.
    assert!(h.svm.get_account(&trade).is_none());
}

#[test]
fn locks_then_refunds_to_buyer() {
    let mut h = setup();
    let buyer = Keypair::new();
    let seller = Keypair::new();
    h.svm.airdrop(&buyer.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let trade_id = 7u64;
    let amount = 100_000_000u64;
    let trade = trade_pda(&h.program_id, &buyer.pubkey(), trade_id);

    send(
        &mut h.svm,
        &buyer,
        vec![lock_payment_ix(
            &h.program_id,
            &buyer.pubkey(),
            &seller.pubkey(),
            &trade,
            trade_id,
            amount,
        )],
    )
    .expect("lock_payment should succeed");

    let buyer_balance_before = h.svm.get_balance(&buyer.pubkey()).unwrap();

    let refund_ix = Instruction::new_with_bytes(
        h.program_id,
        &escrow::instruction::RefundToBuyer { trade_id }.data(),
        escrow::accounts::RefundToBuyer {
            authority: h.escrow_authority.pubkey(),
            config: h.config,
            trade,
            buyer: buyer.pubkey(),
        }
        .to_account_metas(None),
    );
    send(&mut h.svm, &h.escrow_authority, vec![refund_ix]).expect("refund_to_buyer should succeed");

    let buyer_balance_after = h.svm.get_balance(&buyer.pubkey()).unwrap();
    // Buyer gets back the full amount plus the rent-exempt reserve the
    // trade account was holding.
    assert!(buyer_balance_after > buyer_balance_before + amount - 1);
}

#[test]
fn rejects_release_from_a_non_authority_signer() {
    let mut h = setup();
    let buyer = Keypair::new();
    let seller = Keypair::new();
    let impostor = Keypair::new();
    h.svm.airdrop(&buyer.pubkey(), LAMPORTS_PER_SOL).unwrap();
    h.svm.airdrop(&impostor.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let trade_id = 99u64;
    let amount = 50_000_000u64;
    let trade = trade_pda(&h.program_id, &buyer.pubkey(), trade_id);

    send(
        &mut h.svm,
        &buyer,
        vec![lock_payment_ix(
            &h.program_id,
            &buyer.pubkey(),
            &seller.pubkey(),
            &trade,
            trade_id,
            amount,
        )],
    )
    .expect("lock_payment should succeed");

    let release_ix = Instruction::new_with_bytes(
        h.program_id,
        &escrow::instruction::ReleaseToSeller { trade_id }.data(),
        escrow::accounts::ReleaseToSeller {
            authority: impostor.pubkey(),
            config: h.config,
            trade,
            buyer: buyer.pubkey(),
            seller: seller.pubkey(),
        }
        .to_account_metas(None),
    );
    // `authority` in the accounts struct is itself a signer, so the
    // impostor's own key must sign the transaction too — it's the on-chain
    // `has_one = authority` check against `config.authority` that must then
    // reject it.
    let result = send_multi(&mut h.svm, &buyer, &[&impostor], vec![release_ix]);
    assert!(result.is_err(), "release should be rejected for a non-authority signer");
}

#[test]
fn rejects_a_swapped_seller_account_on_release() {
    let mut h = setup();
    let buyer = Keypair::new();
    let seller = Keypair::new();
    let attacker = Keypair::new();
    h.svm.airdrop(&buyer.pubkey(), LAMPORTS_PER_SOL).unwrap();
    h.svm.airdrop(&attacker.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let trade_id = 5u64;
    let amount = 75_000_000u64;
    let trade = trade_pda(&h.program_id, &buyer.pubkey(), trade_id);

    send(
        &mut h.svm,
        &buyer,
        vec![lock_payment_ix(
            &h.program_id,
            &buyer.pubkey(),
            &seller.pubkey(),
            &trade,
            trade_id,
            amount,
        )],
    )
    .expect("lock_payment should succeed");

    // Escrow authority signs legitimately, but the instruction tries to pay
    // out to `attacker` instead of the real seller on file.
    let release_ix = Instruction::new_with_bytes(
        h.program_id,
        &escrow::instruction::ReleaseToSeller { trade_id }.data(),
        escrow::accounts::ReleaseToSeller {
            authority: h.escrow_authority.pubkey(),
            config: h.config,
            trade,
            buyer: buyer.pubkey(),
            seller: attacker.pubkey(),
        }
        .to_account_metas(None),
    );
    let result = send(&mut h.svm, &h.escrow_authority, vec![release_ix]);
    assert!(result.is_err(), "release should be rejected when seller doesn't match the trade record");
}
