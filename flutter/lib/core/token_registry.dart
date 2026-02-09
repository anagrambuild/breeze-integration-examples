class TokenMetadata {
  final String symbol;
  final String mint;
  final int decimals;

  const TokenMetadata({
    required this.symbol,
    required this.mint,
    required this.decimals,
  });
}

// Recommended to fetch these from /strategy-info once and cache locally.
class TokenRegistry {
  static const List<TokenMetadata> availableAssets = [
    TokenMetadata(
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    ),
    TokenMetadata(
      symbol: 'USDT',
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
    ),
    TokenMetadata(
      symbol: 'USDS',
      mint: 'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA',
      decimals: 6,
    ),
    TokenMetadata(
      symbol: 'JupSOL',
      mint: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
      decimals: 9,
    ),
    TokenMetadata(
      symbol: 'JLP',
      mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
      decimals: 6,
    ),
    TokenMetadata(
      symbol: 'mSOL',
      mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      decimals: 9,
    ),
    TokenMetadata(
      symbol: 'JitoSOL',
      mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      decimals: 9,
    ),
    TokenMetadata(
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
    ),
  ];

  static const Map<String, TokenMetadata> _byMint = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': TokenMetadata(
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    ),
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': TokenMetadata(
      symbol: 'USDT',
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
    ),
    'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA': TokenMetadata(
      symbol: 'USDS',
      mint: 'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA',
      decimals: 6,
    ),
    'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': TokenMetadata(
      symbol: 'JupSOL',
      mint: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
      decimals: 9,
    ),
    '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': TokenMetadata(
      symbol: 'JLP',
      mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
      decimals: 6,
    ),
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': TokenMetadata(
      symbol: 'mSOL',
      mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      decimals: 9,
    ),
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': TokenMetadata(
      symbol: 'JitoSOL',
      mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      decimals: 9,
    ),
    'So11111111111111111111111111111111111111112': TokenMetadata(
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
    ),
  };

  static TokenMetadata? byMint(String mint) {
    final normalizedMint = mint.trim();
    if (normalizedMint.isEmpty) {
      return null;
    }
    return _byMint[normalizedMint];
  }
}
