# Keepz Payment API — Complete Integration Guide

> **Source:** [developers.keepz.me](https://developers.keepz.me)
> **Last updated:** 2026-03-03
> **Scope:** eCommerce payments, Direct Settlements, Subscriptions

---

## Table of Contents

1. [Overview](#1-overview)
2. [Environments](#2-environments)
3. [Authentication](#3-authentication)
4. [Encryption / Cryptography](#4-encryption--cryptography)
5. [eCommerce Integration](#5-ecommerce-integration)
   - [Create an Order](#51-create-an-order)
   - [Callback (Webhook)](#52-callback-webhook)
   - [Get Order Status](#53-get-order-status)
   - [Cancel Order](#54-cancel-order)
   - [Refund](#55-refund)
   - [Get Saved Cards](#56-get-saved-cards)
   - [Order Statuses](#57-order-statuses)
6. [Direct Settlements](#6-direct-settlements)
   - [Get Access Token](#61-get-access-token)
   - [Create Transaction](#62-create-transaction)
   - [Get Balance](#63-get-balance)
   - [Get Transaction Details](#64-get-transaction-details)
   - [Status Codes](#65-status-codes)
7. [Subscriptions (Recurring Payments)](#7-subscriptions-recurring-payments)
   - [Get Subscription History](#71-get-subscription-history)
   - [Revoke Subscription](#72-revoke-subscription)
   - [Subscription Callback](#73-subscription-callback)
8. [Error Codes](#8-error-codes)
   - [eCommerce Errors](#81-ecommerce-errors)
   - [Direct Settlements Errors](#82-direct-settlements-errors)
9. [Payment Flow Diagram](#9-payment-flow-diagram)
10. [Node.js Code Examples](#10-nodejs-code-examples)
11. [Other Language Examples](#11-other-language-examples)
12. [Testing Environment](#12-testing-environment)
13. [Implementation Roadmap for swavleba.ge](#13-implementation-roadmap-for-swavlabege)

---

## 1. Overview

Keepz provides three main API modules:

| Module | Purpose | Auth Method |
|---|---|---|
| **eCommerce Integration** | Payment processing for online businesses | Hybrid encryption (AES + RSA) |
| **Direct Settlements** | Fund distribution to beneficiaries | OAuth 2.0 Bearer Token |
| **Subscriptions** | Recurring payment management | Hybrid encryption (AES + RSA) |

All eCommerce and Subscription communications use **AES-256-CBC + RSA** hybrid encryption. The encryption itself serves as authentication — there are no Bearer tokens for these endpoints.

---

## 2. Environments

| Environment | eCommerce Base URL | Direct Settlements Base URL |
|---|---|---|
| **Test/Dev** | `https://gateway.dev.keepz.me/ecommerce-service` | `https://distributor.dev.keepz.me` |
| **Production** | `https://gateway.keepz.me/ecommerce-service` | `https://distributor.keepz.me` |

---

## 3. Authentication

### eCommerce & Subscriptions

No bearer token required. Authentication is implicit through encryption:
- The `identifier` field in every request identifies the integrator
- The ability to encrypt/decrypt with the correct RSA key pair proves identity

### Direct Settlements

Standard OAuth 2.0 client credentials:

```
POST /api/auth
Content-Type: application/json

{
  "client_id": "<your-client-id>",
  "client_secret": "<your-client-secret>",
  "grant_type": "client_credentials"
}
```

Response:
```json
{
  "value": {
    "access_token": "<JWT>",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

Use as: `Authorization: Bearer <access_token>` — token expires after 1 hour.

---

## 4. Encryption / Cryptography

### Architecture

Keepz uses **hybrid encryption**: AES-256-CBC for the payload, RSA for protecting the AES keys.

### Technical Specifications

| Property | Value |
|---|---|
| AES Algorithm | AES-256-CBC |
| AES Key Size | 256 bits (32 bytes) |
| IV Size | 128 bits (16 bytes) |
| RSA Padding | RSA/ECB/OAEPWithSHA-256AndMGF1Padding |
| Key Format (Node.js) | Base64 DER (SPKI for public, PKCS8 for private) |
| Key Format (Python/C#/Go) | PEM with headers added programmatically |
| Encoding | Base64 for all encrypted bytes |
| Key/IV Separator | `.` (dot) |

### Encrypted Request Structure

Every eCommerce and Subscription request uses this wrapper:

```json
{
  "identifier": "string (integrator ID)",
  "encryptedData": "string (Base64)",
  "encryptedKeys": "string (Base64)",
  "aes": true
}
```

| Parameter | Description |
|---|---|
| `identifier` | Unique integrator ID provided by Keepz during onboarding |
| `encryptedData` | AES-encrypted JSON payload, Base64-encoded |
| `encryptedKeys` | RSA-encrypted AES key+IV concatenation, Base64-encoded |
| `aes` | Boolean flag, always `true` (backward compatibility) |

### Encryption Process (Client → Keepz)

**Step 1 — Encrypt the payload:**
1. Generate random 32-byte AES key
2. Generate random 16-byte IV
3. Encrypt JSON payload with AES-256-CBC
4. Base64-encode the ciphertext → `encryptedData`

**Step 2 — Encrypt the key material:**
1. Base64-encode the AES key
2. Base64-encode the IV
3. Concatenate with dot separator: `Base64(key).Base64(iv)`
4. Encrypt the concatenated string with **Keepz's RSA public key** (OAEP SHA-256)
5. Base64-encode the RSA output → `encryptedKeys`

**Step 3:** Set `aes: true`

### Decryption Process (Keepz → Client)

Used for decrypting callbacks and responses:

1. Use **your RSA private key** to decrypt `encryptedKeys`
2. Split on `.` separator
3. Base64-decode both parts (AES key and IV)
4. Decrypt `encryptedData` with AES-256-CBC using the recovered key/IV

---

## 5. eCommerce Integration

### 5.1 Create an Order

**Endpoint:** `POST /api/integrator/order`

**Request:** Encrypted wrapper containing the payload below.

#### Required Fields

| Parameter | Type | Constraints |
|---|---|---|
| `amount` | number | Must be > 0 (except subscriptions: must be 0) |
| `receiverId` | string (UUID v4) | Money recipient identifier (provided by Keepz) |
| `receiverType` | string | `BRANCH` |
| `integratorId` | string (UUID v4) | Your integrator ID |
| `integratorOrderId` | string (UUID v4) | Unique order ID in your system |

#### Optional Fields

| Parameter | Type | Values | Notes |
|---|---|---|---|
| `currency` | string | `GEL`, `USD`, `EUR` | Display currency; defaults to GEL |
| `acquiringCurrency` | string | `GEL`, `USD`, `EUR` | Withdrawal currency (permission-restricted) |
| `distributionCurrency` | string | `GEL`, `USD`, `EUR` | Transfer currency (permission-restricted) |
| `tipReceiverId` | string (UUID v4) | — | Requires tipping config |
| `tipReceiverType` | string | `BRANCH`, `USER` | Requires tipping config |
| `successRedirectUri` | string | — | Post-payment redirect URL |
| `failRedirectUri` | string | — | Failure redirect URL |
| `callbackUri` | string | — | Server-to-server webhook endpoint |
| `directLinkProvider` | string | `BOG`, `TBC`, `CREDO`, `DEFAULT` | Bank card payment provider |
| `openBankingLinkProvider` | string | `TBC`, `BOG`, `CREDO`, `LB` | Open banking provider |
| `cryptoPaymentProvider` | string | `CITYPAY` | Cryptocurrency provider |
| `installmentPaymentProvider` | string | `CREDO` | Installment provider |
| `personalNumber` | string | 9 or 11 digits | Mandatory with installment |
| `isForeign` | boolean | — | Mandatory with installment |
| `validUntil` | string | `yyyy-MM-dd HH:mm:ss` | Order expiration; enables retries |
| `language` | string | `EN`, `IT`, `KA` | Payment page language |
| `commissionType` | string | `SENDER`, `RECEIVER`, `BOTH` | Who pays fees |
| `saveCard` | boolean | — | Tokenize card for future use |
| `cardToken` | string (UUID v4) | — | Tokenized card ID for saved-card payments |
| `subscriptionPlan` | object | See below | Recurring payment schedule |
| `splitDetails` | array | See below | Multi-recipient splitting |
| `orderProperties` | object | See below | Order-type-specific fields |

#### Subscription Plan Object

```json
{
  "interval": "MONTHLY|WEEKLY",
  "intervalCount": 1,
  "amount": 29.99,
  "startDate": "2026-04-01T00:00:00"
}
```

> When using subscriptions: `amount` at order level must be `0`, `saveCard` must be `true`. `startDate` defaults to immediate if omitted.

#### Split Details Array

For splitting payment across multiple recipients:

| Parameter | Type | Values |
|---|---|---|
| `receiverType` | string | `BRANCH`, `USER`, `IBAN` |
| `receiverIdentifier` | string | UUID (BRANCH/USER) or IBAN number |
| `amount` | number | Must be > 0 |

> Sum of split amounts must equal the main `amount`.

#### Order Properties Object

```json
{
  "FIELD_NAME": {
    "value": "string",
    "isEditable": false
  }
}
```

Available fields: `PERSONAL_NUMBER`, `PAYER_NAME`, `PURPOSE`, `PERSONAL_NUMBER_OR_PASSPORT`, `IS_FOREIGN`, `SERVICE_PROVIDER_CODE`, `SERVICE_CODE`, `ENTITY_IDENTIFIER`, `CAR_IDENTIFIER`, `INVOICE_NUMBER_LABEL`, `DESCRIPTION`, `INTEGRATOR_PRODUCT_NAME`, `ABONENT_CODE`

**Field requirements by order type:**
- **DEFAULT:** `INVOICE_NUMBER_LABEL`, `DESCRIPTION`, `INTEGRATOR_PRODUCT_NAME` (all optional)
- **TREASURY:** `PERSONAL_NUMBER` (M), `PAYER_NAME` (M), `PURPOSE` (M), `IS_FOREIGN` (M)
- **TRAFFIC_FINE:** `SERVICE_PROVIDER_CODE` (M/H), `SERVICE_CODE` (M/H), `ENTITY_IDENTIFIER` (M), `CAR_IDENTIFIER` (M)

#### Success Response (Encrypted → Decrypted)

| Parameter | Type | Description |
|---|---|---|
| `integratorOrderId` | string (UUID v4) | Echo of request order ID |
| `urlForQR` | string | Checkout page URL — redirect user here |

#### Error Response (Unencrypted)

```json
{
  "message": "string",
  "statusCode": 6049,
  "exceptionGroup": 1
}
```

---

### 5.2 Callback (Webhook)

**Method:** `POST` — initiated by Keepz to your server.

**URL Configuration:**
- **Dynamic:** Set per order via `callbackUri` field
- **Static:** Configured once during integration setup

**Your server must respond:** HTTP 200 to acknowledge receipt.

#### Callback Payload (encrypted → decrypted)

| Parameter | Type | Values |
|---|---|---|
| `amount` | number | Transaction amount paid |
| `receiverId` | string (UUID v4) | Keepz receiver identifier |
| `receiverType` | string | `BRANCH` |
| `integratorId` | string (UUID v4) | Your integrator ID |
| `integratorOrderId` | string (UUID v4) | Your order ID |
| `status` | string | `SUCCESS`, `FAILED` |
| `cardInfo` | object | Card details (only if `saveCard` was true) |
| `initialCurrency` | string | `USD`, `EUR`, `GEL` |
| `acquiringCurrency` | string | `USD`, `EUR`, `GEL` |
| `acquiringAmount` | number | Amount in acquiring currency |

#### cardInfo Object

| Field | Type | Format |
|---|---|---|
| `token` | string (UUID v4) | Reusable tokenized card ID |
| `provider` | string | `CREDO` |
| `cardMask` | string | `411111******1111` |
| `expirationDate` | string | `MM/YY` |
| `cardBrand` | string | `VISA`, `MasterCard`, `AMEX` |

> **If callback delivery fails:** Use Get Order Status endpoint to verify payment status.

---

### 5.3 Get Order Status

**Endpoint:** `GET /api/integrator/order/status`

**Request:** Query parameters with encrypted wrapper.

**Encrypted Payload:**

| Parameter | Type | Required |
|---|---|---|
| `integratorId` | UUID v4 | Yes |
| `integratorOrderId` | UUID v4 | Yes |

**Decrypted Response:** `integratorOrderId` + `status` (see [Order Statuses](#57-order-statuses))

---

### 5.4 Cancel Order

**Endpoint:** `DELETE /api/integrator/order/cancel`

**Request:** Query parameters with encrypted wrapper.

**Encrypted Payload:**

| Parameter | Type | Required |
|---|---|---|
| `integratorId` | UUID v4 | Yes |
| `integratorOrderId` | UUID v4 | Yes |

> Only orders with status `INITIAL` or `PROCESSING` can be canceled.

**Success Response (decrypted):**
```json
{
  "integratorOrderId": "...",
  "status": "CANCELED"
}
```

**Error Example:**
```json
{
  "message": "Order not found or already finalised and can't be canceled",
  "statusCode": 6006,
  "exceptionGroup": 2
}
```

---

### 5.5 Refund

**Endpoint:** `POST /api/integrator/order/refund/v2`

**Encrypted Payload:**

| Parameter | Type | Required | Constraints |
|---|---|---|---|
| `integratorId` | UUID v4 | Yes | Provided by Keepz |
| `integratorOrderId` | UUID v4 | Yes | Unique order identifier |
| `amount` | Decimal | Yes | Must not exceed original amount |
| `refundInitiator` | String | No | `INTEGRATOR`, `OPERATOR` |
| `refundDetails` | Array | No | Refund recipient breakdown |

**refundDetails Array:**

| Parameter | Type | Required | Options |
|---|---|---|---|
| `receiverType` | String | Yes | `BRANCH`, `USER`, `IBAN` |
| `receiverIdentifier` | String | Yes | UUID or IBAN |
| `amount` | Number | Yes | Must be > 0 |

> **Eligibility:** Orders with status `SUCCESS`, `PARTIALLY_REFUNDED`, or `REFUNDED_FAILED`.

**Success Response (decrypted):**
```json
{
  "integratorOrderId": "...",
  "status": "REFUND_REQUESTED"
}
```

> Refund is asynchronous — poll Get Order Status to verify final result.

---

### 5.6 Get Saved Cards

**Endpoint:** `GET /api/v1/integrator/card/order-id`

**Encrypted Payload:** `integratorOrderId` (UUID v4, required)

**Decrypted Response (array):**

| Field | Type | Format |
|---|---|---|
| `token` | string (UUID v4) | Reusable card identifier |
| `provider` | string | `CREDO` |
| `cardMask` | string | `411111******1111` |
| `expirationDate` | string | `MM/YY` |
| `cardBrand` | string | `VISA`, `MasterCard`, `AMEX` |

---

### 5.7 Order Statuses

| Status | Description |
|---|---|
| `INITIAL` | Order created but payment not started |
| `PROCESSING` | Payment in-progress, awaiting action |
| `SUCCESS` | Payment completed, funds captured |
| `FAILED` | Payment unsuccessful |
| `CANCELED` | Order canceled before completion |
| `EXPIRED` | Order remained unpaid within validity window |
| `REFUND_REQUESTED` | Refund submitted, not yet processed |
| `PARTIALLY_REFUNDED` | Partial refund issued |
| `REFUNDED_BY_INTEGRATOR` | Full refund initiated by integrator |
| `REFUNDED_BY_KEEPZ` | Full refund initiated by Keepz |
| `REFUNDED_BY_OPERATOR` | Full refund initiated by operator |
| `REFUNDED_FAILED` | Refund processing failed |

---

## 6. Direct Settlements

### 6.1 Get Access Token

**Endpoint:** `POST /api/auth`

```json
{
  "client_id": "uuid-v4",
  "client_secret": "your-secret",
  "grant_type": "client_credentials"
}
```

**Response (HTTP 200):**
```json
{
  "value": {
    "access_token": "eyJhbGci...",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

---

### 6.2 Create Transaction

**Endpoint:** `POST /api/distributor`
**Auth:** `Authorization: Bearer <access_token>`

| Parameter | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `amount` | number | Yes | Payment amount | Positive, max 10 digits, 2 decimals |
| `currency` | string | Yes | Currency | `GEL`, `USD`, `EUR` |
| `description` | string | Yes | Payment purpose | Alphanumeric + Georgian + special chars |
| `uniqueId` | string (UUID v4) | Yes | Idempotency key | UUID format |
| `toIban` | string | No | Beneficiary IBAN | Valid Georgian IBAN (mutually exclusive with `receiverId`) |
| `receiverId` | string (UUID v4) | No | Keepz receiver ID | UUID (mutually exclusive with `toIban`) |
| `receiverType` | string | No | Beneficiary type | `BRANCH`, `USER` |
| `beneficiaryName` | string | No | Legal name | Must match bank records |
| `beneficiaryIdentityNumber` | string | No | ID number | Individual or company |
| `beneficiaryAddress` | string | No | Address | Free format |
| `birthDate` | string | No | Date of birth | `dd.MM.yyyy` |
| `debtorName` | string | No | Payer name | Restricted |
| `debtorIban` | string | No | Payer IBAN | Pattern: `^GE\d{2}[A-Z]{2}\d{16}$` |
| `debtorIdentityNumber` | string | No | Payer ID | 9 or 11 digits |

**Success Response (HTTP 200):**

| Field | Type | Description |
|---|---|---|
| `transactionId` | number | Server-generated ID |
| `status` | string | Current status |
| `statusDescription` | string | Human-readable status |
| `uniqueId` | string (UUID v4) | Echo of your idempotency key |
| `createdAt` | string (ISO 8601) | Creation timestamp |

---

### 6.3 Get Balance

**Endpoint:** `GET /api/distributor/balance/check`
**Auth:** `Authorization: Bearer <access_token>`
**Query:** `currency` (optional): `GEL`, `USD`, `EUR`

**Response:**
```json
{
  "value": {
    "amount": 2500.20
  }
}
```

---

### 6.4 Get Transaction Details

**Endpoint:** `GET /api/distributor/details`
**Auth:** `Authorization: Bearer <access_token>`
**Query:** `transaction_id` (number, required)

**Response:**
```json
{
  "value": {
    "transactionId": 26,
    "status": "SUCCESS",
    "statusDescription": "success",
    "amount": 1,
    "toIban": "GE34TB0000000000000000",
    "currency": "GEL",
    "paymentDescription": "string",
    "uniqueId": "3fa85f64-1011-4562-b3fc-2c963f66afa6",
    "createdAt": "2024-07-29T17:54:12.853213",
    "commissionAmount": 0.01
  }
}
```

---

### 6.5 Status Codes

| Status | Description |
|---|---|
| `INITIAL` | Transaction created but not yet processed |
| `PENDING` | Waiting to be processed by payment system |
| `SUCCESS` | Successfully processed, funds transferred |
| `REJECTED` | Rejected by the bank |
| `FAILED` | Failed during processing due to error |
| `DELETED` | Deleted by system before execution |
| `INITIAL_INSUFFICIENT_BALANCE` | Insufficient balance at initial stage |

---

## 7. Subscriptions (Recurring Payments)

### 7.1 Get Subscription History

**Endpoint:** `POST /api/v1/integrator/subscription/history`

**Encrypted Payload:** `subscriptionId` (UUID v4, required)

**Decrypted Response (array):**

| Field | Type | Values |
|---|---|---|
| `time` | string | ISO-8601 datetime |
| `status` | string | `ACQUIRING_IN_PROCESS`, `COMPLETED`, `FAILED`, `REFUNDED_BY_KEEPZ`, `REFUNDED_BY_INTEGRATOR`, `REFUNDED_BY_OPERATOR`, `PARTIALLY_REFUNDED` |
| `refundTime` | string or null | ISO-8601 or null |
| `refundedAmount` | number | Refunded amount |
| `failReason` | string | Failure reason |

---

### 7.2 Revoke Subscription

**Endpoint:** `POST /api/v1/integrator/subscription/revoke`

**Encrypted Payload:** `subscriptionId` (UUID v4, required)

**Success Response:** HTTP 200

---

### 7.3 Subscription Callback

**Method:** `POST` — initiated by Keepz to your server.

**URL Configuration:** Dynamic (during subscription creation) or Static (during integration setup).

**Your server must respond:** HTTP 200.

| Parameter | Type | Values |
|---|---|---|
| `subscriptionId` | string (UUID v4) | Subscription identifier |
| `historyId` | number | Specific payment transaction ID |
| `status` | string | `COMPLETED`, `FAILED`, `REFUNDED_BY_KEEPZ`, `REFUNDED_BY_INTEGRATOR`, `REFUNDED_BY_OPERATOR`, `PARTIALLY_REFUNDED` |
| `amount` | number | Amount processed |

> **Triggering events:** Scheduled payment completes, fails, or receives refund.

---

## 8. Error Codes

### 8.1 eCommerce Errors

#### Exception Groups

| Group | Value | HTTP Status | Description |
|---|---|---|---|
| VALIDATION | 1 | 400 Bad Request | Input/data validation failures |
| BUSINESS_LOGIC | 2 | 409, 410, 429, 451 | Domain rules or state violations |
| AUTH | 3 | 403 Forbidden | Permission/authorization issues |
| EXTERNAL_REST | 4 | 502, 500 | External/third-party system errors |
| RESOURCE_NOT_FOUND | 5 | 404 Not Found | Missing or inactive resources |
| GENERAL | 6 | 500 Internal Server Error | Unexpected system/runtime issues |
| INTERNAL_REST | 7 | 500 Internal Server Error | Internal service call errors |

#### Resource Not Found (Group 5)

| Code | Message |
|---|---|
| 6002 | Active check order not found |
| 6004, 6008 | Active Integrator not found |
| 6005 | Integrator order not found |
| 6030 | Tip receiver not found |
| 6044 | Active third party not found |
| 6045 | Third party order not found |
| 6046 | Order not found |
| 6075 | Integrator card not found |
| 6093 | DEFAULT direct link provider not found |
| 6100 | Subscription plan not found |
| 6112 | Subscription plan history not found |

#### Business Logic (Group 2)

| Code | Message |
|---|---|
| 6003 | Integrator order expired |
| 6006 | Order not found or already finalised, can't be canceled |
| 6015 | Order is not valid anymore |
| 6016 | Order is already paid |
| 6017 | Order is expired |
| 6023 | Order with this integratorOrderId already exists |
| 6024 | Receiver type must be 'BRANCH' |
| 6034 | Provided more than one direct link provider |

#### Validation (Group 1)

| Code | Message |
|---|---|
| 6007 | Refund amount out of range |
| 6021 | Number format is not valid |
| 6026 | Amount out of limit range |
| 6027 | Given initiate currency is not allowed |
| 6028 | Given distribution currency is not allowed |
| 6029 | Given acquiring currency is not allowed |
| 6035 | validUntil must be a future date |
| 6041 | Invalid date range |
| 6049 | Invalid integrator order create param |
| 6053 | Not valid method argument |
| 6058 | Amount scale is more than 2 after floating point |
| 6059 | Split amount sum is not equal to main amount |
| 6060 | In split details main receiver not found |
| 6061 | In split details main receiver included more than once |
| 6062 | Split details less than 2 size |
| 6064 | Split details not provided |
| 6066 | Split amount sum is greater than main amount |
| 6068 | Amount must be greater than zero |
| 6070 | Personal number is required |
| 6076 | Integrator order properties cannot be null |
| 6077 | Invalid order property value |
| 6078 | Missing order property value |
| 6079 | Invalid order property field |
| 6081 | Amount is different from service provider debt |
| 6082 | XML signature validation failed |
| 6085 | Invalid integrator type |
| 6086 | RS order is in payment process already |
| 6087 | RS order is already paid |
| 6088 | RS order not valid for payment anymore |
| 6091 | Direct link provider is required |
| 6094 | Partial refund not allowed without details |
| 6095 | Order refund param validation failed |
| 6096 | Invalid refund details |
| 6097 | Duplicated receiver |
| 6098 | Invalid split receiver type |
| 6099 | Invalid split receiver identifier format |
| 6101 | Given payment provider not allowed for subscription |
| 6109 | Invalid third party order create param |
| 6110 | Invalid third party order finalise param |
| 6113 | Amount must be zero |

#### General (Group 6)

| Code | Message |
|---|---|
| 6009 | Failed to encrypt data |
| 6010 | Failed to decrypt data |
| 6011 | Failed to parse data |
| 6013 | Failed to decrypt data using AES |
| 6014 | Failed to encrypt data using AES |
| 6054 | Unhandled general exception |

#### Auth (Group 3)

| Code | Message |
|---|---|
| 6022 | No permission to create orders |
| 6025 | No permission to create multi currency orders |
| 6031 | No permission to save card |
| 6032 | No permission to define order expire date |
| 6033 | No permission to receive direct link |
| 6036 | No permission to use dynamic redirect |
| 6037 | No permission to use additional fields |
| 6038 | No permission to use refund |
| 6056 | No permission to use dynamic callback |
| 6057 | No permission to use split functionality |
| 6090 | No permission to pay with saved card |
| 6111 | No permission for subscription |

---

### 8.2 Direct Settlements Errors

| Code | Message |
|---|---|
| 5003 | Client not found for given id |
| 5006 | Failed to update CREDO distributor transaction status, transaction not found |
| 5013 | Invalid grant type |
| 5015 | Client balance not found with given client id |
| 5017 | Transaction with such unique ID already exists |
| 5021 | Incorrect credentials |
| 5023 | Invalid IBAN |
| 5033 | Distribution strategy not found for given type |
| 5038 | Insufficient balance amount |
| 5039 | Not valid method argument |
| 5040 | Unhandled general exception |
| 5041 | Receiver user not found with given receiverId and receiverType |
| 5042 | Method argument type mismatch |
| 5043 | Http message not readable |
| 5045 | Amount below minimum transaction amount |
| 5046 | Amount above maximum transaction amount |
| 5047 | Permission not found for debtor params |
| 5048 | Permission not found for integrator custom distribution iban |
| 5050 | Currency not allowed |
| 5051 | Currency config not found for given client |

---

## 9. Payment Flow Diagram

```
┌──────────┐     1. Create Order (encrypted)      ┌───────────┐
│  Your    │ ──────────────────────────────────────→│   Keepz   │
│  Server  │ ←──────────────────────────────────────│   API     │
│          │     2. Response: { urlForQR }          │           │
└────┬─────┘                                        └─────┬─────┘
     │                                                    │
     │  3. Redirect user                                  │
     │     to urlForQR                                    │
     ▼                                                    │
┌──────────┐     4. User pays on                   ┌──────┴──────┐
│  User's  │ ──────────────────────────────────────→│   Keepz     │
│  Browser │                Keepz checkout          │   Checkout  │
│          │ ←──────────────────────────────────────│   Page      │
└──────────┘     5. Redirect to                    └─────────────┘
                    successRedirectUri /
                    failRedirectUri
                                                    ┌───────────┐
┌──────────┐     6. POST callback (encrypted)      │   Keepz    │
│  Your    │ ←──────────────────────────────────────│   Webhook  │
│  Server  │ ──────────────────────────────────────→│   Service  │
│          │     7. HTTP 200 acknowledgment         │           │
└──────────┘                                        └───────────┘

     8. (Optional) Poll GET /api/integrator/order/status
        as fallback if callback fails
```

---

## 10. Node.js Code Examples

### Full Encryption/Decryption Class

```javascript
const crypto = require("crypto");

class Keepz {
  constructor(rsaPublicKey, rsaPrivateKey) {
    // Expect Base64 DER encoded keys
    this.rsaPublicKey = rsaPublicKey;
    this.rsaPrivateKey = rsaPrivateKey;
  }

  encrypt(data) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    const encryptedData = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(data), "utf8")),
      cipher.final(),
    ]);

    const encodedKey = aesKey.toString("base64");
    const encodedIV = iv.toString("base64");
    const concat = `${encodedKey}.${encodedIV}`;

    const rsaPublicKey = crypto.createPublicKey({
      key: Buffer.from(this.rsaPublicKey, "base64"),
      format: "der",
      type: "spki",
    });

    const encryptedKeys = crypto.publicEncrypt(
      {
        key: rsaPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(concat, "utf8")
    );

    return {
      encryptedData: encryptedData.toString("base64"),
      encryptedKeys: encryptedKeys.toString("base64"),
    };
  }

  decrypt(encryptedDataB64, encryptedKeysB64) {
    const rsaPrivateKey = crypto.createPrivateKey({
      key: Buffer.from(this.rsaPrivateKey, "base64"),
      format: "der",
      type: "pkcs8",
    });

    const decryptedConcat = crypto
      .privateDecrypt(
        {
          key: rsaPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        Buffer.from(encryptedKeysB64, "base64")
      )
      .toString("utf8");

    const [encodedKey, encodedIV] = decryptedConcat.split(".");
    const aesKey = Buffer.from(encodedKey, "base64");
    const iv = Buffer.from(encodedIV, "base64");

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    const decryptedData = Buffer.concat([
      decipher.update(Buffer.from(encryptedDataB64, "base64")),
      decipher.final(),
    ]);

    return JSON.parse(decryptedData.toString("utf8"));
  }
}
```

### Usage Example — Create an Order

```javascript
const keepz = new Keepz(KEEPZ_RSA_PUBLIC_KEY, YOUR_RSA_PRIVATE_KEY);

// Encrypt the order payload
const payload = {
  amount: 50.00,
  receiverId: "your-receiver-uuid",
  receiverType: "BRANCH",
  integratorId: "your-integrator-uuid",
  integratorOrderId: crypto.randomUUID(),
  currency: "GEL",
  language: "KA",
  successRedirectUri: "https://swavleba.ge/payment/success",
  failRedirectUri: "https://swavleba.ge/payment/fail",
  callbackUri: "https://swavleba.ge/api/keepz/callback",
};

const { encryptedData, encryptedKeys } = keepz.encrypt(payload);

const response = await fetch(
  "https://gateway.dev.keepz.me/ecommerce-service/api/integrator/order",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "your-integrator-identifier",
      encryptedData,
      encryptedKeys,
      aes: true,
    }),
  }
);

const result = await response.json();
// Decrypt the response to get urlForQR
const decrypted = keepz.decrypt(result.encryptedData, result.encryptedKeys);
// decrypted = { integratorOrderId: "...", urlForQR: "https://..." }
```

### Usage Example — Handle Callback

```javascript
// POST /api/keepz/callback
export async function POST(req) {
  const body = await req.json();
  const keepz = new Keepz(KEEPZ_RSA_PUBLIC_KEY, YOUR_RSA_PRIVATE_KEY);

  const decrypted = keepz.decrypt(body.encryptedData, body.encryptedKeys);
  // decrypted = { integratorOrderId, status, amount, ... }

  if (decrypted.status === "SUCCESS") {
    // Update order status in your database
  } else {
    // Handle failure
  }

  return new Response("OK", { status: 200 });
}
```

---

## 11. Other Language Examples

<details>
<summary>C# Example</summary>

```csharp
using System.Security.Cryptography;
using System.Text;

public static class EncryptionUtils
{
    public static string EncryptUsingPublicKey(string data, string publicKey, bool usePkcsPadding = false)
    {
        string pemPublicKey = "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----";
        using RSA rsa = RSA.Create();
        rsa.ImportFromPem(pemPublicKey);
        RSAEncryptionPadding padding = usePkcsPadding
            ? RSAEncryptionPadding.Pkcs1
            : RSAEncryptionPadding.OaepSHA256;
        byte[] dataBytes = rsa.Encrypt(Encoding.UTF8.GetBytes(data), padding);
        return Convert.ToBase64String(dataBytes);
    }

    public static string DecryptUsingPrivateKey(string encryptedData, string privateKey, bool usePkcsPadding = false)
    {
        string pemPrivateKey = "-----BEGIN PRIVATE KEY-----\n" + privateKey + "\n-----END PRIVATE KEY-----";
        using RSA rsa = RSA.Create();
        rsa.ImportFromPem(pemPrivateKey);
        RSAEncryptionPadding padding = usePkcsPadding
            ? RSAEncryptionPadding.Pkcs1
            : RSAEncryptionPadding.OaepSHA256;
        byte[] encryptedDataBytes = Convert.FromBase64String(encryptedData);
        byte[] decryptedDataBytes = rsa.Decrypt(encryptedDataBytes, padding);
        return Encoding.UTF8.GetString(decryptedDataBytes);
    }

    public static EncryptedResponse EncryptWithAes(string data, string publicKey, bool usePkcsPadding = false)
    {
        using Aes aes = Aes.Create();
        aes.KeySize = 256;
        aes.GenerateKey();
        aes.GenerateIV();
        byte[] encryptedDataBytes;
        using (ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV))
        {
            byte[] dataBytes = Encoding.UTF8.GetBytes(data);
            encryptedDataBytes = encryptor.TransformFinalBlock(dataBytes, 0, dataBytes.Length);
        }
        string encryptedDataBase64 = Convert.ToBase64String(encryptedDataBytes);
        string aesProperties = Convert.ToBase64String(aes.Key) + "." + Convert.ToBase64String(aes.IV);
        string encryptedAesProperties = EncryptUsingPublicKey(aesProperties, publicKey, usePkcsPadding);
        return new EncryptedResponse(encryptedDataBase64, encryptedAesProperties, true);
    }

    public static string DecryptWithAes(string encryptedAesProperties, string encryptedData, string privateKey, bool usePkcsPadding = false)
    {
        string decryptedAesProperties = DecryptUsingPrivateKey(encryptedAesProperties, privateKey, usePkcsPadding);
        string[] aesProps = decryptedAesProperties.Split('.');
        byte[] aesIV = Convert.FromBase64String(aesProps[1]);
        byte[] aesKey = Convert.FromBase64String(aesProps[0]);
        using Aes aes = Aes.Create();
        aes.Key = aesKey;
        aes.IV = aesIV;
        byte[] decryptedDataBytes;
        using (ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV))
        {
            byte[] encryptedDataBytes = Convert.FromBase64String(encryptedData);
            decryptedDataBytes = decryptor.TransformFinalBlock(encryptedDataBytes, 0, encryptedDataBytes.Length);
        }
        return Encoding.UTF8.GetString(decryptedDataBytes);
    }
}
```

</details>

<details>
<summary>Python Example</summary>

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os
import base64

def encrypt_using_public_key(data: str, public_key_string: str, use_pkc_padding: bool = True) -> str:
    pem_key = f"-----BEGIN PUBLIC KEY-----\n{public_key_string}\n-----END PUBLIC KEY-----"
    public_key = serialization.load_pem_public_key(pem_key.encode('utf-8'))
    if use_pkc_padding:
        chosen_padding = padding.PKCS1v15()
    else:
        chosen_padding = padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    encrypted_data = public_key.encrypt(data.encode('utf-8'), chosen_padding)
    return base64.b64encode(encrypted_data).decode('utf-8')

def decrypt_using_private_key(encrypted_data: str, private_key_string: str, use_pkc_padding: bool = True) -> str:
    pem_key = f"-----BEGIN PRIVATE KEY-----\n{private_key_string}\n-----END PRIVATE KEY-----"
    private_key = serialization.load_pem_private_key(pem_key.encode('utf-8'), password=None)
    if use_pkc_padding:
        chosen_padding = padding.PKCS1v15()
    else:
        chosen_padding = padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    decrypted_data = private_key.decrypt(base64.b64decode(encrypted_data), chosen_padding)
    return decrypted_data.decode('utf-8')

class EncryptedResponse:
    def __init__(self, encrypted_data: str, aes_properties: str, aes: bool):
        self.encrypted_data = encrypted_data
        self.aes_properties = aes_properties
        self.aes = aes

def encrypt_with_aes(data: str, public_key: str, use_pkc_padding: bool = True) -> EncryptedResponse:
    aes_key = os.urandom(32)
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    padded_data = data + (16 - len(data) % 16) * chr(16 - len(data) % 16)
    encrypted_data = encryptor.update(padded_data.encode('utf-8')) + encryptor.finalize()
    aes_properties = base64.b64encode(aes_key).decode('utf-8') + "." + base64.b64encode(iv).decode('utf-8')
    base64_encrypted_data = base64.b64encode(encrypted_data).decode('utf-8')
    encrypted_aes_properties = encrypt_using_public_key(aes_properties, public_key, use_pkc_padding)
    return EncryptedResponse(base64_encrypted_data, encrypted_aes_properties, True)

def decrypt_with_aes(properties: str, encrypted_data: str, private_key: str, use_pkc_padding: bool = True) -> str:
    decrypted_aes_properties_in_base64 = decrypt_using_private_key(properties, private_key, use_pkc_padding)
    array_of_iv_n_key = decrypted_aes_properties_in_base64.split(".")
    aes_key = base64.b64decode(array_of_iv_n_key[0])
    iv = base64.b64decode(array_of_iv_n_key[1])
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted_padded_data = decryptor.update(base64.b64decode(encrypted_data)) + decryptor.finalize()
    pad_length = decrypted_padded_data[-1]
    decrypted_data = decrypted_padded_data[:-pad_length]
    return decrypted_data.decode('utf-8')
```

</details>

<details>
<summary>Go RSA Example</summary>

```go
package encryption_utils

import (
    "crypto/rand"
    "crypto/rsa"
    "crypto/sha256"
    "crypto/x509"
    "encoding/base64"
    "encoding/pem"
    "fmt"
)

type RSA struct {
    privateKey *rsa.PrivateKey
    publicKey  *rsa.PublicKey
}

func NewRSA(privateKey, publicKey string) *RSA {
    r := &RSA{}
    prKey, _ := loadPrivateKey(privateKey)
    if prKey != nil { r.privateKey = prKey }
    pbKey, _ := loadPublicKey(publicKey)
    if pbKey != nil { r.publicKey = pbKey }
    return r
}

func (r *RSA) EncryptUsingPublicKey(data string, usePkcsPadding bool) (string, error) {
    if r.publicKey == nil { return "", fmt.Errorf("public key is not set") }
    var encryptedBytes []byte
    var err error
    if usePkcsPadding {
        encryptedBytes, err = rsa.EncryptPKCS1v15(rand.Reader, r.publicKey, []byte(data))
    } else {
        hash := sha256.New()
        encryptedBytes, err = rsa.EncryptOAEP(hash, rand.Reader, r.publicKey, []byte(data), nil)
    }
    return base64.StdEncoding.EncodeToString(encryptedBytes), err
}

func (r *RSA) DecryptUsingPrivateKey(encryptedData string, usePkcsPadding bool) (string, error) {
    if r.privateKey == nil { return "", fmt.Errorf("private key is not set") }
    encryptedBytes, _ := base64.StdEncoding.DecodeString(encryptedData)
    var decryptedBytes []byte
    var err error
    if usePkcsPadding {
        decryptedBytes, err = rsa.DecryptPKCS1v15(rand.Reader, r.privateKey, encryptedBytes)
    } else {
        hash := sha256.New()
        decryptedBytes, err = rsa.DecryptOAEP(hash, rand.Reader, r.privateKey, encryptedBytes, nil)
    }
    return string(decryptedBytes), err
}

func loadPrivateKey(privateKey string) (*rsa.PrivateKey, error) {
    pemKey := "-----BEGIN PRIVATE KEY-----\n" + privateKey + "\n-----END PRIVATE KEY-----"
    block, _ := pem.Decode([]byte(pemKey))
    key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
    rsaKey, _ := key.(*rsa.PrivateKey)
    return rsaKey, err
}

func loadPublicKey(publicKey string) (*rsa.PublicKey, error) {
    pemKey := "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----"
    block, _ := pem.Decode([]byte(pemKey))
    key, err := x509.ParsePKIXPublicKey(block.Bytes)
    rsaKey, _ := key.(*rsa.PublicKey)
    return rsaKey, err
}
```

</details>

<details>
<summary>Java Example</summary>

Uses `javax.crypto` and `java.security`:
- RSA: `RSA/ECB/OAEPWithSHA-256AndMGF1Padding`
- AES: `AES/CBC/PKCS5Padding`
- Key size: 256-bit AES, 16-byte IV
- Methods: `encryptUsingPublicKey()`, `decryptWithPrivateKey()`, `encryptWithAES()`, `decryptWithAES()`

</details>

---

## 12. Testing Environment

### Available Test URLs

| Service | URL |
|---|---|
| eCommerce | `https://gateway.dev.keepz.me/ecommerce-service` |
| Direct Settlements | `https://distributor.dev.keepz.me` |

### What You Must Obtain from Keepz

The following are **not publicly documented** and must be requested from Keepz during onboarding:

- **Test credentials:** `identifier`, RSA key pair, `receiverId`, `client_id`/`client_secret`
- **Test card numbers:** No public test card numbers documented (unlike Stripe's `4242...`)
- **Sandbox behavior:** How to simulate failed payments, refunds, etc.
- **Test account registration process**

### Integration Setup Checklist

- [ ] Request test credentials from Keepz
- [ ] Receive RSA public key (Keepz's) for encrypting requests
- [ ] Generate your own RSA key pair, share public key with Keepz (for callback decryption)
- [ ] Receive `identifier`, `integratorId`, and `receiverId` values
- [ ] Configure static callback URL (or plan to use dynamic per-order)
- [ ] Test encryption/decryption with sample payloads before hitting live endpoints

---

## 13. Implementation Roadmap for swavleba.ge

### Phase 1 — Infrastructure

1. **Generate RSA key pair** for swavleba.ge
   - Store private key in environment variables (never commit)
   - Share public key with Keepz during onboarding

2. **Create shared encryption library** — `lib/keepz/crypto.ts`
   - Adapt the Node.js `Keepz` class from Section 10
   - Use native `crypto` module (works in both Node.js and Edge Functions)

3. **Store credentials in environment variables:**
   ```
   KEEPZ_IDENTIFIER=...
   KEEPZ_INTEGRATOR_ID=...
   KEEPZ_RECEIVER_ID=...
   KEEPZ_RSA_PUBLIC_KEY=...     # Keepz's public key (Base64 DER)
   KEEPZ_RSA_PRIVATE_KEY=...    # Your private key (Base64 DER)
   ```

### Phase 2 — API Routes

4. **Create Order endpoint** — `app/api/keepz/create-order/route.ts`
   - Accept: amount, currency, order metadata
   - Encrypt payload, call Keepz Create Order
   - Decrypt response, return `urlForQR` to client
   - Store `integratorOrderId` in Supabase for tracking

5. **Callback webhook** — `app/api/keepz/callback/route.ts`
   - Receive encrypted POST from Keepz
   - Decrypt, validate `integratorOrderId`
   - Update payment status in Supabase
   - Respond HTTP 200

6. **Order status polling** — `app/api/keepz/status/route.ts`
   - Fallback for when callbacks fail
   - Encrypt request, call Get Order Status, decrypt response

### Phase 3 — Database

7. **Migration for payments table:**
   ```sql
   CREATE TABLE payments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     integrator_order_id UUID UNIQUE NOT NULL,
     amount DECIMAL(10,2) NOT NULL,
     currency TEXT DEFAULT 'GEL',
     status TEXT DEFAULT 'INITIAL',
     keepz_url TEXT,            -- urlForQR for redirect
     callback_data JSONB,       -- raw decrypted callback
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

### Phase 4 — Frontend

8. **Payment UI component** — trigger payment from course/project purchase flow
9. **Redirect handling** — success/fail pages at `/payment/success` and `/payment/fail`
10. **Payment status display** — show real-time status updates via Supabase Realtime

### Phase 5 — Production

11. Switch from `gateway.dev.keepz.me` to `gateway.keepz.me`
12. Swap test credentials for production credentials
13. Verify callback URL is publicly accessible
14. Monitor error codes and add alerting

---

## Documentation Sources

All information extracted from [developers.keepz.me](https://developers.keepz.me):

- [Welcome / Homepage](https://www.developers.keepz.me/)
- [Create an Order](https://www.developers.keepz.me/eCommerece%20integration/create-an-order/)
- [Encryption Guide](https://www.developers.keepz.me/eCommerece%20integration/cryptography/encuryption-guide/)
- [Node.js Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/node-exmaple/)
- [C# Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/csharp-example/)
- [Java Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/java-example/)
- [Python Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/python-example/)
- [Go AES Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/Go%20examples/aes)
- [Go RSA Example](https://www.developers.keepz.me/eCommerece%20integration/cryptography/Go%20examples/rsa)
- [Get Saved Cards](https://www.developers.keepz.me/eCommerece%20integration/get-saved-cards/)
- [Callback](https://www.developers.keepz.me/eCommerece%20integration/callback)
- [Cancel Order](https://www.developers.keepz.me/eCommerece%20integration/cancel_order)
- [Errors](https://www.developers.keepz.me/eCommerece%20integration/errors)
- [Get Order Status](https://www.developers.keepz.me/eCommerece%20integration/get-order-status)
- [Refund](https://www.developers.keepz.me/eCommerece%20integration/refund)
- [Get Access Token](https://www.developers.keepz.me/Direct%20Settelments/get-access-token/)
- [Create Transaction](https://www.developers.keepz.me/Direct%20Settelments/create-transaction/)
- [Get Balance](https://www.developers.keepz.me/Direct%20Settelments/get-balance)
- [Get Transaction Details](https://www.developers.keepz.me/Direct%20Settelments/get-transaction-details)
- [Status Codes](https://www.developers.keepz.me/Direct%20Settelments/status-codes)
- [Direct Settlements Errors](https://www.developers.keepz.me/Direct%20Settelments/errors)
- [Get Subscription History](https://www.developers.keepz.me/Subscription/get-subscription-history)
- [Revoke Subscription](https://www.developers.keepz.me/Subscription/revoke-subscription)
- [Subscription Callback](https://www.developers.keepz.me/Subscription/subscription-callback)
