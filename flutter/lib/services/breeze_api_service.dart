import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/breeze_balance.dart';
import '../models/strategy_info.dart';

enum BreezeApiErrorType { http, timeout, invalidResponse, network }

class BreezeApiException implements Exception {
  final BreezeApiErrorType type;
  final String message;
  final int? statusCode;

  const BreezeApiException({
    required this.type,
    required this.message,
    this.statusCode,
  });

  @override
  String toString() {
    if (statusCode == null) {
      return 'BreezeApiException($type): $message';
    }
    return 'BreezeApiException($type, $statusCode): $message';
  }
}

class BreezeApiService {
  static final BigInt _maxU64 = BigInt.parse('18446744073709551615');

  final http.Client _client;
  final AppConfig _config;

  BreezeApiService({required AppConfig config, http.Client? client})
    : _config = config,
      _client = client ?? http.Client();

  Map<String, String> get _headers => {
    'x-api-key': _config.breezeApiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  Future<StrategyInfo> getStrategyInfo() async {
    final uri = _buildUri('/strategy-info/${_config.strategyId}');
    final response = await _safeGet(uri);
    final jsonMap = _decodeJsonMap(response.body);
    return StrategyInfo.fromJson(jsonMap);
  }

  Future<BreezeBalance> getBalances(String userPubkey) async {
    final uri = _buildUri(
      '/breeze-balances/$userPubkey',
      queryParams: {'strategy_id': _config.strategyId},
    );
    final response = await _safeGet(uri);
    final jsonMap = _decodeJsonMap(response.body);
    return BreezeBalance.fromJson(jsonMap);
  }

  Future<String> getDepositTx({
    required String userKey,
    required String baseAsset,
    required BigInt amount,
  }) async {
    final uri = _buildUri('/deposit/tx');
    final response = await _safePost(
      uri,
      body: {
        'params': {
          'strategy_id': _config.strategyId,
          'base_asset': baseAsset,
          'amount': _encodeU64Amount(amount),
          'user_key': userKey,
          'payer_key': userKey,
        },
      },
    );

    return _decodeTransactionBase64(response.body, endpointName: '/deposit/tx');
  }

  Future<String> getWithdrawTx({
    required String userKey,
    required String baseAsset,
    BigInt? amount,
    bool all = false,
  }) async {
    final uri = _buildUri('/withdraw/tx');

    final params = <String, dynamic>{
      'strategy_id': _config.strategyId,
      'base_asset': baseAsset,
      'user_key': userKey,
      'payer_key': userKey,
    };

    if (all) {
      params['all'] = true;
    } else if (amount != null) {
      params['amount'] = _encodeU64Amount(amount);
    }

    final response = await _safePost(uri, body: {'params': params});

    return _decodeTransactionBase64(
      response.body,
      endpointName: '/withdraw/tx',
    );
  }

  void dispose() {
    _client.close();
  }

  Uri _buildUri(String path, {Map<String, String>? queryParams}) {
    final normalizedBasePath = _config.breezeBaseUri.path.endsWith('/')
        ? _config.breezeBaseUri.path.substring(
            0,
            _config.breezeBaseUri.path.length - 1,
          )
        : _config.breezeBaseUri.path;
    final normalizedPath = path.startsWith('/') ? path : '/$path';

    return _config.breezeBaseUri.replace(
      path: '$normalizedBasePath$normalizedPath',
      queryParameters: queryParams,
    );
  }

  Future<http.Response> _safeGet(Uri uri) async {
    try {
      final response = await _client
          .get(uri, headers: _headers)
          .timeout(_config.networkTimeout);
      _checkResponse(response);
      return response;
    } on TimeoutException {
      throw BreezeApiException(
        type: BreezeApiErrorType.timeout,
        message: 'GET request timed out: $uri',
      );
    } on http.ClientException catch (error) {
      throw BreezeApiException(
        type: BreezeApiErrorType.network,
        message: error.message,
      );
    }
  }

  Future<http.Response> _safePost(
    Uri uri, {
    required Map<String, dynamic> body,
  }) async {
    try {
      final response = await _client
          .post(uri, headers: _headers, body: json.encode(body))
          .timeout(_config.networkTimeout);
      _checkResponse(response);
      return response;
    } on TimeoutException {
      throw BreezeApiException(
        type: BreezeApiErrorType.timeout,
        message: 'POST request timed out: $uri',
      );
    } on http.ClientException catch (error) {
      throw BreezeApiException(
        type: BreezeApiErrorType.network,
        message: error.message,
      );
    }
  }

  void _checkResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    throw BreezeApiException(
      type: BreezeApiErrorType.http,
      statusCode: response.statusCode,
      message: _extractHttpErrorMessage(response.body),
    );
  }

  int _encodeU64Amount(BigInt amount) {
    if (amount < BigInt.zero || amount > _maxU64) {
      throw BreezeApiException(
        type: BreezeApiErrorType.invalidResponse,
        message:
            'Amount must be a valid u64 (0 to ${_maxU64.toString()}) and was ${amount.toString()}.',
      );
    }
    return int.parse(amount.toString());
  }

  String _decodeTransactionBase64(String body, {required String endpointName}) {
    final trimmedBody = body.trim();
    if (trimmedBody.isEmpty) {
      throw BreezeApiException(
        type: BreezeApiErrorType.invalidResponse,
        message: 'Breeze $endpointName response was empty.',
      );
    }

    dynamic decoded;
    try {
      decoded = json.decode(trimmedBody);
    } on FormatException {
      // Some deployments may return plain text base64.
      return trimmedBody;
    }

    if (decoded is String && decoded.trim().isNotEmpty) {
      return decoded.trim();
    }

    if (decoded is Map) {
      final base64 = _extractBase64FromPayload(decoded);
      if (base64 != null) {
        return base64;
      }
    }

    throw BreezeApiException(
      type: BreezeApiErrorType.invalidResponse,
      message:
          'Unexpected $endpointName payload shape from Breeze API. Expected base64 string, {data: string}, or {transaction: string}.',
    );
  }

  String? _extractBase64FromPayload(Map payload) {
    final directData = payload['data'];
    if (directData is String && directData.trim().isNotEmpty) {
      return directData.trim();
    }

    final directTransaction = payload['transaction'];
    if (directTransaction is String && directTransaction.trim().isNotEmpty) {
      return directTransaction.trim();
    }

    if (directData is Map) {
      final nestedTransaction = directData['transaction'];
      if (nestedTransaction is String && nestedTransaction.trim().isNotEmpty) {
        return nestedTransaction.trim();
      }
    }

    return null;
  }

  Map<String, dynamic> _decodeJsonMap(String body) {
    try {
      final decoded = json.decode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      throw const BreezeApiException(
        type: BreezeApiErrorType.invalidResponse,
        message: 'Unexpected JSON payload shape from Breeze API.',
      );
    } on FormatException {
      throw const BreezeApiException(
        type: BreezeApiErrorType.invalidResponse,
        message: 'Failed to decode Breeze API JSON response.',
      );
    }
  }

  String _extractHttpErrorMessage(String body) {
    try {
      final decoded = json.decode(body);
      if (decoded is Map<String, dynamic>) {
        final message =
            decoded['message'] ?? decoded['detail'] ?? decoded['error'];
        if (message is String && message.trim().isNotEmpty) {
          return message;
        }
      }
    } on FormatException {
      // Keep fallback message.
    }

    return body.trim().isEmpty
        ? 'Request failed with an empty response.'
        : body;
  }
}
