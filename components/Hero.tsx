import { memo } from 'react';

function Hero() {
  return (
    <section className="pt-32 md:pt-40 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-navy-900 mb-6 leading-tight">
          Make Money
          <br />
          <span className="text-navy-600">Today</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-navy-700 max-w-2xl mx-auto font-medium">
          Start your journey to financial freedom with our proven strategies and expert guidance
        </p>
      </div>
    </section>
  );
}

export default memo(Hero);

