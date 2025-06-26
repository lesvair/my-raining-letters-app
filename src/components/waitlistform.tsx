// src/components/WaitlistForm.tsx
"use client"; // This is crucial for client-side React hooks

import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha"; // Import the ReCAPTCHA component

const WaitlistForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const captchaRef = useRef<ReCAPTCHA>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(false);
    setError(null);
    setIsLoading(true);

    // --- reCAPTCHA Step: Get the token ---
    let recaptchaToken: string | undefined;

    if (captchaRef.current) {
        try {
            const token = await captchaRef.current.executeAsync();
            recaptchaToken = token ?? undefined; // Converts null to undefined
            console.log('Frontend: reCAPTCHA token generated:', recaptchaToken); // Log the token
        } catch (execError) {
            console.error("Frontend: Error executing reCAPTCHA:", execError);
            setError("Failed to get reCAPTCHA token. Please try again.");
            setIsLoading(false);
            return;
        }
    } else {
        console.error("Frontend: reCAPTCHA component ref is null. Is it rendered?");
        setError("reCAPTCHA is not ready. Please try again.");
        setIsLoading(false);
        return;
    }

    if (!recaptchaToken) {
        console.error("Frontend: reCAPTCHA token is undefined or null after execution.");
        setError("reCAPTCHA token not generated. Please try again.");
        setIsLoading(false);
        return;
    }

    // --- Send data to API ---
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, recaptchaToken }),
      });

      setIsLoading(false);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server Error Response:', errorData);
        setError(errorData.message || 'An unexpected error occurred.');
      } else {
        setSubmitted(true);
        setName('');
        setEmail('');
        // You might want to reset reCAPTCHA here if needed, but for v3 invisible, it's usually automatic
        // captchaRef.current?.reset();
      }
    } catch (fetchError) {
      setIsLoading(false);
      console.error('Fetch error:', fetchError);
      setError('Could not connect to the server. Please check your internet connection.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 rounded-lg shadow-lg max-w-md w-full bg-gray-800 text-green-400">
      <h2 className="text-3xl font-bold mb-6 text-center">Join Our Waitlist</h2>

      {isLoading && <p className="text-center mb-4">Submitting...</p>}
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      {submitted && (
        <p className="text-green-500 text-center mb-4">
          Thank you for joining our waitlist!
        </p>
      )}

      {!submitted && (
        <>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium mb-2">Name:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500 text-white"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-2">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500 text-white"
              required
            />
          </div>
          {/* Invisible ReCAPTCHA component */}
          <ReCAPTCHA
            sitekey="6LfUvmgrAAAAABeGcHGEc7HP9huBu1CokYfsdbnr" // Replace with your actual reCAPTCHA v3 Site Key
            size="invisible"
            ref={captchaRef}
          />
          <button
            type="submit"
            className="w-full bg-green-500 text-white p-3 rounded-md font-bold hover:bg-green-600 transition duration-300"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Join Waitlist"}
          </button>
        </>
      )}
    </form>
  );
};

export default WaitlistForm;