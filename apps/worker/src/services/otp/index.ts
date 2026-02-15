// OTP Module — Barrel Export
// This is the public API of the OTP module.
// Agent module must NEVER import from this module.

export { requestOtp, verifyOtp } from "./otp-service.js";
export { startOtpCleanupJob, stopOtpCleanupJob } from "./cleanup.js";
export { extractOtpCode, normalizePhoneToE164, validatePhone } from "./crypto.js";
export { getInternalApiKey } from "./config.js";
export type {
  OtpRequestParams,
  OtpRequestResult,
  OtpVerifyParams,
  OtpVerifyResult,
} from "./types.js";
