import "server-only";
// Metaplex Token Metadata for digital twins, so wallets (Phantom, Backpack,
// Solflare) and NFT marketplaces show each card as a real NFT — name, image,
// grade and cert — instead of an unnamed token.
//
// Two stock instructions on the deployed Token Metadata program, encoded here
// directly (Borsh) rather than pulling in Metaplex's Umi SDK alongside
// @solana/kit:
//   - CreateMetadataAccountV3: name, symbol and a URI pointing at
//     /api/nft/[mint] (app/api/nft/[mint]/route.ts), which serves the JSON.
//   - CreateMasterEditionV3 with max supply 0: makes it a NonFungible
//     1-of-1 and hands the mint authority to the edition PDA, so the supply
//     of 1 is fixed forever (it replaces revoking the mint authority).
// The token itself stays a plain SPL token, so the delegate-approve and
// transfer flow in lib/web3/token-server.ts works exactly as before.
import { AccountRole, address, getAddressEncoder, getProgramDerivedAddress, getUtf8Encoder, type Address, type Instruction } from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

export const TOKEN_METADATA_PROGRAM = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

// Token Metadata's length limits.
const MAX_NAME = 32;
const MAX_SYMBOL = 10;
const MAX_URI = 200;

export const NFT_SYMBOL = "CMART";

const utf8 = getUtf8Encoder();
const addressBytes = getAddressEncoder();

/** Trims to a byte limit without cutting a multi-byte character in half. */
function clip(text: string, maxBytes: number): string {
  let out = text;
  while (utf8.encode(out).length > maxBytes) out = out.slice(0, -1);
  return out;
}

function borshString(text: string): Uint8Array {
  const bytes = utf8.encode(text);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

function concat(...parts: (Uint8Array | number[])[]): Uint8Array {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function pda(seeds: (string | Address)[]): Promise<Address> {
  const [found] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM,
    seeds: seeds.map((s) => (s === "metadata" || s === "edition" ? utf8.encode(s) : addressBytes.encode(s as Address))),
  });
  return found;
}

export const findMetadataPda = (mint: Address) => pda(["metadata", TOKEN_METADATA_PROGRAM, mint]);
export const findMasterEditionPda = (mint: Address) => pda(["metadata", TOKEN_METADATA_PROGRAM, mint, "edition"]);

/**
 * The two instructions that turn a freshly minted 1-of-1 SPL token into a
 * Metaplex NFT. Must run after MintTo, in the same transaction, while
 * `authority` is still the mint authority. `authority` signs as mint
 * authority, payer and update authority (so the platform can correct a
 * listing's metadata later).
 */
export async function getCreateNftMetadataInstructions(opts: {
  mint: Address;
  authority: Address;
  name: string;
  uri: string;
}): Promise<Instruction[]> {
  const metadata = await findMetadataPda(opts.mint);
  const edition = await findMasterEditionPda(opts.mint);
  const signer = { address: opts.authority, role: AccountRole.WRITABLE_SIGNER };

  const createMetadata: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      { address: metadata, role: AccountRole.WRITABLE },
      { address: opts.mint, role: AccountRole.READONLY },
      signer, // mint authority
      signer, // payer
      { address: opts.authority, role: AccountRole.READONLY_SIGNER }, // update authority
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: concat(
      [33], // CreateMetadataAccountV3
      borshString(clip(opts.name, MAX_NAME)),
      borshString(NFT_SYMBOL.slice(0, MAX_SYMBOL)),
      borshString(clip(opts.uri, MAX_URI)),
      [0, 0], // seller_fee_basis_points: u16 = 0
      [0], // creators: None
      [0], // collection: None
      [0], // uses: None
      [1], // is_mutable: true
      [0], // collection_details: None
    ),
  };

  const createMasterEdition: Instruction = {
    programAddress: TOKEN_METADATA_PROGRAM,
    accounts: [
      { address: edition, role: AccountRole.WRITABLE },
      { address: opts.mint, role: AccountRole.WRITABLE },
      { address: opts.authority, role: AccountRole.READONLY_SIGNER }, // update authority
      { address: opts.authority, role: AccountRole.READONLY_SIGNER }, // mint authority
      signer, // payer
      { address: metadata, role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: concat([17], [1], new Uint8Array(8)), // CreateMasterEditionV3, max_supply: Some(0)
  };

  return [createMetadata, createMasterEdition];
}

/** Where a twin's metadata JSON is served from — the public URL of app/api/nft/[mint]. */
export function nftMetadataUri(mintAddress: string): string {
  // Never localhost: a twin minted from a dev machine lives in the same shared
  // database and is shown by wallets everywhere, so it points at the live site.
  const host = process.env.MAIN_HOST ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "cardmarts.vercel.app";
  return `https://${host}/api/nft/${mintAddress}`;
}
