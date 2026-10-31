import type { StateStorage } from "zustand/middleware";
import { userStore } from "./manager";

/** Lets a persisted zustand store keep its state in the active profile's `UserStore`. */
export const userStateStorage: StateStorage = {
  getItem: (name) => userStore.get(name),
  setItem: (name, value) => userStore.set(name, value),
  removeItem: (name) => userStore.remove(name),
};
