import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../features/splash/splash_page.dart';

class DeliveryApp extends StatelessWidget {
  const DeliveryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velox Track - Real-Time Delivery',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const SplashPage(),
    );
  }
}
