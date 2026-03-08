import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits — recommended for GCM
const KEY_LENGTH = 32 // 256 bits — 64 hex chars

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string in the format: `iv:authTag:ciphertext`
 *
 * @param plaintext - The string to encrypt
 * @param keyHex - A 64-character hex string (TOKEN_ENCRYPTION_KEY)
 */
export function encrypt(plaintext: string, keyHex: string): string {
  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters`)
  }
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

/**
 * Decrypts an AES-256-GCM ciphertext produced by `encrypt()`.
 * Expects format: `iv:authTag:ciphertext` (base64-encoded parts)
 *
 * @param ciphertext - The encrypted string produced by `encrypt()`
 * @param keyHex - A 64-character hex string (TOKEN_ENCRYPTION_KEY)
 */
export function decrypt(ciphertext: string, keyHex: string): string {
  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters`)
  }
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected iv:authTag:ciphertext')
  }
  const [ivB64, authTagB64, encryptedB64] = parts as [string, string, string]
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
