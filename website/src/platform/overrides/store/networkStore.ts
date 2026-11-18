import { create } from "zustand";

type NetworkState = {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  setOnline: (online) => set({ isOnline: online }),
}));

let started = false;

// Web version of the app's NetInfo listener — the browser's online/offline
// events drive the same store, so live scoring's offline queues flush the
// same way when the connection comes back.
export function initNetworkListener() {
  if (started) return;
  started = true;
  const update = () => useNetworkStore.getState().setOnline(navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
