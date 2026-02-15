/* eslint-disable */
/**
 * Generated `api` utility for HTTP client usage.
 *
 * THIS CODE IS MANUALLY CREATED FOR HTTP CLIENT COMPATIBILITY.
 *
 * @module
 */

// Helper to create function references
function makeFunctionReference(path) {
  return path;
}

export const api = {
  conversations: {
    getActiveByPhone: makeFunctionReference("conversations:getActiveByPhone"),
    getById: makeFunctionReference("conversations:getById"),
    listByTenant: makeFunctionReference("conversations:listByTenant"),
    listHandoffs: makeFunctionReference("conversations:listHandoffs"),
    create: makeFunctionReference("conversations:create"),
    bindToTenant: makeFunctionReference("conversations:bindToTenant"),
    updateStatus: makeFunctionReference("conversations:updateStatus"),
    updateSummary: makeFunctionReference("conversations:updateSummary"),
    disableAgent: makeFunctionReference("conversations:disableAgent"),
    enableAgent: makeFunctionReference("conversations:enableAgent"),
    archiveAndReset: makeFunctionReference("conversations:archiveAndReset"),
    touchLastMessage: makeFunctionReference("conversations:touchLastMessage"),
  },
  messages: {
    listByConversation: makeFunctionReference("messages:listByConversation"),
    getContextWindow: makeFunctionReference("messages:getContextWindow"),
    getPendingMessages: makeFunctionReference("messages:getPendingMessages"),
    create: makeFunctionReference("messages:create"),
    updateStatus: makeFunctionReference("messages:updateStatus"),
    markRetry: makeFunctionReference("messages:markRetry"),
  },
  customerProfiles: {
    getByPhone: makeFunctionReference("customerProfiles:getByPhone"),
    listByTenant: makeFunctionReference("customerProfiles:listByTenant"),
    upsert: makeFunctionReference("customerProfiles:upsert"),
    appendNotes: makeFunctionReference("customerProfiles:appendNotes"),
  },
  whatsappNumbers: {
    getByPhoneNumberId: makeFunctionReference("whatsappNumbers:getByPhoneNumberId"),
    getByTenant: makeFunctionReference("whatsappNumbers:getByTenant"),
    getMasterNumber: makeFunctionReference("whatsappNumbers:getMasterNumber"),
    listAll: makeFunctionReference("whatsappNumbers:listAll"),
    register: makeFunctionReference("whatsappNumbers:register"),
    deactivate: makeFunctionReference("whatsappNumbers:deactivate"),
  },
  tenantCodes: {
    getByCode: makeFunctionReference("tenantCodes:getByCode"),
    listActive: makeFunctionReference("tenantCodes:listActive"),
    buildSelectionMessage: makeFunctionReference("tenantCodes:buildSelectionMessage"),
    upsert: makeFunctionReference("tenantCodes:upsert"),
  },
  magicLinks: {
    validate: makeFunctionReference("magicLinks:validate"),
    create: makeFunctionReference("magicLinks:create"),
    markUsed: makeFunctionReference("magicLinks:markUsed"),
  },
};

export const internal = {};
