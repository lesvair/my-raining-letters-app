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

  let name: string = '';
  let email: string = '';
  let recaptchaToken: string = '';

  try {
     const requestBody = await request.json(); // Use a different name to avoid conflict with 'data'
    // Assign values to the already declared variables
    name = requestBody.name;
    email = requestBody.email;
    recaptchaToken = requestBody.recaptchaToken;

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
     if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const prismaError = error as { code: string; meta?: { target?: string[] } }; // Type assertion
      if (prismaError.meta?.target?.includes('email')) {
        console.warn('Attempted duplicate email submission:', email); // 'email' is now in scope
        return NextResponse.json({ message: 'This email is already on the waitlist.' }, { status: 409 });
      }
    }

    // Handle JSON parsing error specifically if request.json() failed
    if (error instanceof SyntaxError) {
      console.error('Error parsing request body (likely not JSON):', error);
      return NextResponse.json({ message: 'Invalid request data format.' }, { status: 400 });
    }

    console.error('Error processing waitlist submission:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}