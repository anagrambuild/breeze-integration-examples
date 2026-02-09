import 'dart:convert';

import 'package:breeze_demo/config.dart';
import 'package:breeze_demo/services/breeze_api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final config = AppConfig(
    breezeApiKey: 'test-key',
    strategyId: 'strategy-123',
    solanaRpcUri: Uri(scheme: 'https', host: 'rpc.example.com'),
    breezeBaseUri: Uri(scheme: 'https', host: 'api.breeze.baby'),
  );

  test('getStrategyInfo decodes payload', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient((request) async {
        expect(request.url.path, '/strategy-info/strategy-123');
        expect(request.url.queryParameters, isEmpty);
        expect(request.headers['x-api-key'], 'test-key');
        return http.Response(
          json.encode({
            'strategy_id': 'strategy-123',
            'strategy_name': 'Yield Strategy',
            'assets': ['USDC'],
            'apy': 0.12,
            'apy_per_asset': {'USDC': 0.12},
          }),
          200,
        );
      }),
    );

    final strategy = await service.getStrategyInfo();
    expect(strategy.id, 'strategy-123');
    expect(strategy.strategyName, 'Yield Strategy');
    expect(strategy.assets, ['USDC']);
    expect(strategy.apyPerAsset['USDC'], 0.12);
  });

  test('getBalances sends strategy query parameter', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient((request) async {
        expect(request.url.path, '/breeze-balances/wallet123');
        expect(request.url.queryParameters['strategy_id'], 'strategy-123');
        expect(request.headers['x-api-key'], 'test-key');
        return http.Response(
          json.encode({
            'data': [
              {
                'token_address': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'token_symbol': 'USDC',
                'decimals': 6,
                'total_position_value': 100000,
                'total_deposited_value': 100000,
                'yield_earned': 0,
              },
            ],
          }),
          200,
        );
      }),
    );

    final balances = await service.getBalances('wallet123');
    expect(balances.positions, hasLength(1));
    expect(balances.positions.first.symbol, 'USDC');
    expect(balances.positions.first.total, BigInt.from(100000));
  });

  test(
    'getDepositTx throws invalidResponse when transaction is missing',
    () async {
      final service = BreezeApiService(
        config: config,
        client: MockClient((_) async => http.Response(json.encode({}), 200)),
      );

      expect(
        () => service.getDepositTx(
          userKey: 'wallet123',
          baseAsset: 'mint1',
          amount: BigInt.from(100),
        ),
        throwsA(
          isA<BreezeApiException>().having(
            (e) => e.type,
            'type',
            BreezeApiErrorType.invalidResponse,
          ),
        ),
      );
    },
  );

  test('getWithdrawTx sends x-api-key header on POST', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/withdraw/tx');
        expect(request.headers['x-api-key'], 'test-key');
        final body = json.decode(request.body) as Map<String, dynamic>;
        final params = body['params'] as Map<String, dynamic>;
        expect(params['amount'], 100);
        return http.Response(json.encode({'transaction': 'abc123'}), 200);
      }),
    );

    final transaction = await service.getWithdrawTx(
      userKey: 'wallet123',
      baseAsset: 'mint1',
      amount: BigInt.from(100),
    );

    expect(transaction, 'abc123');
  });

  test('getDepositTx sends numeric amount in request body', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient((request) async {
        final body = json.decode(request.body) as Map<String, dynamic>;
        final params = body['params'] as Map<String, dynamic>;
        expect(params['amount'], 1000000);
        return http.Response(json.encode({'transaction': 'abc123'}), 200);
      }),
    );

    final transaction = await service.getDepositTx(
      userKey: 'wallet123',
      baseAsset: 'mint1',
      amount: BigInt.from(1000000),
    );

    expect(transaction, 'abc123');
  });

  test('getDepositTx accepts JSON string payload', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient(
        (_) async => http.Response(json.encode('abc123'), 200),
      ),
    );

    final transaction = await service.getDepositTx(
      userKey: 'wallet123',
      baseAsset: 'mint1',
      amount: BigInt.from(1000),
    );

    expect(transaction, 'abc123');
  });

  test('getDepositTx accepts wrapped data payload', () async {
    final service = BreezeApiService(
      config: config,
      client: MockClient(
        (_) async => http.Response(json.encode({'data': 'abc123'}), 200),
      ),
    );

    final transaction = await service.getDepositTx(
      userKey: 'wallet123',
      baseAsset: 'mint1',
      amount: BigInt.from(1000),
    );

    expect(transaction, 'abc123');
  });
}
