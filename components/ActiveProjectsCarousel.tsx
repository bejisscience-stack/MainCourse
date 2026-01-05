'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import ProjectCard from '@/components/ProjectCard';
import ProjectDetailsModal from '@/components/ProjectDetailsModal';
import { useActiveProjects, type ActiveProject } from '@/hooks/useActiveProjects';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollReveal } from './ScrollReveal';

export default function ActiveProjectsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProject, setSelectedProject] = useState<ActiveProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { projects, isLoading, error: projectsError } = useActiveProjects();
  const { t, isReady: translationsReady } = useI18n();

  // Reset currentIndex when projects change
  useEffect(() => {
    if (projects.length > 0 && currentIndex >= projects.length) {
      setCurrentIndex(0);
    }
  }, [projects.length, currentIndex]);

  // Get 3 projects to display (previous, current, next)
  const displayedProjects = useMemo(() => {
    if (projects.length === 0) return [];

    // If we have less than 3 projects, just show what we have
    if (projects.length < 3) {
      return projects;
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : projects.length - 1;
    const nextIndex = currentIndex < projects.length - 1 ? currentIndex + 1 : 0;

    return [
      projects[prevIndex],
      projects[currentIndex],
      projects[nextIndex],
    ];
  }, [projects, currentIndex]);

  const handlePrevious = useCallback(() => {
    if (projects.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : projects.length - 1));
  }, [projects.length]);

  const handleNext = useCallback(() => {
    if (projects.length === 0) return;
    setCurrentIndex((prev) => (prev < projects.length - 1 ? prev + 1 : 0));
  }, [projects.length]);

  const handleProjectClick = useCallback((project: ActiveProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProject(null);
  }, []);

  // Don't render anything while loading or if no projects
  if (isLoading || !translationsReady) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {translationsReady ? t('activeProjects.title') : 'Active Projects'}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100} duration={600}>
            <div className="flex items-center justify-center">
              <div className="text-charcoal-500 dark:text-gray-400">
                {translationsReady ? t('activeProjects.loading') : 'Loading projects...'}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  if (projectsError) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {translationsReady ? t('activeProjects.title') : 'Active Projects'}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100} duration={600}>
            <div className="flex flex-col items-center justify-center">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl max-w-md text-center shadow-soft">
                <p className="font-medium mb-2">
                  {translationsReady ? t('activeProjects.errorLoading') : 'Error Loading Projects'}
                </p>
                <p className="text-sm mb-4 text-red-600 dark:text-red-400">
                  {projectsError.message || (translationsReady ? t('activeProjects.errorMessage') : 'An error occurred')}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-charcoal-950 dark:bg-emerald-500 text-white px-5 py-2 rounded-full font-medium hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft text-sm"
                >
                  {translationsReady ? t('common.retry') : 'Retry'}
                </button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  // Don't show section if no active projects
  if (projects.length === 0) {
    return null;
  }

  // Ensure currentIndex is within bounds
  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, projects.length - 1));

  // Show arrows if we have 3+ projects (so we can navigate through them)
  const showArrows = projects.length >= 3;

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <div className="text-center mb-12">
              <h2 className="inline-block text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
                {translationsReady ? t('activeProjects.title') : 'Active Projects'}
              </h2>
              <p className="mt-3 text-lg text-charcoal-600 dark:text-gray-400">
                {projects.length} {translationsReady ? t('activeProjects.projectsAvailable') : 'active projects available'}
              </p>
            </div>
          </ScrollReveal>

          <div className="relative">
            {/* Navigation Arrows - Show when we have 3+ projects */}
            {showArrows && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 md:-translate-x-10 z-30 w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl dark:shadow-glow-dark flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-charcoal-100/50 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 group will-change-transform"
                  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
                  aria-label="Previous project"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7 text-charcoal-950 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <button
                  onClick={handleNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 md:translate-x-10 z-30 w-14 h-14 md:w-16 md:h-16 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl dark:shadow-glow-dark flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-charcoal-100/50 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-400 group will-change-transform"
                  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
                  aria-label="Next project"
                >
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7 text-charcoal-950 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Projects Container */}
            <div className="flex items-center justify-center gap-6 md:gap-8 lg:gap-10 px-16 md:px-20 lg:px-24 overflow-hidden">
              {displayedProjects.map((project, index) => {
                // Middle project is always at index 1 if we have 3 projects
                // If we have fewer projects, center the first one
                const isMiddle = projects.length >= 3 ? index === 1 : projects.length === 1 ? index === 0 : index === Math.floor(projects.length / 2);

                return (
                  <div
                    key={`${project.id}-${safeCurrentIndex}-${index}`}
                    className={`transition-all duration-700 ease-out ${
                      isMiddle
                        ? 'flex-1 max-w-lg scale-100 z-10 opacity-100'
                        : 'flex-1 max-w-md scale-80 opacity-50 z-0 pointer-events-none'
                    }`}
                    style={{
                      transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <ProjectCard
                      project={project}
                      onClick={() => isMiddle && handleProjectClick(project)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Project Details Modal */}
      <ProjectDetailsModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
