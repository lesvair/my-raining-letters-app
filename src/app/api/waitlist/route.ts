// src/app/api/waitinglist/route.ts (Enhanced)

import { NextResponse, NextRequest } from 'next/server';
import { ratelimit } from '@/lib/rateLimit';
import prisma from '@/lib/prisma'; // Import Prisma client for database operations}

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(request: NextRequest) {
    if (!RECAPTCHA_SECRET_KEY) {
    console.error('RECAPTCHA_SECRET_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
  }

 // --- Rate Limiting ---
  const ip = request.headers.get('x-forwarded-for') ; // Only use x-forwarded-for for IP
  if (!ip) {
    console.warn('Could not determine IP from x-forwarded-for header.');
    return NextResponse.json({ message: 'Cannot determine IP address for rate limiting.' }, { status: 400 });
  }

  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return NextResponse.json(
      {
        message: 'Too many requests. Please try again later.',
        limit,
        remaining,
        reset,
      },
      { status: 429 } // 429 Too Many Requests
    );
  }
  // --- End Rate Limiting ---

  let name: string;
  let email: string | undefined = undefined;

  try {
    const data = await request.json();
    const { name, email, recaptchaToken } = data;

        // --- 1. Validate reCAPTCHA token ---
    if (!recaptchaToken) {
      return NextResponse.json({ message: 'reCAPTCHA token is missing.' }, { status: 400 });
    }

    const recaptchaVerifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
        body:`secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });

    const recaptchaResult = await recaptchaVerifyResponse.json();
    console.log('reCAPTCHA verification result:', recaptchaResult);

    if (!recaptchaResult.success || recaptchaResult.score < 0.4) { // You can adjust the score threshold
      console.warn('reCAPTCHA verification failed for submission:', { score: recaptchaResult.score, errors: recaptchaResult['error-codes'] });
      // Return 403 Forbidden if reCAPTCHA fails, indicating likely bot activity
      return NextResponse.json({ message: 'reCAPTCHA verification failed. You might be a bot.' }, { status: 403 });
    }
    // --- End reCAPTCHA validation ---


    // --- Server-Side Validation ---
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return NextResponse.json({ message: 'Name must be between 2 and 100 characters.' }, { status: 400 });
    }

    // Basic email regex validation (can be more robust)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
    }

    // --- 2. Save to Database ---
    const newEntry = await prisma.waitlistEntry.create({
      data: {
        name: name,
        email: email,
      },
    });

    console.log('New Waitlist Submission Saved:', { id: newEntry.id, name: newEntry.name, email: newEntry.email });

    return NextResponse.json({ message: 'Successfully added to waitlist!', name, email, id: newEntry.id }, { status: 200 });

  } catch (error: any) { // Use 'any' for now, or refine error types
    // Handle unique constraint error for email
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      console.warn('Attempted duplicate email submission:', email);
      return NextResponse.json({ message: 'This email is already on the waitlist.' }, { status: 409 }); // 409 Conflict
    }

    console.error('Error processing waitlist submission:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}