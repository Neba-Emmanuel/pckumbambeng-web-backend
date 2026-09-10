declare global {
  namespace Express {
    interface Request {
      member?: {
        id: number;
        role: 'administrator';
      };
    }
  }
}

export {};
