# UI Changes Documentation

This document contains all the code changes made to improve the UI/UX of the MainCourse application.

## Overview

The changes focus on:
1. **Carousel Improvements**: Fixed sizing inconsistencies, enabled click-to-scroll navigation, and resolved selection issues
2. **Visual Enhancements**: Added gradients, improved shadows, and enhanced hover effects
3. **Payment Dialog Beautification**: Complete redesign of the enrollment wizard with improved step indicators, better layouts, and enhanced visual appeal
4. **Localization**: Added missing translation keys

---

## Modified Files

1. `components/CoursesCarousel.tsx`
2. `components/ActiveProjectsCarousel.tsx`
3. `components/CourseCard.tsx`
4. `components/ProjectCard.tsx`
5. `components/EnrollmentWizard.tsx`
6. `components/enrollment/EnrollmentStepOverview.tsx`
7. `components/enrollment/EnrollmentStepPayment.tsx`
8. `components/enrollment/EnrollmentStepReferral.tsx`
9. `components/enrollment/EnrollmentStepUpload.tsx`
10. `locales/en.json`

---

## Detailed Changes

### 1. `components/CoursesCarousel.tsx`

#### Changes Made:
- Added `handleCardClick` function to enable navigation by clicking on side course cards
- Updated card styling for consistent sizing and improved interactivity
- Removed `pointer-events-none` from side cards to enable click functionality

#### Code Changes:

**Added `handleCardClick` function (lines 111-119):**
```tsx
const handleCardClick = useCallback((index: number) => {
  if (courses.length >= 3) {
    if (index === 0) handlePrevious();
    if (index === 2) handleNext();
  } else {
    // For fewer courses, just set the index directly
    setCurrentIndex(index);
  }
}, [courses.length, handlePrevious, handleNext]);
```

**Updated card className (lines 258-262):**
```tsx
<div
  key={`${course.id}-${safeCurrentIndex}-${index}`}
  onClick={() => handleCardClick(index)}
  className={`transition-all duration-700 ease-out cursor-pointer ${
    isMiddle
      ? 'flex-1 max-w-lg scale-100 z-10 opacity-100'
      : 'flex-1 max-w-lg scale-95 opacity-70 z-0 hover:opacity-90'
  }`}
  style={{
    transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
  }}
>
```

---

### 2. `components/ActiveProjectsCarousel.tsx`

#### Changes Made:
- Added `handleCardClick` function identical to `CoursesCarousel.tsx`
- Updated card styling to match course carousel improvements
- Fixed the issue where it was impossible to select one of two projects

#### Code Changes:

**Added `handleCardClick` function (lines 63-70):**
```tsx
const handleCardClick = useCallback((index: number) => {
  if (projects.length >= 3) {
    if (index === 0) handlePrevious();
    if (index === 2) handleNext();
  } else {
    setCurrentIndex(index);
  }
}, [projects.length, handlePrevious, handleNext]);
```

**Updated card className (lines 211-215):**
```tsx
<div
  key={`${project.id}-${safeCurrentIndex}-${index}`}
  onClick={() => !isMiddle && handleCardClick(index)}
  className={`transition-all duration-700 ease-out ${
    isMiddle
      ? 'flex-1 max-w-lg scale-100 z-10 opacity-100'
      : 'flex-1 max-w-lg scale-95 opacity-70 z-0 cursor-pointer hover:opacity-90'
  }`}
  style={{
    transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
  }}
>
```

---

### 3. `components/CourseCard.tsx`

#### Changes Made:
- Added gradient background to main container
- Enhanced hover effects with emerald shadow accents
- Increased thumbnail section height from `h-28` to `h-32`

#### Code Changes:

**Updated main container (line 165):**
```tsx
<div className="h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 rounded-3xl overflow-hidden shadow-soft hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 transition-all duration-300 border border-charcoal-100/50 dark:border-navy-700/50 hover:scale-[1.02] hover:-translate-y-1 will-change-transform" style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}>
```

**Updated thumbnail height (line 167):**
```tsx
<div className="relative w-full h-32 bg-gradient-to-br from-emerald-50 via-white to-charcoal-50/30 dark:from-emerald-500/10 dark:via-navy-800 dark:to-navy-700/30 overflow-hidden cursor-pointer group">
```

---

### 4. `components/ProjectCard.tsx`

#### Changes Made:
- Added gradient background matching `CourseCard.tsx`
- Enhanced hover effects with emerald shadow accents
- Increased thumbnail section height from `h-24` to `h-28`

#### Code Changes:

**Updated main container (line 145):**
```tsx
<div
  onClick={handleClick}
  className={`h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 rounded-2xl overflow-hidden shadow-soft transition-all duration-300 border border-charcoal-100/50 dark:border-navy-700/50 ${
    isExpired
      ? 'opacity-60 grayscale cursor-not-allowed'
      : 'hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer'
  }`}
  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
>
```

**Updated thumbnail height (line 155):**
```tsx
<div className="relative w-full h-28 bg-gradient-to-br from-emerald-50 via-white to-charcoal-50/30 dark:from-emerald-500/10 dark:via-navy-800 dark:to-navy-700/30 overflow-hidden">
```

---

### 5. `components/EnrollmentWizard.tsx`

#### Changes Made:
- Added gradient background to main dialog content area
- Redesigned close button with glassmorphism effect
- Complete overhaul of progress indicator with absolute positioning for connecting lines
- Redesigned navigation buttons with gradients and enhanced shadows
- Fixed step label positioning for perfect horizontal centering

#### Code Changes:

**Updated dialog content background (line 379):**
```tsx
<div 
  ref={dialogRef}
  className="relative w-full min-h-full bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 flex flex-col"
  onClick={(e) => e.stopPropagation()}
>
```

**Updated close button (lines 383-401):**
```tsx
<button
  onClick={handleClose}
  className="fixed top-4 right-4 z-50 w-10 h-10 bg-white/80 dark:bg-navy-700/80 hover:bg-white dark:hover:bg-navy-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors shadow-soft backdrop-blur-sm border border-gray-100 dark:border-navy-600"
  aria-label={t('common.close')}
>
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
</button>
```

**Complete progress indicator redesign (lines 415-464):**
```tsx
{/* Progress Indicator */}
<div className="w-full relative px-2 md:px-6">
  {/* Connecting Line - Background */}
  <div className="absolute top-5 left-6 right-6 h-0.5 bg-gray-200 dark:bg-navy-700 -z-10 rounded-full" />
  
  {/* Connecting Line - Active Progress */}
  <div 
    className="absolute top-5 left-6 h-0.5 bg-emerald-500 -z-10 transition-all duration-500 ease-out rounded-full" 
    style={{ width: `calc(${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}% - 3rem)` }}
  />

  <div className="flex justify-between items-start">
    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
      <div key={step} className="flex flex-col items-center relative z-10 group cursor-default">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
            step < currentStep
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
              : step === currentStep
              ? 'bg-charcoal-950 dark:bg-emerald-500 text-white border-charcoal-950 dark:border-emerald-500 ring-4 ring-emerald-500/20 shadow-lg shadow-emerald-500/20 scale-110'
              : 'bg-white dark:bg-navy-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-navy-600'
          }`}
        >
          {step < currentStep ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </div>
        <span className={`text-xs mt-3 text-center font-semibold transition-colors duration-300 absolute top-full left-1/2 -translate-x-1/2 w-max ${
          step <= currentStep
            ? 'text-charcoal-950 dark:text-white'
            : 'text-gray-400 dark:text-gray-500'
        }`}>
          {step === 1 && t('enrollment.stepOverview')}
          {step === 2 && t('enrollment.stepPayment')}
          {step === 3 && t('enrollment.stepReferral')}
          {step === 4 && t('enrollment.stepUpload')}
          {step === 5 && t('enrollment.stepReview')}
        </span>
      </div>
    ))}
  </div>
  
  {/* Step Counter */}
  <div className="text-center text-sm text-charcoal-500 dark:text-gray-400 mt-12 font-medium">
    {t('enrollment.stepProgress', { current: currentStep, total: TOTAL_STEPS })}
  </div>
</div>
```

**Updated navigation buttons (lines 486-529):**
```tsx
{/* Navigation Buttons - Hidden on review step (step 5) */}
{currentStep < TOTAL_STEPS && (
  <div className="flex items-center justify-between pt-8 border-t border-gray-100 dark:border-navy-700/50">
    <div>
      {currentStep > 1 && (
        <button
          onClick={handleBack}
          className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 rounded-full hover:bg-gray-50 dark:hover:bg-navy-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>{t('common.back')}</span>
        </button>
      )}
    </div>
    <div className="flex items-center space-x-4">
      <button
        onClick={handleClose}
        className="px-8 py-3 text-base font-semibold text-charcoal-600 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-navy-700 rounded-full transition-colors"
      >
        {t('common.cancel')}
      </button>
      <button
        onClick={handleNext}
        disabled={!!stepErrors[currentStep] || isValidating}
        className="px-8 py-3 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-600 rounded-full hover:from-emerald-600 hover:to-emerald-700 dark:hover:from-emerald-600 dark:hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none flex items-center space-x-2"
      >
        {isValidating ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{t('common.validating') || 'Validating...'}</span>
          </>
        ) : (
          <>
            <span>{t('common.next')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
    </div>
  </div>
)}
```

---

### 6. `components/enrollment/EnrollmentStepOverview.tsx`

#### Changes Made:
- Updated card backgrounds with semi-transparent overlays
- Added initial character avatar for course creator
- Enhanced course type badges with emojis
- Improved borders and shadows for visual consistency

#### Code Changes:

**Updated Course Information Card (line 37):**
```tsx
<div className="bg-white/50 dark:bg-navy-800/50 rounded-2xl p-6 md:p-8 space-y-6 border border-charcoal-100/50 dark:border-navy-700/50 shadow-soft">
```

**Added creator avatar (lines 54-58):**
```tsx
<p className="text-lg font-semibold text-charcoal-950 dark:text-white flex items-center gap-2">
  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm">
    {course.creator.charAt(0)}
  </span>
  {course.creator}
</p>
```

**Updated course type badge (lines 80-84):**
```tsx
<span className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal-50 dark:bg-navy-700 border border-charcoal-100 dark:border-navy-600 text-charcoal-700 dark:text-gray-300 rounded-full text-sm font-semibold">
  {course.course_type === 'Editing' && '🎬'}
  {course.course_type === 'Content Creation' && '📱'}
  {course.course_type === 'Website Creation' && '💻'}
  {course.course_type}
</span>
```

**Updated Info Box (line 91):**
```tsx
<div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-5">
```

---

### 7. `components/enrollment/EnrollmentStepPayment.tsx`

#### Changes Made:
- Redesigned Account Number and Unique Course Code sections into distinct cards
- Added copy-to-clipboard buttons
- Made course code more prominent with larger font and tracking
- Enhanced payment instruction images with hover effects
- Updated Important Notice box styling

#### Code Changes:

**Updated Account Number card (lines 53-71):**
```tsx
<div className="bg-white/50 dark:bg-navy-800/50 rounded-2xl p-6 md:p-8 border border-charcoal-100/50 dark:border-navy-700/50 shadow-soft">
  <p className="text-sm font-medium uppercase tracking-wide text-charcoal-500 dark:text-gray-400 mb-3">
    {t('payment.accountNumber')}
  </p>
  <div className="flex items-center gap-3">
    <p className="text-2xl md:text-3xl font-mono font-bold text-charcoal-950 dark:text-white break-all tracking-tight">
      GE00BG0000000013231
    </p>
    <button 
      onClick={() => navigator.clipboard.writeText('GE00BG0000000013231')}
      className="p-2 hover:bg-charcoal-100 dark:hover:bg-navy-700 rounded-lg transition-colors text-charcoal-400 hover:text-charcoal-600 dark:text-gray-500 dark:hover:text-gray-300"
      title="Copy"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  </div>
</div>
```

**Updated Unique Course Code card (lines 74-98):**
```tsx
<div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 md:p-8 border border-emerald-100 dark:border-emerald-800/50">
  <p className="text-sm font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">
    {t('payment.uniqueCourseCode')}
  </p>
  <div className="flex items-center gap-3">
    <p className="text-4xl md:text-5xl font-mono font-bold text-charcoal-950 dark:text-white tracking-widest">
      {courseCode}
    </p>
    <button 
      onClick={() => navigator.clipboard.writeText(courseCode)}
      className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors text-emerald-600/60 hover:text-emerald-600 dark:text-emerald-500/60 dark:hover:text-emerald-400"
      title="Copy"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  </div>
  <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-4 flex items-center gap-2">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {t('payment.includeCodeInReference')}
  </p>
</div>
```

**Updated payment instruction images (lines 108-145):**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* First Instruction Image */}
  <div className="bg-white dark:bg-navy-800 border border-charcoal-100 dark:border-navy-700 rounded-2xl p-5 shadow-soft hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 rounded-full bg-charcoal-950 dark:bg-white text-white dark:text-charcoal-950 flex items-center justify-center font-bold text-sm">1</span>
      <p className="text-base font-semibold text-charcoal-950 dark:text-white">
        {t('payment.step1')}
      </p>
    </div>
    <div className="relative w-full bg-charcoal-50 dark:bg-navy-900 rounded-xl overflow-hidden border border-charcoal-100 dark:border-navy-700">
      <img
        src="/payment-instructions/payment-step-1.png"
        alt="Payment instruction step 1 - Enter account number GE00BG0000000013231"
        className="w-full h-auto object-contain block hover:scale-105 transition-transform duration-500"
        style={{ maxHeight: '600px' }}
        loading="lazy"
      />
    </div>
  </div>

  {/* Second Instruction Image */}
  <div className="bg-white dark:bg-navy-800 border border-charcoal-100 dark:border-navy-700 rounded-2xl p-5 shadow-soft hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 rounded-full bg-charcoal-950 dark:bg-white text-white dark:text-charcoal-950 flex items-center justify-center font-bold text-sm">2</span>
      <p className="text-base font-semibold text-charcoal-950 dark:text-white">
        {t('payment.step2')}
      </p>
    </div>
    <div className="relative w-full bg-charcoal-50 dark:bg-navy-900 rounded-xl overflow-hidden border border-charcoal-100 dark:border-navy-700">
      <img
        src="/payment-instructions/payment-step-2.png"
        alt="Payment instruction step 2 - Complete payment with unique code in description field"
        className="w-full h-auto object-contain block hover:scale-105 transition-transform duration-500"
        style={{ maxHeight: '600px' }}
        loading="lazy"
      />
    </div>
  </div>
</div>
```

**Updated Important Notice (lines 151-177):**
```tsx
<div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-5">
  <div className="flex items-start space-x-3">
    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
      <svg
        className="w-5 h-5 text-amber-600 dark:text-amber-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <div>
      <p className="text-base font-bold text-charcoal-950 dark:text-white">
        {t('enrollment.paymentImportantNotice')}
      </p>
      <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-1 leading-relaxed">
        {t('enrollment.paymentImportantDescription')}
      </p>
    </div>
  </div>
</div>
```

---

### 8. `components/enrollment/EnrollmentStepReferral.tsx`

#### Changes Made:
- Enhanced input field styling with larger padding and text size
- Improved focus ring styling
- Updated Info Box styling for consistency

#### Code Changes:

**Updated input field (lines 152-167):**
```tsx
<input
  type="text"
  value={data.referralCode}
  onChange={handleReferralCodeChange}
  placeholder={t('payment.referralCodePlaceholder') || 'Enter referral code (optional)'}
  className={`w-full px-5 py-4 text-lg bg-white dark:bg-navy-900 border rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 ${
    data.referralCode ? 'pr-24' : 'pr-5'
  } ${
    validationState === 'valid'
      ? 'border-emerald-500 dark:border-emerald-400'
      : validationState === 'invalid'
      ? 'border-red-500 dark:border-red-400'
      : 'border-charcoal-200 dark:border-navy-600 focus:border-emerald-500 dark:focus:border-emerald-400'
  }`}
  maxLength={20}
/>
```

**Updated Info Box (line 235):**
```tsx
<div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-5">
```

---

### 9. `components/enrollment/EnrollmentStepUpload.tsx`

#### Changes Made:
- Replaced default file input with custom-styled drag-and-drop area
- Improved image preview grid with aspect ratio and hover effects
- Added image numbering and delete button overlay
- Applied `file:hidden` and `title=""` to hide default browser text
- Updated Processing Time Notice and Error Message styling

#### Code Changes:

**Updated file input (lines 79-100):**
```tsx
<div className="relative group">
  <input
    type="file"
    accept="image/*"
    multiple
    onChange={handleFileSelect}
    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 file:hidden"
    title=""
  />
  <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-charcoal-200 dark:border-navy-600 rounded-xl bg-charcoal-50/50 dark:bg-navy-900/50 group-hover:bg-charcoal-100/50 dark:group-hover:bg-navy-800/50 group-hover:border-emerald-500/50 dark:group-hover:border-emerald-500/50 transition-all duration-200">
    <div className="w-12 h-12 bg-white dark:bg-navy-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-200">
      <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </div>
    <p className="text-base font-semibold text-charcoal-950 dark:text-white">
      {t('payment.chooseFiles') || 'Choose files'}
    </p>
    <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-1">
      {t('payment.uploadMultipleImages')}
    </p>
  </div>
</div>
```

**Updated image preview grid (lines 112-145):**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {data.uploadedImages.map((imageData, index) => (
    <div key={index} className="relative group aspect-[4/3]">
      <img
        src={imageData.preview}
        alt={`Transaction screenshot ${index + 1}`}
        className="w-full h-full object-cover rounded-xl border border-charcoal-100 dark:border-navy-600 shadow-sm"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
        <button
          onClick={() => handleRemoveImage(index)}
          className="w-10 h-10 bg-white/10 hover:bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all duration-200 transform hover:scale-110"
          aria-label={t('payment.removeImage')}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
        #{index + 1}
      </div>
    </div>
  ))}
</div>
```

**Updated Error Message (lines 151-158):**
```tsx
{error && (
  <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-300 px-5 py-4 rounded-xl text-base flex items-center gap-3">
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {error}
  </div>
)}
```

**Updated Processing Time Notice (lines 162-188):**
```tsx
<div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-5">
  <div className="flex items-start space-x-3">
    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
      <svg
        className="w-5 h-5 text-amber-600 dark:text-amber-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <div>
      <p className="text-base font-bold text-charcoal-950 dark:text-white">
        {t('payment.processingTime')}
      </p>
      <p className="text-sm text-charcoal-600 dark:text-gray-400 mt-1 leading-relaxed">
        {t('payment.processingTimeDescription')}
      </p>
    </div>
  </div>
</div>
```

---

### 10. `locales/en.json`

#### Changes Made:
- Added missing translation key for file upload UI

#### Code Changes:

**Added translation key (line 174):**
```json
"chooseFiles": "Choose files",
```

---

## Summary of Improvements

### Carousel Enhancements
- ✅ Fixed inconsistent card sizing (changed from `scale-80` to `scale-95` for side cards)
- ✅ Enabled click-to-scroll navigation on side cards
- ✅ Improved opacity and hover states for better visual feedback
- ✅ Fixed selection issue when only 2 projects are displayed

### Visual Polish
- ✅ Added gradient backgrounds to cards (`bg-gradient-to-br from-white to-gray-50`)
- ✅ Enhanced hover effects with emerald shadow accents
- ✅ Increased thumbnail heights for better visual balance
- ✅ Improved border and shadow consistency across components

### Payment Dialog Improvements
- ✅ Complete redesign of progress indicator with absolute positioning
- ✅ Fixed step label alignment using `left-1/2 -translate-x-1/2`
- ✅ Added glassmorphism effect to close button
- ✅ Redesigned navigation buttons with gradients
- ✅ Enhanced payment instruction cards with copy buttons
- ✅ Improved file upload UI with custom drag-and-drop area
- ✅ Better image preview grid with hover effects and numbering

### Localization
- ✅ Added missing `payment.chooseFiles` translation key
- ✅ Hidden default browser file input text using `file:hidden` and `title=""`

---

## Technical Notes

### Key CSS Classes Used:
- `bg-gradient-to-br`: Creates diagonal gradient backgrounds
- `hover:shadow-xl hover:shadow-emerald-500/10`: Enhanced hover shadows
- `scale-95`, `scale-100`, `scale-110`: Consistent scaling for carousel items
- `opacity-70`, `opacity-100`: Opacity transitions for side cards
- `absolute top-full left-1/2 -translate-x-1/2`: Perfect centering for step labels
- `file:hidden`: Hides default file input text
- `backdrop-blur-sm`: Glassmorphism effect

### Accessibility:
- All interactive elements include proper `aria-label` attributes
- Keyboard navigation support maintained
- Focus states clearly visible with ring utilities

---

## Testing Recommendations

1. **Carousel Navigation**: Test clicking on side cards to ensure navigation works correctly
2. **Two-Item Selection**: Verify that both projects can be selected when only 2 are displayed
3. **Step Indicator**: Check step label alignment across different screen sizes
4. **File Upload**: Verify that default browser text is hidden and custom UI is visible
5. **Dark Mode**: Test all changes in both light and dark modes
6. **Responsive Design**: Verify changes work correctly on mobile, tablet, and desktop

---

*Document generated on: January 28, 2026*
