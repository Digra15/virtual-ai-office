"use strict";
/**
 * Shared domain types for the Virtual AI Office.
 *
 * This module is the single source of truth for the wire contract between
 * the backend (`apps/server`) and the frontend (`apps/web`). Both consume
 * these types verbatim — do not drift from them without updating both sides.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_STATUSES = void 0;
/** Every lifecycle state an agent can be in. */
exports.AGENT_STATUSES = ['idle', 'working', 'thinking', 'waiting', 'error', 'offline'];
//# sourceMappingURL=types.js.map