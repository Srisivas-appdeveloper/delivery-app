import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:delivery_app/app/app.dart';
import 'package:delivery_app/models/store.dart';
import 'package:delivery_app/services/delivery_providers.dart';

void main() {
  testWidgets('App renders splash page and navigates to home screen', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          nearbyStoresProvider.overrideWith((ref) async => [
                const Store(
                  id: 'STORE_TEST',
                  name: 'Artisan Bakery',
                  category: 'Bakery',
                  emoji: '🥐',
                  lat: 12.7409,
                  lng: 77.8253,
                  rating: 4.8,
                  deliveryTime: '15 min',
                  distanceMeters: 450,
                  items: [],
                ),
              ]),
        ],
        child: const DeliveryApp(),
      ),
    );
    expect(find.text('VELOX TRACK'), findsOneWidget);

    // Fast-forward splash animation & navigation
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('DELIVERING TO'), findsOneWidget);
    expect(find.text('Artisan Bakery'), findsOneWidget);
  });
}
