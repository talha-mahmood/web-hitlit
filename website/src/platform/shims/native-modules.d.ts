// Native-only packages that the app's *original* (overridden on web) files
// import. The website never runs those files — vite.config.ts swaps in
// src/platform/overrides/* — but tsc still follows the app's relative import
// graph into some of them, so they need to type-check.
declare module "@react-native-community/netinfo" {
  type NetInfoState = { isConnected: boolean | null; isInternetReachable: boolean | null };
  const NetInfo: {
    addEventListener(listener: (state: NetInfoState) => void): () => void;
    fetch(): Promise<NetInfoState>;
  };
  export default NetInfo;
}

declare module "expo-apple-authentication" {
  export type AppleAuthenticationCredential = {
    identityToken: string | null;
    fullName: { givenName: string | null; familyName: string | null } | null;
  };
  export const AppleAuthenticationScope: { FULL_NAME: number; EMAIL: number };
  export function signInAsync(options: unknown): Promise<AppleAuthenticationCredential>;
}

declare module "expo-image-picker";
declare module "expo-sharing";
declare module "expo-file-system";
declare module "expo-print";
declare module "expo-location";
declare module "expo-notifications";
declare module "expo-constants";
declare module "expo-linear-gradient";
declare module "expo-clipboard";
declare module "expo-audio";
declare module "@react-native-google-signin/google-signin";
declare module "react-native-reanimated";
declare module "react-native-url-polyfill/auto";
declare module "nativewind";
