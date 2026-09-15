"use strict";
/**
 * @file auth-contracts.ts
 * @description Shared contracts for Decentralized Plugin Authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensitive = void 0;
/**
 * Factory function to safely cast a string to a SensitiveString.
 * This provides a single grep target for every place a secret enters the system.
 */
const sensitive = (s) => s;
exports.sensitive = sensitive;
