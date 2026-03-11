# Keepz Payment Integration Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Architecture & Payment Flow](#3-architecture--payment-flow)
4. [Environment Setup](#4-environment-setup)
5. [Encryption Layer (AES-256-CBC + RSA)](#5-encryption-layer-aes-256-cbc--rsa)
6. [API Reference](#6-api-reference)
   - 6.1 [Create Order](#61-create-order)
   - 6.2 [Get Order Status](#62-get-order-status)
   - 6.3 [Cancel Order](#63-cancel-order)
   - 6.4 [Refund](#64-refund)
   - 6.5 [Get Saved Cards](#65-get-saved-cards)
   - 6.6 [Callback (Webhook)](#66-callback-webhook)
7. [Error Codes](#7-error-codes)
8. [Implementation Guide (Node.js / TypeScript)](#8-implementation-guide-nodejs--typescript)
   - 8.1 [Encryption Utility](#81-encryption-utility)
   - 8.2 [Keepz Service](#82-keepz-service)
   - 8.3 [API Routes (Express)](#83-api-routes-express)
   - 8.4 [Frontend Integration](#84-frontend-integration)
9. [Advanced Features](#9-advanced-features)
   - 9.1 [Saved Cards](#91-saved-cards)
   - 9.2 [Subscriptions](#92-subscriptions)
   - 9.3 [Split Payments](#93-split-payments)
   - 9.4 [Order Properties (Treasury / Traffic Fine)](#94-order-properties-treasury--traffic-fine)
10. [Testing](#10-testing)
11. [Security Checklist](#11-security-checklist)
12. [Environment Variables Reference](#12-environment-variables-reference)

---

## 1. Overview

Keepz is a Georgian payment processing platform that supports multiple payment methods:

- **Bank cards** — via BOG (Bank of Georgia), TBC Bank, Credo Bank
- **Open banking** — via TBC, BOG, Credo, Liberty Bank
- **Cryptocurrency** — via CityPay
- **Installment payments** — via Credo
- **QR code payments** — Keepz checkout page or static merchant QR

All API communication uses **hybrid encryption**: AES-256-CBC for payload encryption, RSA (OAEP with SHA-256) for key exchange. Responses from Keepz are also encrypted using the same scheme.

**Supported currencies:** GEL (default), USD, EUR

**Official docs:** https://www.developers.keepz.me/

---

## 2. Prerequisites

You need the following credentials from a Keepz representative before starting:

| Credential | Format | Description |
|---|---|---|
| `integratorId` | UUID v4 | Your unique identifier in the Keepz system |
| `receiverId` | UUID v4 | Identifier of the money recipient (your merchant/branch) |
| `receiverType` | String | Type of recipient — typically `"BRANCH"` |
| Keepz RSA Public Key | Base64 DER (SPKI) | Used to encrypt requests so only Keepz can read them |
| Your RSA Key Pair | Base64 DER (SPKI/PKCS#8) | Your public key is given to Keepz; your private key decrypts their responses |

You must provide Keepz with:

- Your **RSA Public Key** (so Keepz can encrypt responses to you)
- Your **Callback URL** (receives async payment status notifications)
- Your **Success Redirect URL** (user lands here after successful payment)
- Your **Fail Redirect URL** (user lands here after failed payment)

> These URLs can be set globally during onboarding or per-order via API parameters.

---

## 3. Architecture & Payment Flow

### System Architecture

```
┌──────────────┐        ┌──────────────┐        ┌──────────────────────┐
│   Customer   │        │  Your Server │        │   Keepz Gateway      │
│   Browser    │        │  (Backend)   │        │   eCommerce API      │
└──────┬───────┘        └──────┬───────┘        └──────────┬───────────┘
       │                       │                           │
       │  1. Checkout click    │                           │
       │──────────────────────>│                           │
       │                       │  2. POST /api/integrator/ │
       │                       │     order (encrypted)     │
       │                       │──────────────────────────>│
       │                       │                           │
       │                       │  3. Encrypted response    │
       │                       │     { urlForQR }          │
       │                       │<──────────────────────────│
       │                       │                           │
       │  4. Redirect to       │                           │
       │     urlForQR          │                           │
       │<──────────────────────│                           │
       │                       │                           │
       │  5. Customer pays on  │                           │
       │     Keepz checkout    │                           │
       │─────────────────────────────────────────────────>│
       │                       │                           │
       │  6. Redirect to       │  7. Callback POST         │
       │     success/fail URL  │     (encrypted)           │
       │<──────────────────────│<──────────────────────────│
       │                       │                           │
       │                       │  8. Update order in DB    │
       │                       │                           │
```

### Flow Summary

1. Customer initiates checkout on your site
2. Your backend creates an encrypted order via Keepz API
3. Keepz returns an encrypted response containing `urlForQR` (checkout page URL)
4. You redirect the customer to `urlForQR` (or display it as a QR code)
5. Customer selects a payment method and completes payment on Keepz's checkout page
6. Keepz redirects the customer to your `successRedirectUri` or `failRedirectUri`
7. Keepz also sends an async HTTP POST callback to your `callbackUri` with payment details (encrypted)
8. Your backend decrypts the callback and updates the order status in your database

> **Important:** Orders that are not finalized within 5 minutes of creation are automatically cancelled by Keepz.

---

## 4. Environment Setup

### Base URLs

| Environment | URL |
|---|---|
| **Sandbox / Test** | `https://gateway.dev.keepz.me/ecommerce-service` |
| **Production** | `https://gateway.keepz.me/ecommerce-service` |

### RSA Key Requirements

| Key | Format | Encoding |
|---|---|---|
| Public Key | SPKI | DER, then Base64-encoded |
| Private Key | PKCS#8 | DER, then Base64-encoded |

### RSA Padding Mode

```
RSA/ECB/OAEPWithSHA-256AndMGF1Padding
```

In Node.js: `crypto.constants.RSA_PKCS1_OAEP_PADDING` with `oaepHash: "sha256"`

---

## 5. Encryption Layer (AES-256-CBC + RSA)

### Transport Format

Every request to and response from Keepz uses this structure:

```json
{
  "identifier": "<your-integrator-id>",
  "encryptedData": "<base64-string>",
  "encryptedKeys": "<base64-string>",
  "aes": true
}
```

> Note: `identifier` is only in the request body. Responses contain only `encryptedData`, `encryptedKeys`, `aes`.

### Encrypting a Request (You → Keepz)

```
Step 1: Generate a random AES-256 key (32 bytes) and IV (16 bytes)
Step 2: AES-256-CBC encrypt JSON.stringify(payload) → encryptedData (Base64)
Step 3: Base64-encode the AES key and IV separately
Step 4: Concatenate: "{base64Key}.{base64IV}"
Step 5: RSA-OAEP encrypt that string with Keepz's public key → encryptedKeys (Base64)
Step 6: Set aes: true
```

### Decrypting a Response (Keepz → You)

```
Step 1: RSA-OAEP decrypt encryptedKeys with YOUR private key → "{base64Key}.{base64IV}"
Step 2: Split on "." to get base64Key and base64IV
Step 3: Base64-decode both to get raw AES key (32 bytes) and IV (16 bytes)
Step 4: AES-256-CBC decrypt encryptedData → JSON string
Step 5: JSON.parse the result
```

### Node.js Reference Implementation

```javascript
const crypto = require("crypto");

class KeepzCrypto {
  constructor(keepzRsaPublicKeyB64, myRsaPrivateKeyB64) {
    this.keepzRsaPublicKeyB64 = keepzRsaPublicKeyB64;   // Base64 DER (SPKI)
    this.myRsaPrivateKeyB64 = myRsaPrivateKeyB64;       // Base64 DER (PKCS#8)
  }

  encrypt(data) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    const encryptedData = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(data), "utf8")),
      cipher.final(),
    ]);

    const concat = `${aesKey.toString("base64")}.${iv.toString("base64")}`;

    const rsaPublicKey = crypto.createPublicKey({
      key: Buffer.from(this.keepzRsaPublicKeyB64, "base64"),
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
      key: Buffer.from(this.myRsaPrivateKeyB64, "base64"),
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

module.exports = KeepzCrypto;
```

---

## 6. API Reference

All endpoints use the base URL from [Section 4](#4-environment-setup).

---

### 6.1 Create Order

**`POST /api/integrator/order`**

Creates a new payment order in the Keepz system.

#### Request Body

```json
{
  "identifier": "your-integrator-id",
  "encryptedData": "...",
  "encryptedKeys": "...",
  "aes": true
}
```

#### Encrypted Payload (inside `encryptedData`)

##### Required Fields

| Parameter | Type | Description |
|---|---|---|
| `amount` | number | Payment amount. Must be > 0 (or 0 for subscription-only orders). |
| `receiverId` | UUID v4 | Recipient ID in Keepz. Provided by Keepz representative. |
| `receiverType` | string | Recipient type. Always `"BRANCH"`. |
| `integratorId` | UUID v4 | Your integrator ID. Provided by Keepz representative. |
| `integratorOrderId` | UUID v4 | Unique order ID you generate for this transaction. |

##### Optional Fields

| Parameter | Type | Values / Description |
|---|---|---|
| `currency` | string | `GEL` (default), `USD`, `EUR` — currency displayed to the sender |
| `acquiringCurrency` | string | `GEL`, `USD`, `EUR` — currency withdrawn from sender's card. **Requires Keepz permission.** |
| `distributionCurrency` | string | `GEL`, `USD`, `EUR` — currency transferred to receiver. **Requires Keepz permission.** |
| `language` | string | `EN`, `IT`, `KA` — payment page language |
| `successRedirectUri` | string | URL to redirect user after successful payment. **Requires Keepz permission for per-order override.** |
| `failRedirectUri` | string | URL to redirect user after failed payment. **Requires Keepz permission for per-order override.** |
| `callbackUri` | string | URL for async payment notification. **Requires Keepz permission for per-order override.** |
| `directLinkProvider` | string | Pre-select card payment: `BOG`, `TBC`, `CREDO`, `DEFAULT`. Skips method selection on checkout. **Requires Keepz permission.** |
| `openBankingLinkProvider` | string | Pre-select open banking: `TBC`, `BOG`, `CREDO`, `LB`. **Requires Keepz permission.** |
| `cryptoPaymentProvider` | string | Pre-select crypto: `CITYPAY`. **Requires Keepz permission.** |
| `installmentPaymentProvider` | string | Pre-select installment: `CREDO`. **Requires Keepz permission.** |
| `personalNumber` | string | Payer's national ID. **Mandatory if `installmentPaymentProvider` is set.** Georgian: 9 or 11 digits. |
| `isForeign` | boolean | Whether payer is a foreign citizen. **Mandatory if `installmentPaymentProvider` is set.** |
| `commissionType` | string | `SENDER`, `RECEIVER`, `BOTH` — who pays the transaction commission |
| `saveCard` | boolean | Tokenize card for future payments. Requires `directLinkProvider`. **Requires Keepz permission.** |
| `cardToken` | UUID v4 | Charge a previously saved card. Token comes from callback's `cardInfo.cardToken`. **Requires Keepz permission.** |
| `validUntil` | string | Order expiration datetime. Format: `"yyyy-MM-dd HH:mm:ss"`. Allows retries until expiration. **Requires Keepz permission.** |
| `tipReceiverId` | UUID v4 | Tip recipient ID. **Requires Keepz permission + tipping configured.** |
| `tipReceiverType` | string | `BRANCH` or `USER`. **Requires Keepz permission.** |
| `subscriptionPlan` | object | Recurring payment schedule. See [Section 9.2](#92-subscriptions). |
| `splitDetails` | array | Split payment between recipients. See [Section 9.3](#93-split-payments). |
| `orderProperties` | object | Extra fields for TREASURY / TRAFFIC_FINE orders. See [Section 9.4](#94-order-properties-treasury--traffic-fine). |

#### Success Response (Encrypted)

The response body is `{ encryptedData, encryptedKeys, aes }`. After decryption:

```json
{
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "urlForQR": "https://checkout.keepz.me/..."
}
```

| Field | Description |
|---|---|
| `integratorOrderId` | The order ID you sent in the request |
| `urlForQR` | Checkout page URL. Redirect the customer here or generate a QR code from it. |

#### Error Response (Plaintext, NOT encrypted)

```json
{
  "message": "You do not have permission to save card!",
  "statusCode": 6031,
  "exceptionGroup": 3
}
```

See [Section 7](#7-error-codes) for full error code list.

#### Examples

**Basic order (customer chooses payment method on checkout):**
```json
{
  "amount": 50.00,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

**Pre-selected card payment:**
```json
{
  "amount": 100,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "directLinkProvider": "DEFAULT"
}
```

**Open banking:**
```json
{
  "amount": 100,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "openBankingLinkProvider": "TBC"
}
```

**Crypto:**
```json
{
  "amount": 100,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cryptoPaymentProvider": "CITYPAY"
}
```

**Installment:**
```json
{
  "amount": 100,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "installmentPaymentProvider": "CREDO",
  "personalNumber": "610012345",
  "isForeign": false
}
```

**Expiring order:**
```json
{
  "amount": 100,
  "receiverId": "90434fa9-46df-4c44-a4d1-da742ac815da",
  "receiverType": "BRANCH",
  "integratorId": "ce3a3476-a542-4e5d-a957-72fcd0e35d2c",
  "integratorOrderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "validUntil": "2026-10-18 09:51:14"
}
```

---

### 6.2 Get Order Status

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/get-order-status -->
<!-- ============================================================ -->

**`[TODO: HTTP_METHOD] [TODO: /api/integrator/...endpoint-path]`**

Retrieves the current status of an order.

#### Request Format

```
[TODO: Is this a GET with encrypted query params, or POST with encrypted body?]
[TODO: Paste the exact request structure here]
```

#### Encrypted Payload Fields (what goes inside encryptedData)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

#### Decrypted Response Fields

| Parameter | Type | Description |
|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` |

#### Possible Order Statuses

| Status | Description |
|---|---|
| `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` |

#### Example Request Payload (before encryption)

```json
[TODO]
```

#### Example Response (after decryption)

```json
[TODO]
```

---

### 6.3 Cancel Order

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/cancel_order -->
<!-- ============================================================ -->

**`[TODO: HTTP_METHOD] [TODO: /api/integrator/...endpoint-path]`**

Cancels a pending order.

#### Request Format

```
[TODO: POST body? Uses standard encrypted format?]
```

#### Encrypted Payload Fields

| Parameter | Type | Required | Description |
|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

#### Decrypted Response Fields

| Parameter | Type | Description |
|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` |

#### Example Request Payload (before encryption)

```json
[TODO]
```

#### Example Response (after decryption)

```json
[TODO]
```

---

### 6.4 Refund

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/refund -->
<!-- ============================================================ -->

**`[TODO: HTTP_METHOD] [TODO: /api/integrator/...endpoint-path]`**

Refunds a completed payment (full or partial).

#### Request Format

```
[TODO: POST body? Uses standard encrypted format?]
```

#### Encrypted Payload Fields

| Parameter | Type | Required | Description |
|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. amount]` | `[TODO]` | `[TODO]` | `[TODO: supports partial?]` |

#### Decrypted Response Fields

| Parameter | Type | Description |
|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` |

#### Example Request Payload (before encryption)

```json
[TODO]
```

#### Example Response (after decryption)

```json
[TODO]
```

---

### 6.5 Get Saved Cards

**`GET /api/v1/integrator/card/order-id`**

Retrieves information about a card previously saved in the Keepz system.

#### Request Format

Encrypted parameters are sent as **query parameters** (not body):

```
GET /api/v1/integrator/card/order-id?identifier=...&encryptedData=...&encryptedKeys=...&aes=true
```

#### Encrypted Payload Fields

| Parameter | Type | Required | Description |
|---|---|---|---|
| `integratorOrderId` | UUID v4 | Yes | Must correspond to an order where `saveCard: true` was used |

<!-- [TODO: Are there other fields inside the encrypted payload?] -->

#### Decrypted Response Fields

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/get-saved-cards -->
<!-- ============================================================ -->

| Parameter | Type | Description |
|---|---|---|
| `[TODO: e.g. cardToken]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. maskedPan]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. cardBrand]` | `[TODO]` | `[TODO]` |
| `[TODO: other fields]` | `[TODO]` | `[TODO]` |

#### Error Response (Plaintext)

```json
{
  "message": "Integrator card not found",
  "statusCode": 6075,
  "exceptionGroup": 5
}
```

---

### 6.6 Callback (Webhook)

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/callback -->
<!-- ============================================================ -->

Keepz sends an HTTP POST to your `callbackUri` after payment completion.

#### Request from Keepz to Your Server

```
POST <your-callback-url>
Content-Type: application/json

{
  "encryptedData": "...",
  "encryptedKeys": "...",
  "aes": true
}
```

#### Decrypted Callback Payload Fields

| Parameter | Type | Description |
|---|---|---|
| `[TODO: e.g. integratorOrderId]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. status]` | `[TODO]` | `[TODO: list values like SUCCESS, FAILED]` |
| `[TODO: e.g. amount]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. currency]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. paymentMethod]` | `[TODO]` | `[TODO]` |
| `[TODO: e.g. cardInfo]` | `[TODO]` | `[TODO: present when saveCard was true]` |
| `[TODO: other fields]` | `[TODO]` | `[TODO]` |

#### cardInfo Object (when saveCard: true)

| Parameter | Type | Description |
|---|---|---|
| `[TODO: e.g. cardToken]` | `[TODO]` | `[TODO: UUID to use in future cardToken field]` |
| `[TODO: e.g. maskedPan]` | `[TODO]` | `[TODO: e.g. "****1234"]` |
| `[TODO: other fields]` | `[TODO]` | `[TODO]` |

#### Expected Response from Your Server

```
[TODO: HTTP status code? Body format? E.g. HTTP 200 with empty body, or { "received": true }?]
```

#### Retry Behavior

```
[TODO: Does Keepz retry callbacks if your server doesn't respond 200?]
[TODO: How many retries? What intervals?]
```

#### Example Decrypted Callback

```json
{
  "[TODO — paste a real example from the docs]": "..."
}
```

---

## 7. Error Codes

<!-- ============================================================ -->
<!-- TODO: FILL IN FROM https://www.developers.keepz.me/eCommerece%20integration/errors -->
<!-- ============================================================ -->

Error responses are returned as **plaintext JSON** (not encrypted):

```json
{
  "message": "Human-readable error description",
  "statusCode": 6031,
  "exceptionGroup": 3
}
```

### Full Error Code Table

| statusCode | exceptionGroup | message | Description / When it occurs |
|---|---|---|---|
| 6031 | 3 | "You do not have permission to save card!" | saveCard used without Keepz permission |
| 6075 | 5 | "Integrator card not found" | cardToken/order has no saved card |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

### Exception Groups

| exceptionGroup | Meaning |
|---|---|
| `[TODO: 1]` | `[TODO]` |
| `[TODO: 2]` | `[TODO]` |
| `[TODO: 3]` | `[TODO]` |
| `[TODO: 4]` | `[TODO]` |
| `[TODO: 5]` | `[TODO]` |

### Finalization Status Codes (QR/Mobile Banking flow)

These appear in the decrypted response when finalizing an order:

| Status | Description |
|---|---|
| `SUCCESS` | Order completed successfully; funds will transfer to beneficiary |
| `ALREADY_FINALISED` | Order was already completed |
| `ORDER_NOT_FOUND` | Order was not created or expired due to inactivity |
| `RECEIVER_REACHED_LIMIT` | Recipient has reached their Keepz limit |
| `AMOUNT_NOT_IN_RANGE` | Amount below minimum or above maximum limit |
| `WRONG_AMOUNT` | Amount sent during finalization doesn't match the order |

---

## 8. Implementation Guide (Node.js / TypeScript)

### 8.1 Encryption Utility

See the full `KeepzCrypto` class in [Section 5](#nodejs-reference-implementation).

### 8.2 Keepz Service

```javascript
// services/keepz.service.js
const { v4: uuidv4 } = require("uuid");
const KeepzCrypto = require("../lib/keepz-crypto");

const BASE_URL = process.env.KEEPZ_BASE_URL;
const INTEGRATOR_ID = process.env.KEEPZ_INTEGRATOR_ID;
const RECEIVER_ID = process.env.KEEPZ_RECEIVER_ID;

const keepzCrypto = new KeepzCrypto(
  process.env.KEEPZ_RSA_PUBLIC_KEY,
  process.env.MY_RSA_PRIVATE_KEY
);

// ── Create Order ─────────────────────────────────────────────────
async function createOrder({
  amount,
  currency,
  successRedirectUri,
  failRedirectUri,
  callbackUri,
  directLinkProvider,
  openBankingLinkProvider,
  cryptoPaymentProvider,
  installmentPaymentProvider,
  personalNumber,
  isForeign,
  saveCard,
  cardToken,
  language,
  commissionType,
  validUntil,
  subscriptionPlan,
  splitDetails,
  orderProperties,
  orderId,
}) {
  const integratorOrderId = orderId || uuidv4();

  const payload = {
    amount,
    receiverId: RECEIVER_ID,
    receiverType: "BRANCH",
    integratorId: INTEGRATOR_ID,
    integratorOrderId,
  };

  // Add all optional fields if present
  const optionalFields = {
    currency, successRedirectUri, failRedirectUri, callbackUri,
    directLinkProvider, openBankingLinkProvider, cryptoPaymentProvider,
    installmentPaymentProvider, personalNumber, isForeign,
    saveCard, cardToken, language, commissionType, validUntil,
    subscriptionPlan, splitDetails, orderProperties,
  };

  for (const [key, value] of Object.entries(optionalFields)) {
    if (value !== undefined && value !== null) {
      payload[key] = value;
    }
  }

  const encrypted = keepzCrypto.encrypt(payload);

  const response = await fetch(`${BASE_URL}/api/integrator/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: INTEGRATOR_ID,
      encryptedData: encrypted.encryptedData,
      encryptedKeys: encrypted.encryptedKeys,
      aes: true,
    }),
  });

  const result = await response.json();

  // Errors are plaintext (not encrypted)
  if (result.statusCode) {
    throw new KeepzError(result.message, result.statusCode, result.exceptionGroup);
  }

  // Success responses are encrypted
  const decrypted = keepzCrypto.decrypt(result.encryptedData, result.encryptedKeys);

  return {
    integratorOrderId,
    checkoutUrl: decrypted.urlForQR,
  };
}

// ── Decrypt Callback ─────────────────────────────────────────────
function decryptCallback(body) {
  return keepzCrypto.decrypt(body.encryptedData, body.encryptedKeys);
}

// ── Get Order Status ─────────────────────────────────────────────
// [TODO: Implement after filling in Section 6.2]
async function getOrderStatus(integratorOrderId) {
  throw new Error("Not implemented — fill in Section 6.2 first");
}

// ── Cancel Order ─────────────────────────────────────────────────
// [TODO: Implement after filling in Section 6.3]
async function cancelOrder(integratorOrderId) {
  throw new Error("Not implemented — fill in Section 6.3 first");
}

// ── Refund ───────────────────────────────────────────────────────
// [TODO: Implement after filling in Section 6.4]
async function refundOrder(integratorOrderId, amount) {
  throw new Error("Not implemented — fill in Section 6.4 first");
}

// ── Get Saved Cards ──────────────────────────────────────────────
async function getSavedCards(integratorOrderId) {
  const payload = { integratorOrderId };
  const encrypted = keepzCrypto.encrypt(payload);

  const params = new URLSearchParams({
    identifier: INTEGRATOR_ID,
    encryptedData: encrypted.encryptedData,
    encryptedKeys: encrypted.encryptedKeys,
    aes: "true",
  });

  const response = await fetch(
    `${BASE_URL}/api/v1/integrator/card/order-id?${params}`,
    { method: "GET" }
  );

  const result = await response.json();

  if (result.statusCode) {
    throw new KeepzError(result.message, result.statusCode, result.exceptionGroup);
  }

  return keepzCrypto.decrypt(result.encryptedData, result.encryptedKeys);
}

// ── Error Class ──────────────────────────────────────────────────
class KeepzError extends Error {
  constructor(message, statusCode, exceptionGroup) {
    super(message);
    this.name = "KeepzError";
    this.statusCode = statusCode;
    this.exceptionGroup = exceptionGroup;
  }
}

module.exports = {
  createOrder,
  decryptCallback,
  getOrderStatus,
  cancelOrder,
  refundOrder,
  getSavedCards,
  KeepzError,
};
```

### 8.3 API Routes (Express)

```javascript
// routes/payment.routes.js
const express = require("express");
const router = express.Router();
const keepz = require("../services/keepz.service");

// POST /api/payments/create — Create a new payment
router.post("/create", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const result = await keepz.createOrder({
      amount,
      currency: currency || "GEL",
      successRedirectUri: `${process.env.FRONTEND_URL}/payment/success`,
      failRedirectUri: `${process.env.FRONTEND_URL}/payment/fail`,
      callbackUri: `${process.env.BACKEND_URL}/api/payments/callback`,
    });

    // TODO: Save order to your database here
    // await db.orders.create({ ... });

    res.json({
      orderId: result.integratorOrderId,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error) {
    if (error instanceof keepz.KeepzError) {
      return res.status(400).json({
        error: error.message,
        code: error.statusCode,
      });
    }
    console.error("Payment creation failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/payments/callback — Keepz sends payment results here
router.post("/callback", async (req, res) => {
  try {
    const data = keepz.decryptCallback(req.body);
    console.log("Keepz callback:", JSON.stringify(data, null, 2));

    // TODO: Update order status in your database
    // TODO: If saveCard was used, store data.cardInfo.cardToken

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Callback processing failed:", error);
    res.status(500).json({ error: "Processing failed" });
  }
});

// GET /api/payments/:orderId/status — Check order status
router.get("/:orderId/status", async (req, res) => {
  try {
    // TODO: Check your database first, optionally call keepz.getOrderStatus()
    res.json({ status: "TODO — implement after filling Section 6.2" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
```

### 8.4 Frontend Integration

```javascript
// React example — checkout button handler
async function handleCheckout(amount, currency = "GEL") {
  try {
    const response = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment creation failed");
    }

    const { checkoutUrl, orderId } = await response.json();
    sessionStorage.setItem("currentOrderId", orderId);

    // Redirect to Keepz checkout page
    window.location.href = checkoutUrl;
  } catch (error) {
    console.error("Checkout error:", error);
    // Show error to user
  }
}

// Success page — poll for confirmed status
async function pollPaymentStatus() {
  const orderId = sessionStorage.getItem("currentOrderId");
  if (!orderId) return;

  const response = await fetch(`/api/payments/${orderId}/status`);
  const { status } = await response.json();

  if (status === "SUCCESS") {
    // Show success UI
  } else if (status === "FAILED" || status === "CANCELLED") {
    // Show failure UI
  } else {
    setTimeout(pollPaymentStatus, 2000); // Retry in 2s
  }
}
```

---

## 9. Advanced Features

### 9.1 Saved Cards

**Save card during first payment:**
```json
{
  "amount": 10,
  "receiverId": "...",
  "receiverType": "BRANCH",
  "integratorId": "...",
  "integratorOrderId": "...",
  "saveCard": true,
  "directLinkProvider": "CREDO"
}
```

After successful payment, the callback's `cardInfo` object contains `cardToken`. Store it securely.

**Charge a saved card (no redirect):**
```json
{
  "amount": 10,
  "receiverId": "...",
  "receiverType": "BRANCH",
  "integratorId": "...",
  "integratorOrderId": "...",
  "cardToken": "token-uuid-from-callback"
}
```

### 9.2 Subscriptions

Set `amount: 0`, `saveCard: true`, and add a `subscriptionPlan` object:

```json
{
  "amount": 0,
  "receiverId": "...",
  "receiverType": "BRANCH",
  "integratorId": "...",
  "integratorOrderId": "...",
  "saveCard": true,
  "directLinkProvider": "DEFAULT",
  "subscriptionPlan": {
    "interval": "MONTHLY",
    "intervalCount": 1,
    "amount": 29.99,
    "startDate": "2026-04-01T00:00:00"
  }
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `interval` | string | Yes | `MONTHLY` or `WEEKLY` |
| `intervalCount` | number | Yes | Intervals between charges (e.g., `2` + `MONTHLY` = every 2 months) |
| `amount` | number | Yes | Charge per interval (> 0) |
| `startDate` | string | No | First charge date (today or future). Omit for immediate. |

### 9.3 Split Payments

Distribute an order amount between multiple recipients:

```json
{
  "amount": 100,
  "receiverId": "...",
  "receiverType": "BRANCH",
  "integratorId": "...",
  "integratorOrderId": "...",
  "splitDetails": [
    { "receiverType": "BRANCH", "receiverIdentifier": "uuid-1", "amount": 75 },
    { "receiverType": "IBAN", "receiverIdentifier": "GE34BG0000001234567890", "amount": 25 }
  ]
}
```

| Parameter | Type | Values |
|---|---|---|
| `receiverType` | string | `BRANCH`, `USER`, `IBAN` |
| `receiverIdentifier` | string | UUID for BRANCH/USER, IBAN string for IBAN |
| `amount` | number | Amount for this recipient (> 0) |

### 9.4 Order Properties (Treasury / Traffic Fine)

Key-value map for special order types. Each value: `{ "value": "...", "isEditable": false }`.

| Field | DEFAULT | TREASURY | TRAFFIC_FINE |
|---|---|---|---|
| `PERSONAL_NUMBER` | — | Mandatory | — |
| `PAYER_NAME` | — | Mandatory | — |
| `PURPOSE` | — | Mandatory | — |
| `IS_FOREIGN` | — | Mandatory | — |
| `SERVICE_PROVIDER_CODE` | — | — | Mandatory (hidden) |
| `SERVICE_CODE` | — | — | Mandatory (hidden) |
| `ENTITY_IDENTIFIER` | — | — | Mandatory |
| `CAR_IDENTIFIER` | — | — | Mandatory |
| `INVOICE_NUMBER_LABEL` | Optional | — | — |
| `DESCRIPTION` | Optional | — | — |
| `INTEGRATOR_PRODUCT_NAME` | Optional (hidden) | — | — |

---

## 10. Testing

### Test Environment

Base URL: `https://gateway.dev.keepz.me/ecommerce-service`

### Generate RSA Keys

```bash
# Generate private key
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key
openssl rsa -pubout -in private_key.pem -out public_key.pem

# Convert to Base64 DER (Keepz format)
openssl pkcs8 -topk8 -nocrypt -in private_key.pem -outform DER | base64 -w 0 > private_b64.txt
openssl rsa -pubout -in private_key.pem -outform DER | base64 -w 0 > public_b64.txt
```

### Verify Encryption Round-Trip

```javascript
const KeepzCrypto = require("./lib/keepz-crypto");
const kc = new KeepzCrypto(YOUR_PUB_B64, YOUR_PRIV_B64);
const data = { amount: 100, test: true };
const enc = kc.encrypt(data);
const dec = kc.decrypt(enc.encryptedData, enc.encryptedKeys);
console.assert(JSON.stringify(data) === JSON.stringify(dec));
```

### Checklist

- [ ] Encryption round-trip works
- [ ] Create order returns valid checkout URL in sandbox
- [ ] Checkout page shows correct amount
- [ ] Successful payment triggers callback
- [ ] Failed payment triggers callback
- [ ] Redirect URLs work correctly
- [ ] Error handling catches Keepz errors
- [ ] Card saving + token charging works
- [ ] Subscription creation works

---

## 11. Security Checklist

- [ ] RSA keys in env vars, not in source control
- [ ] All crypto happens server-side only
- [ ] Fresh AES key + IV per request
- [ ] Callbacks decrypted and verified
- [ ] Callback endpoint is HTTPS
- [ ] cardTokens encrypted in database
- [ ] integratorOrderId is UUID v4
- [ ] Handle 5-minute order timeout
- [ ] Rate limiting on payment endpoints
- [ ] Idempotent order creation
- [ ] Keepz errors not leaked to frontend verbatim

---

## 12. Environment Variables Reference

```env
# Keepz API
KEEPZ_BASE_URL=https://gateway.dev.keepz.me/ecommerce-service
KEEPZ_INTEGRATOR_ID=
KEEPZ_RECEIVER_ID=
KEEPZ_RSA_PUBLIC_KEY=

# Your RSA Private Key
MY_RSA_PRIVATE_KEY=

# App URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

---

## Links

| Resource | URL |
|---|---|
| API Docs (Home) | https://www.developers.keepz.me/ |
| Create Order | https://www.developers.keepz.me/eCommerece%20integration/create-an-order/ |
| Get Order Status | https://www.developers.keepz.me/eCommerece%20integration/get-order-status/ |
| Get Saved Cards | https://www.developers.keepz.me/eCommerece%20integration/get-saved-cards/ |
| Cancel Order | https://www.developers.keepz.me/eCommerece%20integration/cancel_order/ |
| Refund | https://www.developers.keepz.me/eCommerece%20integration/refund/ |
| Callback | https://www.developers.keepz.me/eCommerece%20integration/callback/ |
| Errors | https://www.developers.keepz.me/eCommerece%20integration/errors/ |
| Encryption Guide | https://www.developers.keepz.me/eCommerece%20integration/cryptography/encuryption-guide/ |
| Node.js Example | https://www.developers.keepz.me/eCommerece%20integration/cryptography/node-exmaple/ |
| Python Example | https://www.developers.keepz.me/eCommerece%20integration/cryptography/python-example/ |
| Java Example | https://www.developers.keepz.me/eCommerece%20integration/cryptography/java-example/ |
| C# Example | https://www.developers.keepz.me/eCommerece%20integration/cryptography/csharp-example/ |
| Go Example | https://www.developers.keepz.me/eCommerece%20integration/cryptography/Go%20examples/aes |
| Subscriptions | https://www.developers.keepz.me/Subscription/get-subscription-history |
| Laravel Package | https://packagist.org/packages/class-atlas/laravel-keepz-ecommerce |
