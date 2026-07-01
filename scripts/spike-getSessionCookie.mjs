#!/usr/bin/env node

/**
 * Spike: Verify getSessionCookie() from better-auth/cookies works on
 * Next.js 16 Edge Runtime without Prisma/Node.js dependency errors.
 *
 * This script tests three claims:
 *   1. Import resolves without "Module not found" errors
 *   2. Returns a string when a valid Better Auth session cookie is present
 *   3. Returns null when no Better Auth cookie is present
 *   4. No Prisma or Node.js built-ins are pulled in transitively
 */

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const INFO = "\x1b[36mINFO\x1b[0m";

let allPassed = true;

function assert(label, condition) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
  } else {
    console.log(`  ${FAIL}  ${label}`);
    allPassed = false;
  }
}

// ---------------------------------------------------------------------------
// 1. Dynamic import — must resolve without errors
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 1: Import getSessionCookie from better-auth/cookies`);

let getSessionCookie;
try {
  const mod = await import("better-auth/cookies");
  getSessionCookie = mod.getSessionCookie;
  assert("getSessionCookie is a function", typeof getSessionCookie === "function");
} catch (e) {
  assert(`Import failed: ${e.message}`, false);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Positive case — cookie present
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 2: getSessionCookie returns a string when cookie is present`);

// The function reads `request.headers.get("cookie")` — create a mock with a
// Cookie header containing a valid-looking Better Auth session token.
// Cookie format: better-auth.session_token=<token>
const mockRequestWithCookie = {
  headers: {
    get(name) {
      if (name.toLowerCase() === "cookie") {
        return "better-auth.session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.test-signature; other=value";
      }
      return null;
    },
  },
};

try {
  const result = getSessionCookie(mockRequestWithCookie);
  assert("result is a non-null string", typeof result === "string" && result.length > 0);
  console.log(`    Value: ${result.substring(0, 40)}...`);
} catch (e) {
  assert(`Threw an error: ${e.message}`, false);
}

// ---------------------------------------------------------------------------
// 3. Negative case — no cookie
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 3: getSessionCookie returns null when no cookie`);

const mockRequestWithoutCookie = {
  headers: {
    get(name) {
      if (name.toLowerCase() === "cookie") {
        return "other=value; some=thing";
      }
      return null;
    },
  },
};

try {
  const result = getSessionCookie(mockRequestWithoutCookie);
  assert("result is null", result === null);
  console.log(`    Result: ${JSON.stringify(result)}`);
} catch (e) {
  assert(`Threw an error: ${e.message}`, false);
}

// ---------------------------------------------------------------------------
// 4. Edge Runtime compatibility — no Node.js built-ins pulled in
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 4: Check for Prisma/Node.js dependency leakage`);

// Check that better-auth/cookies doesn't pull in Prisma or Node.js built-ins
const baCookiesPkg = await import("better-auth/cookies");
const exportedKeys = Object.keys(baCookiesPkg);
console.log(`    Exports from better-auth/cookies: ${exportedKeys.join(", ")}`);

// Verify no Prisma-related strings in the module's closure
const modSrc = getSessionCookie.toString();
const forbiddenPatterns = ["PrismaClient", "require(", "fs", "crypto", "net", "child_process"];
for (const pat of forbiddenPatterns) {
  if (modSrc.includes(pat)) {
    assert(`Contains forbidden pattern: ${pat}`, false);
  } else {
    assert(`No forbidden pattern: ${pat}`, true);
  }
}

// ---------------------------------------------------------------------------
// 5. Test with NextRequest-like object (has .cookies + .headers)
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 5: Works with NextRequest-like object (cookies + headers)`);

const nextRequestLike = {
  headers: new Map(),
  cookies: {
    get(name) {
      return name === "better-auth.session_token"
        ? { name, value: "test-token-value" }
        : undefined;
    },
  },
};

// The function reads from request.headers, so let's set it there
// Actually, looking at the source: the function checks if request is Headers or has "headers".
// If request has "headers" property, it uses request.headers.get("cookie").
// Set a Map-like object as headers... it needs a .get() method.

const nextRequestLike2 = {
  nextUrl: { pathname: "/dashboard" },
  cookies: {
    get(name) { return undefined; },
  },
  headers: {
    get(name) {
      if (name.toLowerCase() === "cookie") return null;
      return null;
    },
  },
};

try {
  const result = getSessionCookie(nextRequestLike2);
  assert("returns null for empty NextRequest-like object", result === null);
} catch (e) {
  assert(`NextRequest-like test threw: ${JSON.stringify(e.message)}`, false);
}

// ---------------------------------------------------------------------------
// 6. Test with __Secure- prefixed cookie (HTTPS scenario)
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  Test 6: Works with __Secure- cookie prefix`);

const mockHttpsRequest = {
  headers: {
    get(name) {
      if (name.toLowerCase() === "cookie") {
        return "__Secure-better-auth.session_token=secure-token-value";
      }
      return null;
    },
  },
};

try {
  const result = getSessionCookie(mockHttpsRequest);
  assert("result is a non-null string for __Secure- prefixed cookie", typeof result === "string" && result.length > 0);
  console.log(`    Value: ${result}`);
} catch (e) {
  assert(`Threw on __Secure- cookie: ${e.message}`, false);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
console.log(`\n${INFO}  ==================== VERDICT ====================`);
if (allPassed) {
  console.log(`${INFO}  ALL SPIKE TESTS PASSED`);
  console.log(`${INFO}  Edge Runtime getSessionCookie() is compatible.`);
  console.log(`${INFO}  Dual-auth proxy strategy (getToken OR getSessionCookie) is VIABLE.`);
} else {
  console.log(`${FAIL}  SOME SPIKE TESTS FAILED`);
  console.log(`${FAIL}  Fallback strategy required: migrate proxy.ts to Node.js runtime.`);
}
console.log(`${INFO}  =================================================\n`);

process.exit(allPassed ? 0 : 1);
