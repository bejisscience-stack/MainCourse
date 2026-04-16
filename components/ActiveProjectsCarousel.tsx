"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ProjectCard from "@/components/ProjectCard";
import ProjectDetailsModal from "@/components/ProjectDetailsModal";
import {
  useActiveProjects,
  type ActiveProject,
} from "@/hooks/useActiveProjects";
import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "./ScrollReveal";

export default function ActiveProjectsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [slidesPerView, setSlidesPerView] = useState(3);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedProject, setSelectedProject] = useState<ActiveProject | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { projects, isLoading, error: projectsError } = useActiveProjects();
  const { t, isReady: translationsReady } = useI18n();

  useEffect(() => {
    const lgQuery = window.matchMedia("(min-width: 1280px)");
    const mdQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      if (lgQuery.matches) {
        setSlidesPerView(3);
      } else if (mdQuery.matches) {
        setSlidesPerView(2);
      } else {
        setSlidesPerView(1);
      }
    };
    handleChange();
    lgQuery.addEventListener("change", handleChange);
    mdQuery.addEventListener("change", handleChange);
    return () => {
      lgQuery.removeEventListener("change", handleChange);
      mdQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const max = Math.max(0, projects.length - slidesPerView);
    if (currentIndex > max) {
      setCurrentIndex(max);
    }
  }, [projects.length, slidesPerView, currentIndex]);

  useEffect(() => {
    if (projects.length <= slidesPerView) return;
    const maxIdx = Math.max(0, projects.length - slidesPerView);
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentIndex((prev) => (prev < maxIdx ? prev + 1 : 0));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered, projects.length, slidesPerView]);

  const handlePrevious = useCallback(() => {
    const maxIdx = Math.max(0, projects.length - slidesPerView);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIdx));
  }, [projects.length, slidesPerView]);

  const handleNext = useCallback(() => {
    const maxIdx = Math.max(0, projects.length - slidesPerView);
    setCurrentIndex((prev) => (prev < maxIdx ? prev + 1 : 0));
  }, [projects.length, slidesPerView]);

  const handleProjectClick = useCallback((project: ActiveProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProject(null);
  }, []);

  if (isLoading && projects.length === 0) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white text-center mb-12 tracking-tight">
              {t("activeProjects.title")}
            </h2>
          </ScrollReveal>
          <div className="flex items-center justify-center py-6">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          </div>
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
              {translationsReady
                ? t("activeProjects.title")
                : "Active Projects"}
            </h2>
          </ScrollReveal>
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl max-w-md text-center shadow-soft mx-auto">
            <p className="font-medium mb-2">
              {translationsReady
                ? t("activeProjects.errorLoading")
                : "Error Loading Projects"}
            </p>
            <p className="text-sm mb-4 text-red-600 dark:text-red-400">
              {projectsError.message ||
                (translationsReady
                  ? t("activeProjects.errorMessage")
                  : "An error occurred")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-charcoal-950 dark:bg-emerald-500 text-white px-5 py-2 rounded-full font-medium hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft text-sm"
            >
              {translationsReady ? t("common.retry") : "Retry"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  const gap = 20;
  const cardWidth =
    containerWidth > 0
      ? (containerWidth - (slidesPerView - 1) * gap) / slidesPerView
      : 0;
  const maxIndex = Math.max(0, projects.length - slidesPerView);
  const safeCurrentIndex = Math.min(currentIndex, maxIndex);
  const showArrows = projects.length > slidesPerView;
  const translateX = -safeCurrentIndex * (cardWidth + gap);

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal delay={0} duration={600}>
            <div className="text-center mb-12">
              <h2 className="inline-block text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
                {translationsReady
                  ? t("activeProjects.title")
                  : "Active Projects"}
              </h2>
              <p className="mt-3 text-lg text-charcoal-600 dark:text-gray-400">
                {projects.length}{" "}
                {translationsReady
                  ? t("activeProjects.projectsAvailable")
                  : "active projects available"}
              </p>
            </div>
          </ScrollReveal>

          <div className="relative">
            <div className="md:hidden flex flex-col gap-6 px-1">
              {projects
                .slice(0, showAllMobile ? undefined : 3)
                .map((project) => (
                  <div key={project.id} className="w-full">
                    <ProjectCard
                      project={project}
                      onClick={() => handleProjectClick(project)}
                    />
                  </div>
                ))}
              {projects.length > 3 && (
                <div className="flex justify-center mt-1">
                  <button
                    onClick={() => setShowAllMobile((prev) => !prev)}
                    className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-white dark:bg-navy-800 text-charcoal-600 dark:text-gray-300 border border-charcoal-200 dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-700 hover:text-charcoal-900 dark:hover:text-white shadow-sm"
                  >
                    {showAllMobile
                      ? translationsReady
                        ? t("common.showLess")
                        : "Show Less"
                      : translationsReady
                        ? t("common.showMore")
                        : "Show More"}
                  </button>
                </div>
              )}
            </div>

            <div className="hidden md:block relative">
              {showArrows && (
                <>
                  <button
                    onClick={handlePrevious}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 z-20 w-12 h-12 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl border border-charcoal-200 dark:border-navy-700 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors"
                    aria-label="Previous project"
                  >
                    <svg
                      className="w-5 h-5 text-charcoal-800 dark:text-gray-100"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
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
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 z-20 w-12 h-12 bg-white dark:bg-navy-800 rounded-full shadow-soft-xl border border-charcoal-200 dark:border-navy-700 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors"
                    aria-label="Next project"
                  >
                    <svg
                      className="w-5 h-5 text-charcoal-800 dark:text-gray-100"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
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

              <div
                ref={containerRef}
                className="overflow-hidden"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div
                  className="flex gap-5"
                  style={{
                    transform: `translateX(${translateX}px)`,
                    transition: "transform 450ms ease-in-out",
                  }}
                >
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex-shrink-0"
                      style={{
                        width:
                          cardWidth > 0
                            ? `${cardWidth}px`
                            : `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`,
                      }}
                    >
                      <ProjectCard
                        project={project}
                        onClick={() => handleProjectClick(project)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProjectDetailsModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
