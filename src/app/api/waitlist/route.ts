// src/app/api/waitinglist/route.ts (Enhanced)

import { NextResponse, NextRequest } from 'next/server';
import { ratelimit } from '@/lib/rateLimit';

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
      body: `secret=<span class="math-inline">\{RECAPTCHA\_SECRET\_KEY\}&response\=</span>{recaptchaToken}`,
    });

    const recaptchaResult = await recaptchaVerifyResponse.json();
    console.log('reCAPTCHA verification result:', recaptchaResult);

    if (!recaptchaResult.success || recaptchaResult.score < 0.3) { // You can adjust the score threshold
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

    // --- IMPORTANT: This is where you would normally save to a database ---
    console.log('New Waitlist Submission:');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('reCAPTCHA Score:', recaptchaResult.score);
    console.log('IP:', ip);
    console.log('---------------------------');
    // --- End of database placeholder ---

    return NextResponse.json({ message: 'Successfully added to waitlist!', name, email }, { status: 200 });
  } catch (error) {
    console.error('Error processing waitlist submission:', error);
    // Handle cases where JSON is malformed or other unexpected errors
    return NextResponse.json({ message: 'Invalid request data.' }, { status: 400 });
  }
}