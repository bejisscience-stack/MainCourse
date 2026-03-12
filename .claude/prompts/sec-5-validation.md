Add Zod validation AND sanitize error responses in 4 specific API routes. Install zod first.

Do NOT touch any files except these 4 routes and new files you create:
- app/api/payments/keepz/create-order/route.ts
- app/api/enrollment-requests/route.ts
- app/api/bundle-enrollment-requests/route.ts
- app/api/complete-profile/route.ts

Step 1: npm install zod

Step 2: Create lib/schemas/index.ts with Zod schemas:
- paymentOrderSchema: amount (positive number), courseId or bundleId (uuid), paymentType (enum), referralCode (optional, alphanumeric)
- enrollmentRequestSchema: courseId (uuid string), referralCode (optional)
- bundleEnrollmentRequestSchema: bundleId (uuid string), referralCode (optional)
- completeProfileSchema: username (string, trim, 3-30 chars, alphanumeric + underscore only)

Step 3: In each of the 4 routes above:
- Import the relevant schema
- Parse request body with schema.safeParse() at the top of the handler
- If validation fails: return 400 with { error: "Invalid request data" } (do NOT return zod error details)
- If validation passes: use parsed data instead of raw body

Step 4: In the same 4 files, also fix error.message and error.stack leaks:
- In enrollment-requests/route.ts line 338: remove error.stack from response
- In bundle-enrollment-requests/route.ts line 222: remove error.stack from response
- In all 4 files: replace any error.message returns with generic "An error occurred"
- console.error the real error before returning

Run npm run build after all changes. Commit with message "security: add Zod validation, sanitize errors (VAL-01, API-03)"

Output <promise>DONE</promise> when build passes.
