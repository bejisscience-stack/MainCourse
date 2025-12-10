import { memo } from 'react';

function BackgroundShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Light texture overlay - optimized with will-change */}
      <div 
        className="absolute inset-0 opacity-30 will-change-auto" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23102a43' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Abstract 3D Shapes - reduced blur for better performance */}
      <div className="absolute top-20 -left-20 w-64 h-64 md:w-96 md:h-96 bg-navy-100 rounded-full blur-2xl opacity-20 will-change-auto"></div>
      <div className="absolute top-40 right-10 w-48 h-48 md:w-72 md:h-72 bg-navy-200 rounded-full blur-2xl opacity-15 will-change-auto"></div>
      <div className="absolute bottom-20 left-1/4 w-56 h-56 md:w-80 md:h-80 bg-navy-200 rounded-full blur-2xl opacity-20 will-change-auto"></div>
      <div className="absolute bottom-40 right-1/4 w-40 h-40 md:w-64 md:h-64 bg-navy-100 rounded-full blur-2xl opacity-15 will-change-auto"></div>

      {/* Geometric shapes - reduced blur */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 md:w-48 md:h-48">
        <div className="w-full h-full bg-navy-200/10 rotate-45 rounded-lg blur-lg will-change-auto"></div>
      </div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-24 md:w-40 md:h-40">
        <div className="w-full h-full bg-navy-300/10 -rotate-12 rounded-2xl blur-lg will-change-auto"></div>
      </div>
    </div>
  );
}

export default memo(BackgroundShapes);

