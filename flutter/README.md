# breeze_demo

Flutter demo app for Breeze integration.

## Configuration

This app reads runtime configuration from `--dart-define` values.

Required:
- `BREEZE_API_KEY`
- `STRATEGY_ID`

Optional:
- `SOLANA_RPC_URL` (defaults to `https://api.devnet.solana.com`)
- `BREEZE_BASE_URL` (defaults to `https://api.breeze.baby`)

## Local setup

1. Copy `.env.example` to `.env` and fill values.
2. Run with:

```bash
flutter run --dart-define-from-file=.env
```

`.env` is ignored by git and is not bundled as a Flutter asset.
