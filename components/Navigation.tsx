'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-navy-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg md:text-xl">C</span>
            </div>
            <span className="text-navy-900 font-bold text-xl md:text-2xl">Course</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#about" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
              About
            </Link>
            <Link href="#courses" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
              Courses
            </Link>
            <Link href="#testimonials" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
              Testimonials
            </Link>
            <Link href="#contact" className="text-navy-700 hover:text-navy-900 font-medium transition-colors">
              Contact
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/login"
              className="text-navy-900 font-semibold hover:text-navy-700 transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="bg-navy-900 text-white font-semibold px-6 py-2 rounded-lg hover:bg-navy-800 transition-colors"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-navy-900 focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-navy-100">
            <div className="flex flex-col space-y-4">
              <Link
                href="#about"
                className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="#courses"
                className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Courses
              </Link>
              <Link
                href="#testimonials"
                className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Testimonials
              </Link>
              <Link
                href="#contact"
                className="text-navy-700 hover:text-navy-900 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              <div className="pt-4 border-t border-navy-100 flex flex-col space-y-2">
                <Link
                  href="/login"
                  className="text-navy-900 font-semibold text-center py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="bg-navy-900 text-white font-semibold text-center py-2 rounded-lg hover:bg-navy-800 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

