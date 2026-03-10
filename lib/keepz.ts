import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const env = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

// ---------------------------------------------------------------------------
// KeepzError
// ---------------------------------------------------------------------------

export class KeepzError extends Error {
  statusCode: number;
  exceptionGroup: number;

  constructor(message: string, statusCode: number, exceptionGroup: number) {
    super(message);
    this.name = 'KeepzError';
    this.statusCode = statusCode;
    this.exceptionGroup = exceptionGroup;
  }
}

// ---------------------------------------------------------------------------
// KeepzCrypto — AES-256-CBC + RSA-OAEP hybrid encryption
// ---------------------------------------------------------------------------

export class KeepzCrypto {
  private keepzRsaPublicKeyB64: string;
  private myRsaPrivateKeyB64: string;

  constructor(keepzRsaPublicKeyB64: string, myRsaPrivateKeyB64: string) {
    this.keepzRsaPublicKeyB64 = keepzRsaPublicKeyB64;
    this.myRsaPrivateKeyB64 = myRsaPrivateKeyB64;
  }

  /**
   * Encrypt a JSON-serialisable payload using AES-256-CBC with a random key,
   * then RSA-OAEP-encrypt the AES key + IV for the receiver.
   */
  encrypt(data: Record<string, unknown>): {
    encryptedData: string;
    encryptedKeys: string;
  } {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encryptedData = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(data), 'utf8')),
      cipher.final(),
    ]);

    const concat = `${aesKey.toString('base64')}.${iv.toString('base64')}`;

    const rsaPublicKey = crypto.createPublicKey({
      key: Buffer.from(this.keepzRsaPublicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });

    const encryptedKeys = crypto.publicEncrypt(
      {
        key: rsaPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(concat, 'utf8'),
    );

    return {
      encryptedData: encryptedData.toString('base64'),
      encryptedKeys: encryptedKeys.toString('base64'),
    };
  }

  /**
   * Decrypt a response / callback that was encrypted by Keepz.
   */
  decrypt(encryptedDataB64: string, encryptedKeysB64: string): Record<string, unknown> {
    const rsaPrivateKey = crypto.createPrivateKey({
      key: Buffer.from(this.myRsaPrivateKeyB64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });

    const decryptedConcat = crypto
      .privateDecrypt(
        {
          key: rsaPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedKeysB64, 'base64'),
      )
      .toString('utf8');

    const [encodedKey, encodedIV] = decryptedConcat.split('.');
    const aesKey = Buffer.from(encodedKey, 'base64');
    const iv = Buffer.from(encodedIV, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    const decryptedData = Buffer.concat([
      decipher.update(Buffer.from(encryptedDataB64, 'base64')),
      decipher.final(),
    ]);

    return JSON.parse(decryptedData.toString('utf8'));
  }
}

// ---------------------------------------------------------------------------
// Singleton crypto instance (lazily initialised)
// ---------------------------------------------------------------------------

let _crypto: KeepzCrypto | null = null;

function getKeepzCrypto(): KeepzCrypto {
  if (!_crypto) {
    _crypto = new KeepzCrypto(
      env('KEEPZ_RSA_PUBLIC_KEY'),
      env('MY_RSA_PRIVATE_KEY'),
    );
  }
  return _crypto;
}

// ---------------------------------------------------------------------------
// createKeepzOrder
// ---------------------------------------------------------------------------

export interface CreateOrderOptions {
  amount: number;
  currency?: string;
  integratorOrderId?: string;
  successRedirectUri?: string;
  failRedirectUri?: string;
  callbackUri?: string;
  language?: string;
}

export interface CreateOrderResult {
  integratorOrderId: string;
  checkoutUrl: string;
}

export async function createKeepzOrder(
  options: CreateOrderOptions,
): Promise<CreateOrderResult> {
  const BASE_URL = env('KEEPZ_BASE_URL');
  const integratorId = env('KEEPZ_INTEGRATOR_ID');
  const receiverId = env('KEEPZ_RECEIVER_ID');
  const keepzCrypto = getKeepzCrypto();

  const integratorOrderId = options.integratorOrderId ?? crypto.randomUUID();

  const payload: Record<string, unknown> = {
    amount: options.amount,
    receiverId,
    receiverType: 'BRANCH',
    integratorId,
    integratorOrderId,
  };

  if (options.currency !== undefined) payload.currency = options.currency;
  if (options.successRedirectUri !== undefined) payload.successRedirectUri = options.successRedirectUri;
  if (options.failRedirectUri !== undefined) payload.failRedirectUri = options.failRedirectUri;
  if (options.callbackUri !== undefined) payload.callbackUri = options.callbackUri;
  if (options.language !== undefined) payload.language = options.language;

  const { encryptedData, encryptedKeys } = keepzCrypto.encrypt(payload);

  const response = await fetch(`${BASE_URL}/api/integrator/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: integratorId,
      encryptedData,
      encryptedKeys,
      aes: true,
    }),
  });

  const body = await response.json();

  // Error responses from Keepz are plaintext JSON with a statusCode field
  if (body.statusCode && typeof body.statusCode === 'number') {
    throw new KeepzError(
      (body.message as string) ?? 'Keepz API error',
      body.statusCode as number,
      (body.exceptionGroup as number) ?? 0,
    );
  }

  if (!response.ok) {
    throw new KeepzError(
      body.message || `Keepz API error (HTTP ${response.status})`,
      response.status,
      0,
    );
  }

  // Success responses are encrypted
  const decrypted = keepzCrypto.decrypt(
    body.encryptedData as string,
    body.encryptedKeys as string,
  );

  return {
    integratorOrderId,
    checkoutUrl: decrypted.urlForQR as string,
  };
}

// ---------------------------------------------------------------------------
// getOrderStatus
// ---------------------------------------------------------------------------

export async function getOrderStatus(
  integratorOrderId: string,
): Promise<Record<string, unknown>> {
  const BASE_URL = env('KEEPZ_BASE_URL');
  const integratorId = env('KEEPZ_INTEGRATOR_ID');
  const keepzCrypto = getKeepzCrypto();

  const { encryptedData, encryptedKeys } = keepzCrypto.encrypt({
    integratorOrderId,
  });

  const params = new URLSearchParams({
    identifier: integratorId,
    encryptedData,
    encryptedKeys,
    aes: 'true',
  });

  const response = await fetch(
    `${BASE_URL}/api/integrator/order/status?${params.toString()}`,
    { method: 'GET' },
  );

  if (!response.ok) {
    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }

    if (parsed && typeof parsed.statusCode === 'number') {
      throw new KeepzError(
        (parsed.message as string) ?? 'Keepz API error',
        parsed.statusCode as number,
        (parsed.exceptionGroup as number) ?? 0,
      );
    }

    throw new KeepzError(
      text || `Keepz API error (HTTP ${response.status})`,
      response.status,
      0,
    );
  }

  const body = await response.json();
  return keepzCrypto.decrypt(
    body.encryptedData as string,
    body.encryptedKeys as string,
  );
}

// ---------------------------------------------------------------------------
// decryptCallback
// ---------------------------------------------------------------------------

export function decryptCallback(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const keepzCrypto = getKeepzCrypto();
  return keepzCrypto.decrypt(
    body.encryptedData as string,
    body.encryptedKeys as string,
  );
}
