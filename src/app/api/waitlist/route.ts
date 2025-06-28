// src/app/api/waitinglist/route.ts (Revised - Attempt 3 to fix compilation)

import { NextResponse, NextRequest } from 'next/server';
import { ratelimit } from '@/lib/rateLimit';
import prisma from '@/lib/prisma'; // Import Prisma client for database operations
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'; // Import specific Prisma error type

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(request: NextRequest) {
  if (!RECAPTCHA_SECRET_KEY) {
    console.error('RECAPTCHA_SECRET_KEY is not set in environment variables.');
    return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
  }

  // --- Rate Limiting ---
  const ip = request.headers.get('x-forwarded-for') || request.ip;
  if (!ip) {
    console.warn('Could not determine IP from x-forwarded-for header.');
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

  // Declare variables that might be needed in catch block outside try/catch
  let receivedEmail: string | undefined; // Using 'receivedEmail' to avoid naming conflicts, initialize as undefined

  try {
    const { name, email, recaptchaToken } = await request.json();

    receivedEmail = email; // Assign the email here so it's available in catch block

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
    if (!receivedEmail || typeof receivedEmail !== 'string' || !emailRegex.test(receivedEmail)) { // Use receivedEmail
      return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
    }

    // --- 2. Save to Database ---
    const newEntry = await prisma.waitlistEntry.create({
      data: {
        name: name,
        email: receivedEmail, // Use receivedEmail
      },
    });

    console.log('New Waitlist Submission Saved:', { id: newEntry.id, name: newEntry.name, email: newEntry.email });

    return NextResponse.json({ message: 'Successfully added to waitlist!', name, email: receivedEmail, id: newEntry.id }, { status: 200 }); // Use receivedEmail

  } catch (error) { // Use default 'unknown' type for catch
    // Handle unique constraint error for email using the specific Prisma error type
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        console.warn('Attempted duplicate email submission for:', receivedEmail, 'Error details:', error); // receivedEmail is accessible
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