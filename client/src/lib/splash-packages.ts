/**
 * Enum representing the different splash package options
 * These must match the server-side enum values in lemon-squeezy-service.ts
 */
export enum SplashPackage {
  SINGLE = 'single',    // $7 - 1 splash
  TRIPLE = 'triple',    // $18 - 3 splashes (save 14%)
  SEVEN = 'seven'       // $35 - 7 splashes (save 29%)
}