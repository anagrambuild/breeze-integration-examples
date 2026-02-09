class TxResult {
  final bool success;
  final String? signature;
  final String? error;

  TxResult({required this.success, this.signature, this.error});

  factory TxResult.ok(String signature) =>
      TxResult(success: true, signature: signature);

  factory TxResult.fail(String error) => TxResult(success: false, error: error);
}
