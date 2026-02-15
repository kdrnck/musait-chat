/**
 * Convex API references for HTTP client usage.
 *
 * ConvexHttpClient accepts string-based function references in "module:function" format.
 * This file provides a typed wrapper so we get autocomplete without depending on
 * Convex codegen output (which uses `anyApi` Proxy — incompatible with some bundlers).
 *
 * IMPORTANT: When you add a new Convex function, add a reference here too.
 */

// ConvexHttpClient.query/mutation accept string | FunctionReference.
// Strings in "module:functionName" format work at runtime.
type Ref = any;

function ref(path: string): Ref {
  return path;
}

export const api = {
  conversations: {
    getActiveByPhone: ref("conversations:getActiveByPhone"),
    getById: ref("conversations:getById"),
    listByTenant: ref("conversations:listByTenant"),
    listHandoffs: ref("conversations:listHandoffs"),
    create: ref("conversations:create"),
    bindToTenant: ref("conversations:bindToTenant"),
    updateStatus: ref("conversations:updateStatus"),
    updateSummary: ref("conversations:updateSummary"),
    disableAgent: ref("conversations:disableAgent"),
    enableAgent: ref("conversations:enableAgent"),
    archiveAndReset: ref("conversations:archiveAndReset"),
    touchLastMessage: ref("conversations:touchLastMessage"),
  },
  messages: {
    listByConversation: ref("messages:listByConversation"),
    getContextWindow: ref("messages:getContextWindow"),
    getPendingMessages: ref("messages:getPendingMessages"),
    create: ref("messages:create"),
    updateStatus: ref("messages:updateStatus"),
    markRetry: ref("messages:markRetry"),
  },
  customerProfiles: {
    getByPhone: ref("customerProfiles:getByPhone"),
    listByTenant: ref("customerProfiles:listByTenant"),
    upsert: ref("customerProfiles:upsert"),
    appendNotes: ref("customerProfiles:appendNotes"),
  },
  whatsappNumbers: {
    getByPhoneNumberId: ref("whatsappNumbers:getByPhoneNumberId"),
    getByTenant: ref("whatsappNumbers:getByTenant"),
    getMasterNumber: ref("whatsappNumbers:getMasterNumber"),
    listAll: ref("whatsappNumbers:listAll"),
    register: ref("whatsappNumbers:register"),
    deactivate: ref("whatsappNumbers:deactivate"),
  },
  tenantCodes: {
    getByCode: ref("tenantCodes:getByCode"),
    listActive: ref("tenantCodes:listActive"),
    buildSelectionMessage: ref("tenantCodes:buildSelectionMessage"),
    upsert: ref("tenantCodes:upsert"),
  },
  magicLinks: {
    validate: ref("magicLinks:validate"),
    create: ref("magicLinks:create"),
    markUsed: ref("magicLinks:markUsed"),
  },
} as const;
