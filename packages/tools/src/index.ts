/**
 * @musait/tools â€” Shared tool execution layer
 *
 * All Supabase-dependent tool functions are exported from here.
 * Both Worker and Test Lab import these; each passes its own SupabaseConfig.
 *
 * Tools that require Convex (end-session, take-notes, bind-tenant,
 * list-businesses, update-customer-name, ask-human) stay in apps/worker/
 * since they are platform-specific to the WhatsApp agent runtime.
 */
export type { SupabaseConfig, TenantCustomer } from "./customers";
export {
    getCustomerByPhone,
    createCustomer,
    updateCustomerNameInDb,
    ensureCustomerRecord,
} from "./customers";

export { validateToolArgs, CREATE_APPOINTMENT_FIELDS, VIEW_SLOTS_FIELDS, BIND_TENANT_FIELDS } from "./validate";
export { listServices, listStaff, getBusinessInfo, invalidateBusinessCache } from "./list-business-data";
export { viewAvailableSlots } from "./view-slots";
export { checkSpecificSlot } from "./check-specific-slot";
export { cancelAppointment } from "./cancel-appointment";
export { createAppointment } from "./create-appointment";
export { createAppointmentsBatch } from "./create-appointments-batch";
export { listCustomerAppointments } from "./list-customer-appointments";
export { suggestLeastBusyStaff } from "./suggest-staff";
export { composeInteractiveMessage } from "./compose-interactive-message";
