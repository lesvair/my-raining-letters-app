// src/components/WaitlistForm.tsx

"use client" // This is crucial for client-side React hooks

import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha"; // Import the reCAPTCHA component

const WaitlistForm: React.FC = () => {
  // State variables for form inputs and UI feedback
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false); // To show success message
  const [error, setError] = useState<string | null>(null); // To display error messages
  const [isLoading, setIsLoading] = useState(false); // To show loading state on button

  // Reference for the reCAPTCHA component, so we can call its methods
  const captchaRef = useRef<ReCAPTCHA>(null);

  // Function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default browser form submission

    // Reset previous states before a new submission attempt
    setSubmitted(false);
    setError(null);
    setIsLoading(true);

    // --- reCAPTCHA Step: Get the token ---
    // This executes the reCAPTCHA check in the background and returns a token
    const recaptchaToken = await captchaRef.current?.executeAsync();

    // If no token is received (e.g., ad blocker, network issue), show an error
    if (!recaptchaToken) {
      setError("reCAPTCHA verification failed. Please try again or disable ad blockers.");
      setIsLoading(false);
      return; 
    }

    try {
      // --- API Call Step: Send data to your Next.js API route ---
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Tell the server we're sending JSON
        },
        // Send name, email, AND the recaptchaToken to the backend
        body: JSON.stringify({ name, email, recaptchaToken }),
      });

      // Parse the JSON response from your backend
      const result = await response.json();

      // Check if the HTTP response was successful (status 200-299)
      if (response.ok) {
        console.log('Server Success Response:', result); // Log success message from server
        setSubmitted(true); // Show the success message in the UI
        setName("");        // Clear the name input field
        setEmail("");       // Clear the email input field
      } else {
        // If the response was NOT ok, it's an error from the server
        console.error('Server Error Response:', result);

        // --- Error Handling: Display specific error messages ---
        if (response.status === 400) {
          // This typically means validation failed on the backend (e.g., invalid email format)
          setError(result.message || 'Validation error. Please check your inputs.');
        } else if (response.status === 403) {
          // This specific status is used for reCAPTCHA failure (Forbidden)
          setError(result.message || 'reCAPTCHA verification failed. Are you a bot?');
        } else if (response.status === 429) {
          // This specific status is for rate limiting (Too Many Requests)
          setError(result.message || 'Too many requests. Please try again later.');
        } else {
          // For any other unexpected server errors (e.g., 500 Internal Server Error)
          setError(result.message || 'An unexpected server error occurred.');
        }
      }
    } catch (err) {
      // This catch block handles network-related errors (e.g., server offline, no internet)
      console.error('Network Error during fetch:', err);
      setError('Could not connect to the server. Please check your internet connection.');
    } finally {
      // This block always runs after try/catch, whether successful or not
      setIsLoading(false); // Hide the loading state
      captchaRef.current?.reset(); // Reset reCAPTCHA for the next submission
    }
  };

  return (
    <div className="relative z-30 flex flex-col items-center justify-center p-8 bg-black bg-opacity-70 rounded-lg shadow-lg max-w-md mx-auto mt-16 border border-slate-700">
      <h2 
        className="text-[#00ff00] text-3xl font-bold tracking-wider mb-8 text-center" 
        style={{ fontFamily: 'monospace' }}
      >
        Join Our Waitlist
      </h2>

      {/* Conditional rendering for loading, error, and success messages */}
      {isLoading && (
        <p className="text-blue-400 text-lg mb-4" style={{ fontFamily: 'monospace' }}>
          Submitting...
        </p>
      )}

      {error && (
        <p className="text-red-500 text-lg mb-4 text-center" style={{ fontFamily: 'monospace' }}>
          Error: {error}
        </p>
      )}

      {submitted ? (
        <p 
          className="text-white text-lg text-center" 
          style={{ fontFamily: 'monospace' }}
        >
          Thanks for your interest! We will be in touch.
        </p>
      ) : (
        // Render the form if not yet submitted
        <form onSubmit={handleSubmit} className="w-full flex flex-col space-y-6">
          <div>
            <label 
              htmlFor="name" 
              className="block text-slate-400 text-sm mb-2" 
              style={{ fontFamily: 'monospace' }}
            >
              Name:
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-900 text-white border border-slate-700 rounded-md focus:outline-none focus:border-[#00ff00]"
              style={{ fontFamily: 'monospace' }}
              required // Client-side validation for UX
              disabled={isLoading} // Disable input while submitting
            />
          </div>
          
          <div>
            <label 
              htmlFor="email" 
              className="block text-slate-400 text-sm mb-2" 
              style={{ fontFamily: 'monospace' }}
            >
              Email:
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-900 text-white border border-slate-700 rounded-md focus:outline-none focus:border-[#00ff00]"
              style={{ fontFamily: 'monospace' }}
              required // Client-side validation for UX
              disabled={isLoading} // Disable input while submitting
            />
          </div>
          
          {/* Invisible reCAPTCHA component */}
          <ReCAPTCHA
            sitekey="6LfUvmgrAAAAABeGcHGEc7HP9huBu1CokYfsdbnr" // <<< IMPORTANT: Replace with your actual Site Key
            size="invisible" // reCAPTCHA v3 is designed to be invisible
            ref={captchaRef} // Link the ref to this component
          />

          <button
            type="submit"
            className="w-full py-3 px-6 bg-[#00ff00] text-black font-bold rounded-md hover:bg-green-600 transition-colors duration-200"
            style={{ fontFamily: 'monospace' }}
            disabled={isLoading} // Disable button while submitting
          >
            {isLoading ? 'Sending...' : 'Join Waitlist'} {/* Change button text based on loading state */}
          </button>
        </form>
      )}
    </div>
  );
};

export default WaitlistForm;