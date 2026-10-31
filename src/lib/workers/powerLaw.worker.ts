import { handlePowerLawRequest, type PowerLawRequest } from "./powerLawProtocol";

// Minimal typing for a dedicated worker scope; the project's TS lib is the DOM one.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<PowerLawRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (e) => scope.postMessage(handlePowerLawRequest(e.data));
