/**
 * Shared Zod coordinate schemas for MCP tool input validation.
 *
 * z.number() already rejects NaN (Zod coerces the raw input and NaN fails
 * the number check). .finite() additionally rejects Infinity/-Infinity.
 * Both checks are independent; .finite() does NOT cover NaN.
 */

import { z } from "zod";

export const latSchema = z.number().min(-90).max(90);
export const lonSchema = z.number().min(-180).max(180);
// altitude must be a positive finite number
export const altSchema = z.number().gt(0).finite();
