import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:solana/solana.dart';

const _privateKeyKey = 'breeze_demo_private_key';

class WalletService {
  final FlutterSecureStorage _storage;
  Ed25519HDKeyPair? _keypair;

  WalletService({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
          );

  Ed25519HDKeyPair? get keypair => _keypair;

  String? get publicKeyBase58 => _keypair?.address;

  bool get hasWallet => _keypair != null;

  /// Try to load an existing keypair from secure storage.
  Future<bool> tryLoadExisting() async {
    final hexKey = await _storage.read(key: _privateKeyKey);
    if (hexKey == null) {
      return false;
    }

    try {
      final bytes = _hexDecode(hexKey);
      _keypair = await Ed25519HDKeyPair.fromPrivateKeyBytes(privateKey: bytes);
      return true;
    } on FormatException {
      await _storage.delete(key: _privateKeyKey);
      _keypair = null;
      return false;
    }
  }

  /// Generate a new random keypair and persist it.
  Future<void> createWallet() async {
    _keypair = await Ed25519HDKeyPair.random();
    await _persistKey();
  }

  /// Sign arbitrary bytes with the current keypair.
  Future<Signature> sign(List<int> messageBytes) async {
    if (_keypair == null) throw StateError('No wallet loaded');
    return _keypair!.sign(messageBytes);
  }

  /// Export the wallet seed in hex format so the user can back it up.
  Future<String> exportSecretKeyHex() async {
    if (_keypair == null) {
      throw StateError('No wallet loaded');
    }

    final privateKey = await _keypair!.extract();
    final seedBytes = privateKey.bytes.sublist(0, 32);
    return _hexEncode(seedBytes);
  }

  /// Delete the stored key and clear in-memory state.
  Future<void> deleteWallet() async {
    await _storage.delete(key: _privateKeyKey);
    _keypair = null;
  }

  Future<void> _persistKey() async {
    if (_keypair == null) return;
    // Extract the raw 32-byte seed from the keypair.
    final privateKey = await _keypair!.extract();
    final seedBytes = privateKey.bytes.sublist(0, 32);
    await _storage.write(key: _privateKeyKey, value: _hexEncode(seedBytes));
  }

  static String _hexEncode(List<int> bytes) =>
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

  static List<int> _hexDecode(String hex) {
    if (hex.length.isOdd) {
      throw const FormatException('Stored private key is malformed.');
    }

    final result = <int>[];
    for (var i = 0; i < hex.length; i += 2) {
      result.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return result;
  }
}
