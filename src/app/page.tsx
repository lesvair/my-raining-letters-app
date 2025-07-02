"use client"

import dynamic from "next/dynamic"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"

const DynamicWaitlistForm = dynamic(() => import('@/components/waitlistform'), {
    ssr: false, // Ensure it's only rendered on the client side
    loading: () => <p>Loading form...</p>, // Optional loading state
});

interface Character {
  char: string;
  x: number; // Will now be pixel values or relative to container
  y: number; // Will now be pixel values or relative to container
  speed: number;
  originalX: number; // Store original for percentage-based reset, if needed
  originalY: number; // Store original for percentage-based reset, if needed
}

class TextScramble {
  el: HTMLElement
  chars: string
  queue: Array<{
    from: string
    to: string
    start: number
    end: number
    char?: string
  }>
  frame: number
  frameRequest: number
  resolve: (value: void | PromiseLike<void>) => void

  constructor(el: HTMLElement) {
    this.el = el
    this.chars = '!<>-_\\/[]{}—=+*^?#'
    this.queue = []
    this.frame = 0
    this.frameRequest = 0
    this.resolve = () => {}
    this.update = this.update.bind(this)
  }

  setText(newText: string) {
    const oldText = this.el.innerText
    const length = Math.max(oldText.length, newText.length)
    const promise = new Promise<void>((resolve) => this.resolve = resolve)
    this.queue = []
    
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || ''
      const to = newText[i] || ''
      const start = Math.floor(Math.random() * 30)
      const end = start + Math.floor(Math.random() * 30)
      this.queue.push({ from, to, start, end })
    }
    
    cancelAnimationFrame(this.frameRequest)
    this.frame = 0
    this.update()
    return promise
  }

  update() {
    let output = ''
    let complete = 0
    
    for (let i = 0, n = this.queue.length; i < n; i++) {
      const { from, to, start, end} = this.queue[i]
      let char = this.queue[i].char || ''

      if (this.frame >= end) {
        complete++
        output += to
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.chars[Math.floor(Math.random() * this.chars.length)]
          this.queue[i].char = char
        }
        output += `<span class="dud">${char}</span>`
      } else {
        output += from
      }
    }
    
    this.el.innerHTML = output
    if (complete === this.queue.length) {
      this.resolve()
    } else {
      this.frameRequest = requestAnimationFrame(this.update)
      this.frame++
    }
  }
}

const ScrambledTitle: React.FC = () => {
  const elementRef = useRef<HTMLHeadingElement>(null)
  const scramblerRef = useRef<TextScramble | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (elementRef.current && !scramblerRef.current) {
      scramblerRef.current = new TextScramble(elementRef.current)
      setMounted(true)
    }
  }, [])

  useEffect(() => {
    if (mounted && scramblerRef.current) {
      const phrases = [
        'keeping you safe',
        'today and\ tomorrow',
        'that\ is\ Securoso',
        '',
      ]
      
      let counter = 0
      const next = () => {
        if (scramblerRef.current) {
          scramblerRef.current.setText(phrases[counter]).then(() => {
            setTimeout(next, 900)
          })
          counter = (counter + 1) % phrases.length
        }
      }

      next()
    }
  }, [mounted])

  return (
    <h1 
      ref={elementRef}
      className="text-white text-6xl font-bold tracking-wider justify-center"
      style={{ fontFamily: 'monospace' }}
    >
      securoso
    </h1>
  )
}

const RainingLetters: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());
  const animationContainerRef = useRef<HTMLDivElement>(null); // Ref to the animation container
  const [isMobile, setIsMobile] = useState(false); // New state to track mobile status

  // --- CHANGE 1: Detect Mobile Device ---
  // This useEffect runs once on mount to determine if it's a mobile device.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        // Adjust breakpoint as needed. Common mobile breakpoint is 768px.
        setIsMobile(window.innerWidth <= 768);
      };
      // Initial check
      handleResize();
      // Listen for window resize to update mobile status
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // --- CHANGE 2: Conditional Character Count and Initial Positioning ---
  const createCharacters = useCallback(() => {
    const allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
    // Reduced charCount for mobile. Desktop will still have 100 characters.
    const charCount = isMobile ? 40 : 100; // Drastically reduced for mobile
    const newCharacters: Character[] = [];

    // Get container dimensions for pixel-based positioning
    const containerWidth = animationContainerRef.current?.offsetWidth || window.innerWidth;
    const containerHeight = animationContainerRef.current?.offsetHeight || window.innerHeight;

    for (let i = 0; i < charCount; i++) {
      // Position characters using pixel values relative to the container.
      // This is crucial for avoiding layout shifts.
      const startX = Math.random() * containerWidth;
      const startY = Math.random() * containerHeight;

      newCharacters.push({
        char: allChars[Math.floor(Math.random() * allChars.length)],
        x: startX,
        y: startY,
        speed: 0.4 + Math.random() * 0.4,
        originalX: startX, // Store original for reset if needed
        originalY: startY,
      })
    }
    return newCharacters
  }, [isMobile]); // Recreate characters if mobile state changes

  useEffect(() => {
    // Only create characters if the container ref is available or on mobile
    // This handles the case where the container might not be immediately available on mount
    if (animationContainerRef.current) {
      setCharacters(createCharacters());
    }
  }, [createCharacters]);


  // --- CHANGE 3: Optimize Flicker Interval ---
  useEffect(() => {
    const updateActiveIndices = () => {
      const newActiveIndices = new Set<number>()
      const numActive = Math.floor(Math.random() * 1.5) + 1.5
      for (let i = 0; i < numActive; i++) {
        newActiveIndices.add(Math.floor(Math.random() * characters.length))
      }
      setActiveIndices(newActiveIndices)
    }
    // Increased interval for less frequent flickering, reducing CPU load.
    const flickerInterval = setInterval(updateActiveIndices, isMobile ? 250 : 125); // Slower flicker on mobile
    return () => clearInterval(flickerInterval)
  }, [characters.length, isMobile]); // Dependency on isMobile

  // --- CHANGE 4: Refactor `updatePositions` for Composited Animation ---
  useEffect(() => {
    let animationFrameId: number;
    const containerHeight = animationContainerRef.current?.offsetHeight || window.innerHeight;

    const updatePositions = () => {
      setCharacters(prevChars => 
        prevChars.map(char => {
          const newY = char.y + char.speed;
          // When character goes off-screen, reset its position
          if (newY >= containerHeight) {
            const containerWidth = animationContainerRef.current?.offsetWidth || window.innerWidth;
            return {
              ...char,
              y: -50, // Start slightly above the top of the container (adjust as needed)
              x: Math.random() * containerWidth, // New random X
              char: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"[
                Math.floor(Math.random() * "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?".length)
              ],
            };
          }
          return {
            ...char,
            y: newY,
          };
        })
      );
      animationFrameId = requestAnimationFrame(updatePositions);
    };

    animationFrameId = requestAnimationFrame(updatePositions);
    return () => cancelAnimationFrame(animationFrameId);
  }, [animationContainerRef]); // Dependency on ref to get current dimensions


  return (
    <main>
      
    {/* --- CHANGE 5: Attach ref to the animation container --- */}
    <div ref={animationContainerRef} className="relative w-full h-screen bg-black overflow-hidden">
      {/* Title */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <ScrambledTitle />
      </div>

      {/* Raining Characters */}
      {characters.map((char, index) => (
        <span
          key={index}
          className={`absolute transition-colors duration-100 ${
            activeIndices.has(index)
              ? "text-[#00ff00] z-10 font-bold animate-pulse" // Removed text-base scale-125 here
              : "text-slate-600 font-light"
          }`}
          style={{
            // --- CHANGE 6: Use only `transform: translate()` for positioning ---
            // Combine initial position with dynamic movement.
            // Using pixel values directly for transform: translate,
            // and using scale for active state changes ensures composited animation.
            transform: `translate(${char.x}px, ${char.y}px) ${activeIndices.has(index) ? 'scale(1.25)' : 'scale(1)'}`,
            // --- CHANGE 7: Simplify/remove text-shadow animation if possible (optional but good) ---
            textShadow: activeIndices.has(index)
              ? '0 0 8px rgba(0,255,0,0.8), 0 0 12px rgba(0,255,0,0.4)' // Changed white shadow to green glow
              : 'none',
            opacity: activeIndices.has(index) ? 1 : 0.4,
            transition: 'color 0.1s, transform 0.1s, opacity 0.1s', // Removed text-shadow from transition
            willChange: 'transform, opacity', // Only these properties should trigger composited layers
            // --- CHANGE 8: Control font size via CSS class or fixed pixel value ---
            // Avoid dynamically changing font-size in style attribute for animation, as it causes layout shifts.
            // If you want size difference, rely solely on `transform: scale()`.
            fontSize: isMobile ? '1.2rem' : '1.8rem', // Smaller letters on mobile
          }}
        >
          {char.char}
        </span>
      ))}

      {/* No changes needed to the global style block for this */}
      <style jsx global>{`
        .dud {
          color: #0f0;
          opacity: 0.7;
        }
      `}</style>
    </div>

     {/* This div acts as a container for your WaitlistForm, pushing it below the animation. */}
      <div className="w-full bg-black py-20 flex justify-center items-center flex-grow"> 
        <DynamicWaitlistForm /> {/* Use the dynamically imported component */}
      </div>
    </main>
  );
}

export default RainingLetters