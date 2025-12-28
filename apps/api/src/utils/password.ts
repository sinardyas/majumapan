// Use Bun's native password hashing for better compatibility
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: SALT_ROUNDS,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function hashPin(pin: string): Promise<string> {
  return Bun.password.hash(pin, {
    algorithm: 'bcrypt',
    cost: SALT_ROUNDS,
  });
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return Bun.password.verify(pin, hash);
}
