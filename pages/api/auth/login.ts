import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { verifyPassword, createToken } from '@/lib/utils/auth';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const { email, password } = req.body as LoginRequest;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  try {
    // For demo mode, create a user if it doesn't exist
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Demo mode: create user on first login
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: '', // Demo mode - no password verification
          name: email.split('@')[0],
        },
      });
    }

    const token = createToken({
      userId: user.id,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login',
    });
  }
}
