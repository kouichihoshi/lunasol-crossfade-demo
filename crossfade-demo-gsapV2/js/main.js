(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  const clamp = gsap.utils.clamp;

  const AXIS_COUNT = 4;
  const SECTION_HEIGHT = '620vh';
  const HERO_END = 0.13;
  const MORPH_END = 0.40;
  const MORPH_DUR = MORPH_END - HERO_END;
  const CROSS_DUR = 1 - MORPH_END;

  const COPY = { STEP: 0.8, SPREAD: 1.5, OFFSET: 0.12 };

  const TRACKER = {
    MAX_WIDTH: 258,
    WIDTH_RATIO: 0.235,
    MARGIN_MIN: 28,
    MARGIN_MAX: 120,
    MARGIN_RATIO: 0.07,
  };

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const section = document.getElementById('section');
  const stage = document.getElementById('stage');
  const titleEl = document.getElementById('htitle');
  const introCopyEl = document.getElementById('hcopy');
  const scrollCueEl = document.getElementById('hcue');
  const diagramEl = document.getElementById('hdiagram');
  const axisCircles = gsap.utils.toArray('.hcircle', stage);
  const axisLabels = axisCircles.map((circle) => circle.querySelector('.htx'));
  const axisNumbers = axisCircles.map((circle) => circle.querySelector('.hnum'));
  const backgrounds = gsap.utils.toArray('.bg', stage);
  const slideCopies = gsap.utils.toArray('.slidecopy', stage);
  const counterEl = document.getElementById('cur');
  const patternCtrl = document.getElementById('ctrl');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let activeAxis = -1;
  let timeline;

  const geometry = { deltaX: 0, deltaY: 0, scale: 1 };
  const cross = { axis: 0 };

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------

  function measureGeometry() {
    gsap.set(diagramEl, { clearProps: 'transform' });
    gsap.set(diagramEl, { yPercent: -50 });

    const stageRect = stage.getBoundingClientRect();
    const diagramRect = diagramEl.getBoundingClientRect();
    const heroCenterX = diagramRect.left + diagramRect.width / 2 - stageRect.left;
    const heroCenterY = diagramRect.top + diagramRect.height / 2 - stageRect.top;

    const trackerWidth = Math.min(TRACKER.MAX_WIDTH, window.innerWidth * TRACKER.WIDTH_RATIO);
    const leftMargin = clamp(
      TRACKER.MARGIN_MIN,
      TRACKER.MARGIN_MAX,
      window.innerWidth * TRACKER.MARGIN_RATIO,
    );

    geometry.deltaX = leftMargin + trackerWidth / 2 - heroCenterX;
    geometry.deltaY = window.innerHeight * 0.5 - heroCenterY;
    geometry.scale = trackerWidth / diagramRect.width;
  }

  // ---------------------------------------------------------------------------
  // Visual helpers
  // ---------------------------------------------------------------------------

  function setActiveAxis(index) {
    if (index === activeAxis) return;
    activeAxis = index;
    backgrounds.forEach((bg, i) => bg.classList.toggle('on', i === index));
    counterEl.textContent = '0' + (index + 1);
  }

  function setAxisHighlight(index) {
    axisCircles.forEach((circle, i) => {
      circle.classList.toggle('act', i === index);
      circle.classList.toggle('dim', i !== index);
    });
  }

  function clearAxisHighlight() {
    axisCircles.forEach((circle) => circle.classList.remove('act', 'dim'));
  }

  function resetBackgroundStyles() {
    backgrounds.forEach((bg) => {
      bg.classList.remove('on');
      bg.style.opacity = '';
      bg.style.transition = '';
    });
    activeAxis = -1;
  }

  function setHeroPhase() {
    stage.dataset.phase = 'hero';
    clearAxisHighlight();
    resetBackgroundStyles();
  }

  function syncMorphHighlight(scrollProgress) {
    const local = (scrollProgress - HERO_END) / MORPH_DUR;
    if (local < 0.65) clearAxisHighlight();
    else {
      axisCircles.forEach((circle, i) => {
        circle.classList.toggle('act', i === 0);
        circle.classList.toggle('dim', i !== 0);
      });
    }
  }

  function syncCrossVisuals() {
    const index = clamp(0, AXIS_COUNT - 1, Math.round(cross.axis));
    setActiveAxis(index);
    setAxisHighlight(index);

    const step = window.innerHeight * COPY.STEP;
    slideCopies.forEach((copy, i) => {
      const offset = i - cross.axis;
      const fade = clamp(0, 1, 1 - (Math.abs(offset) * COPY.SPREAD - COPY.OFFSET));
      gsap.set(copy, {
        yPercent: -50,
        y: offset * step,
        opacity: fade,
        visibility: fade > 0 ? 'visible' : 'hidden',
      });
    });
  }

  // ---------------------------------------------------------------------------
  // GSAP timeline (Hero hold + Morph scrub + Cross scrub)
  // ---------------------------------------------------------------------------

  function buildTimeline() {
    gsap.set(titleEl, { xPercent: -50, opacity: 1, y: 0 });
    gsap.set(introCopyEl, { yPercent: -50, opacity: 1, y: 0 });
    gsap.set(scrollCueEl, { opacity: 1 });
    gsap.set(diagramEl, { yPercent: -50, x: 0, y: 0, scale: 1 });
    gsap.set(axisLabels, { opacity: 1 });
    gsap.set(axisNumbers, { opacity: 0 });
    gsap.set(slideCopies, { opacity: 0, visibility: 'hidden', yPercent: -50, y: 0 });
    gsap.set(backgrounds, { opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const progress = self.progress;
          if (progress <= HERO_END) setHeroPhase();
          else if (progress < MORPH_END) syncMorphHighlight(progress);
        },
      },
    });

    // Hero — hold initial layout
    tl.to({}, { duration: HERO_END });

    // Morph — diagram move, hero fade-out, axis 1 reveal
    tl.addLabel('morph', HERO_END);
    tl.to(
      [titleEl, introCopyEl, scrollCueEl],
      { opacity: 0, y: -20, duration: 0.1, ease: 'power2.in' },
      'morph',
    );
    tl.to(
      diagramEl,
      {
        x: () => geometry.deltaX,
        y: () => geometry.deltaY,
        scale: () => geometry.scale,
        yPercent: -50,
        duration: MORPH_DUR,
        ease: 'power2.inOut',
        onStart: () => { stage.dataset.phase = 'morph'; },
      },
      'morph',
    );
    tl.to(axisLabels, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 'morph+=0.04');
    tl.to(axisNumbers, { opacity: 1, duration: 0.12, ease: 'power1.out' }, 'morph+=0.10');
    tl.to(
      backgrounds[0],
      {
        opacity: 1,
        duration: 0.14,
        ease: 'power2.out',
        onStart: () => { backgrounds[0].style.transition = 'none'; },
      },
      'morph+=0.08',
    );
    tl.to(
      slideCopies[0],
      { opacity: 1, visibility: 'visible', duration: 0.08, ease: 'power1.out' },
      'morph+=0.18',
    );

    // Cross — scrub axis index; backgrounds & copies follow via onUpdate
    tl.addLabel('cross', MORPH_END);
    tl.to(
      cross,
      {
        axis: AXIS_COUNT - 1,
        duration: CROSS_DUR,
        ease: 'none',
        onStart: () => {
          stage.dataset.phase = 'cross';
          backgrounds.forEach((bg) => {
            bg.style.opacity = '';
            bg.style.transition = '';
          });
          gsap.set(axisLabels, { opacity: 0 });
          gsap.set(axisNumbers, { opacity: 1 });
        },
        onUpdate: syncCrossVisuals,
      },
      'cross',
    );

    return tl;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    section.style.height = SECTION_HEIGHT;
    measureGeometry();

    ScrollTrigger.addEventListener('refreshInit', measureGeometry);

    timeline?.scrollTrigger?.kill();
    timeline?.kill();
    timeline = buildTimeline();

    patternCtrl.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      stage.dataset.pattern = button.dataset.p;
      patternCtrl.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('act', btn === button);
      });
    });
  }

  init();
})();
