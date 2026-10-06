import { create } from "zustand";
import NetInfo from "@react-native-community/netinfo";

type NetworkState = {
  // Starts true (optimistic) so nothing flashes an "offline" state before
  // the first NetInfo event arrives a moment after launch.
  isOnline: boolean;
  // A NetInfo event already in flight when the listener below is set up
  // (RootNavigator mounts once) still needs somewhere to land — set directly
  // by that one subscription rather than every screen re-subscribing.
  setOnline: (online: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  setOnline: (online) => set({ isOnline: online }),
}));

// A connection that's "connected" but not actually reaching the internet
// (e.g. a wifi captive portal, or a cell tower with no backhaul) should
// still count as offline for scoring purposes — isInternetReachable is
// null while NetInfo is still figuring that out, which is treated as
// online rather than flashing "offline" on every reconnect.
function resolveOnline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

let unsubscribe: (() => void) | null = null;

// Called once from RootNavigator. Re-entrant (a hot reload or a second
// mount is a no-op) so nothing else needs to track whether it's already run.
export function initNetworkListener() {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener((state) => {
    useNetworkStore.getState().setOnline(resolveOnline(state));
  });
  NetInfo.fetch().then((state) => {
    useNetworkStore.getState().setOnline(resolveOnline(state));
  });
}
