// src/app/api/waitinglist/route.ts (Final attempt to fix compilation)

import { NextResponse, NextRequest } from 'next/server';
import { ratelimit } from '@/lib/rateLimit';
import prisma from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(request: NextRequest) {
  if (!RECAPTCHA_SECRET_KEY) {
    console.error('RECAPTCHA_SECRET_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
  }

  // --- Rate Limiting ---
  // Rely exclusively on 'x-forwarded-for' for IP.
  // In Vercel environments, this header is reliably provided by the edge network.
  const ip = request.headers.get('x-forwarded-for');

  if (!ip) {
    // If for some reason x-forwarded-for is missing, it's a critical error for rate limiting.
    console.warn('Could not determine IP from x-forwarded-for header for rate limiting.');
    return NextResponse.json({ message: 'Cannot determine IP address for rate limiting.' }, { status: 400 });
  }

  const { success: rateLimitSuccess, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!rateLimitSuccess) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return NextResponse.json(
      {
        message: 'Too many requests. Please try again later.',
        limit,
        remaining,
        reset,
      },
      { status: 429 }
    );
  }
  // --- End Rate Limiting ---

  let receivedEmail: string | undefined;

  try {
    const { name, email, recaptchaToken } = await request.json();

    receivedEmail = email;

    // --- 1. Validate reCAPTCHA token ---
    if (!recaptchaToken) {
      return NextResponse.json({ message: 'reCAPTCHA token is missing.' }, { status: 400 });
    }

    const recaptchaVerifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });

    const recaptchaResult = await recaptchaVerifyResponse.json();
    console.log('reCAPTCHA verification result:', recaptchaResult);

    if (!recaptchaResult.success || recaptchaResult.score < 0.4) {
      console.warn('reCAPTCHA verification failed for submission:', { score: recaptchaResult.score, errors: recaptchaResult['error-codes'] });
      return NextResponse.json({ message: 'reCAPTCHA verification failed. You might be a bot.' }, { status: 403 });
    }
    // --- End reCAPTCHA validation ---


    // --- Server-Side Validation ---
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return NextResponse.json({ message: 'Name must be between 2 and 100 characters.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!receivedEmail || typeof receivedEmail !== 'string' || !emailRegex.test(receivedEmail)) {
      return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
    }

    // --- 2. Save to Database ---
    const newEntry = await prisma.waitlistEntry.create({
      data: {
        name: name,
        email: receivedEmail,
      },
    });

    console.log('New Waitlist Submission Saved:', { id: newEntry.id, name: newEntry.name, email: newEntry.email });

    return NextResponse.json({ message: 'Successfully added to waitlist!', name, email: receivedEmail, id: newEntry.id }, { status: 200 });

  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('email')
      ) {
        console.warn('Attempted duplicate email submission for:', receivedEmail, 'Error details:', error);
        return NextResponse.json({ message: 'This email is already on the waitlist.' }, { status: 409 });
      }
    }

    if (error instanceof SyntaxError) {
      console.error('Error parsing request body (likely not JSON):', error);
      return NextResponse.json({ message: 'Invalid request data format.' }, { status: 400 });
    }

    console.error('Error processing waitlist submission:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}