(() => {
  'use strict';

  const PROJECTS = [
    {
      number: '01',
      kind: 'PUBLIC REALM · ABU DHABI',
      title: 'Abu Dhabi Corniche',
      lead: 'A public shoreline shaped for everyday life.',
      description: 'A landmark public-beach project where robust infrastructure, planting and civic space come together along the capital’s waterfront.',
      image: '/assets/real/master/corniche-new.jpg',
      imageAlt: 'Abu Dhabi Corniche public realm landscape',
      position: 'center center'
    },
    {
      number: '02',
      kind: 'CULTURAL HERITAGE · SAADIYAT ISLAND',
      title: 'Louvre Abu Dhabi',
      lead: 'Landscape that frames a global cultural landmark.',
      description: 'External works and planting establish a calm, precise approach to Jean Nouvel’s museum — a threshold between the city, sea and art.',
      image: '/assets/real/Louvre_Abu_Dhabi/04_louvre_approach.jpg',
      imageAlt: 'Louvre Abu Dhabi exterior approach',
      position: 'center center'
    },
    {
      number: '03',
      kind: 'LANDSCAPING · ABU DHABI',
      title: 'Zayed National Museum',
      lead: 'A living landscape for a new national icon.',
      description: 'Irrigation, planting and car-park works are integrated into an enduring landscape that supports the museum’s architecture and visitor experience.',
      image: '/assets/real/zayed-national-museum.jpg',
      imageAlt: 'Zayed National Museum landscape',
      position: 'center center'
    }
  ];

  function makeSlide(project, index) {
    const panel = document.createElement('article');
    panel.className = `project-slide project-slide--${index + 1}`;
    panel.setAttribute('aria-label', `${project.number} ${project.title}`);
    panel.style.setProperty('--slide-index', String(index + 2));
    panel.innerHTML = `
      <div class="project-slide__wash" aria-hidden="true"></div>
      <div class="project-slide__content">
        <p class="project-slide__eyebrow reveal">FEATURED PROJECTS</p>
        <div class="project-slide__headline reveal">
          <span class="project-slide__number">${project.number}</span>
          <p class="project-slide__kind">${project.kind}</p>
          <h2>${project.title}</h2>
        </div>
        <div class="project-slide__copy reveal">
          <p class="project-slide__lead">${project.lead}</p>
          <p class="project-slide__description">${project.description}</p>
          <a class="project-slide__link" href="#all-projects">Explore the portfolio <span aria-hidden="true">↘</span></a>
        </div>
        <p class="project-slide__count reveal" aria-label="Slide ${index + 1} of ${PROJECTS.length}">${String(index + 1).padStart(2, '0')}<span> / ${String(PROJECTS.length).padStart(2, '0')}</span></p>
      </div>
      <figure class="project-slide__media">
        <img src="${project.image}" alt="${project.imageAlt}" loading="${index === 0 ? 'eager' : 'lazy'}" style="object-position:${project.position}">
        <figcaption>${project.title}</figcaption>
      </figure>`;
    return panel;
  }

  function build() {
    if (document.querySelector('.project-slides') || !document.getElementById('root')) return true;

    const headings = [...document.querySelectorAll('#root h1, #root h2, #root h3')];
    const allProjectsHeading = headings.find((heading) => heading.textContent.replace(/\s+/g, ' ').trim() === 'Our Projects');
    if (!allProjectsHeading) return false;

    allProjectsHeading.id = 'all-projects';
    allProjectsHeading.setAttribute('tabindex', '-1');

    const section = document.createElement('section');
    section.className = 'project-slides';
    section.id = 'featured-projects';
    section.setAttribute('aria-label', 'Featured projects');
    section.innerHTML = `<div class="project-slides__intro"><p>SELECTED WORK</p><span>Scroll to explore</span></div>`;
    PROJECTS.forEach((project, index) => section.appendChild(makeSlide(project, index)));

    const host = allProjectsHeading.closest('section') || allProjectsHeading.parentElement?.parentElement;
    if (!host) return false;
    host.before(section);

    // The application mounts asynchronously, so complete direct links after the section exists.
    if (location.hash === '#featured-projects') {
      requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
    }

    const slides = [...section.querySelectorAll('.project-slide')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          slides.forEach((slide) => slide.classList.toggle('is-active', slide === entry.target));
        }
      });
    }, { threshold: 0.58 });
    slides.forEach((slide) => observer.observe(slide));

    section.querySelectorAll('a[href="#all-projects"]').forEach((link) => {
      link.addEventListener('click', () => {
        requestAnimationFrame(() => document.getElementById('all-projects')?.focus({ preventScroll: true }));
      });
    });
    return true;
  }

  let attempts = 0;
  const boot = () => {
    if (build() || attempts++ > 150) return;
    window.setTimeout(boot, 200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
