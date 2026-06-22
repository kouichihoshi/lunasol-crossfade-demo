(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  const clamp = gsap.utils.clamp;

  // ---------------------------------------------------------------------------
  // Constants (shared with vanilla version)
  // ---------------------------------------------------------------------------

  const AXIS_COUNT = 4;
  const SECTION_HEIGHT = '620vh';

  const PHASE = {
    HERO_END: 0.13,
    MORPH_END: 0.40,
  };

  const MORPH = {
    TITLE_LIFT_DURATION: 0.4,
    SCROLL_CUE_FADE_DURATION: 0.2,
    LABEL_FADE_START: 0.12,
    LABEL_FADE_DURATION: 0.34,
    NUMBER_FADE_START: 0.42,
    NUMBER_FADE_DURATION: 0.34,
    CIRCLE_HIGHLIGHT_AT: 0.32,
    BG_REVEAL_START: 0.28,
    BG_REVEAL_DURATION: 0.52,
    COPY_FADE_START: 0.72,
    COPY_FADE_DURATION: 0.28,
    TITLE_EXIT_PX: 20,
  };

  const CROSS = {
    COPY_STEP_RATIO: 0.8,
    COPY_FADE_SPREAD: 1.5,
    COPY_FADE_OFFSET: 0.12,
  };

  const TRACKER = {
    MAX_WIDTH: 258,
    WIDTH_RATIO: 0.235,
    MARGIN_MIN: 28,
    MARGIN_MAX: 120,
    MARGIN_RATIO: 0.07,
  };

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------

  const section = document.getElementById('section');
  const stage = document.getElementById('stage');
  const titleEl = document.getElementById('htitle');
  const introCopyEl = document.getElementById('hcopy');
  const scrollCueEl = document.getElementById('hcue');
  const diagramEl = document.getElementById('hdiagram');
  const diagramCenterEl = diagramEl.querySelector('.hcenter');
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

  let activeAxisIndex = -1;

  const geometry = {
    heroCenterX: 0,
    heroCenterY: 0,
    heroWidth: 1,
    trackerCenterX: 0,
    trackerCenterY: 0,
    scaleToTracker: 0.6,
    deltaX: 0,
    deltaY: 0,
  };

  // ---------------------------------------------------------------------------
  // Easing & progress helpers
  // ---------------------------------------------------------------------------

  /** Ease-in-out quad — matches vanilla morph motion */
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /** Smoothstep — matches vanilla background reveal */
  function smoothstep(t) {
    const x = clamp(0, 1, t);
    return x * x * (3 - 2 * x);
  }

  function segmentProgress(progress, start, duration) {
    return clamp(0, 1, (progress - start) / duration);
  }

  function getMorphProgress(scrollProgress) {
    return clamp(0, 1, (scrollProgress - PHASE.HERO_END) / (PHASE.MORPH_END - PHASE.HERO_END));
  }

  function getCrossProgress(scrollProgress) {
    return (scrollProgress - PHASE.MORPH_END) / (1 - PHASE.MORPH_END);
  }

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------

  function measureDiagramGeometry() {
    gsap.set(diagramEl, { yPercent: -50, x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' });

    const stageRect = stage.getBoundingClientRect();
    const diagramRect = diagramEl.getBoundingClientRect();

    geometry.heroCenterX = diagramRect.left + diagramRect.width / 2 - stageRect.left;
    geometry.heroCenterY = diagramRect.top + diagramRect.height / 2 - stageRect.top;
    geometry.heroWidth = diagramRect.width;

    const trackerWidth = Math.min(TRACKER.MAX_WIDTH, window.innerWidth * TRACKER.WIDTH_RATIO);
    const leftMargin = clamp(
      TRACKER.MARGIN_MIN,
      TRACKER.MARGIN_MAX,
      window.innerWidth * TRACKER.MARGIN_RATIO,
    );

    geometry.trackerCenterX = leftMargin + trackerWidth / 2;
    geometry.trackerCenterY = window.innerHeight * 0.5;
    geometry.scaleToTracker = trackerWidth / geometry.heroWidth;
    geometry.deltaX = geometry.trackerCenterX - geometry.heroCenterX;
    geometry.deltaY = geometry.trackerCenterY - geometry.heroCenterY;
  }

  function applyDiagramTransform(morphAmount) {
    gsap.set(diagramEl, {
      yPercent: -50,
      x: geometry.deltaX * morphAmount,
      y: geometry.deltaY * morphAmount,
      scale: 1 + morphAmount * (geometry.scaleToTracker - 1),
    });
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function setPhase(name) {
    stage.dataset.phase = name;
  }

  function hideSlideCopies() {
    gsap.set(slideCopies, { opacity: 0, visibility: 'hidden' });
  }

  function resetBackgrounds() {
    backgrounds.forEach((bg) => {
      bg.classList.remove('on');
      bg.style.opacity = '';
      bg.style.transition = '';
    });
  }

  function resetFirstBackgroundOverrides() {
    const firstBg = backgrounds[0];
    if (firstBg.style.opacity !== '') firstBg.style.opacity = '';
    if (firstBg.style.transition === 'none') firstBg.style.transition = '';
  }

  function setActiveAxis(index) {
    if (index === activeAxisIndex) return;
    activeAxisIndex = index;
    backgrounds.forEach((bg, i) => bg.classList.toggle('on', i === index));
    counterEl.textContent = '0' + (index + 1);
  }

  function resetActiveAxis() {
    activeAxisIndex = -1;
  }

  function setAxisHighlight(activeIndex) {
    axisCircles.forEach((circle, i) => {
      const isActive = i === activeIndex;
      gsap.set(circle, { opacity: 1 });
      circle.classList.toggle('act', isActive);
      circle.classList.toggle('dim', !isActive);
    });
  }

  // ---------------------------------------------------------------------------
  // Phase renderers (driven by ScrollTrigger progress)
  // ---------------------------------------------------------------------------

  function renderHeroPhase() {
    setPhase('hero');

    gsap.set(titleEl, { opacity: 1, xPercent: -50, y: 0 });
    gsap.set(introCopyEl, { opacity: 1, yPercent: -50, y: 0 });
    gsap.set(scrollCueEl, { opacity: 1 });
    applyDiagramTransform(0);

    gsap.set(axisLabels, { opacity: 1 });
    gsap.set(axisNumbers, { opacity: 0 });
    gsap.set(diagramCenterEl, { opacity: 1 });

    axisCircles.forEach((circle) => {
      gsap.set(circle, { opacity: 1 });
      circle.classList.remove('act', 'dim');
    });

    resetFirstBackgroundOverrides();
    resetBackgrounds();
    hideSlideCopies();
    resetActiveAxis();
  }

  function renderMorphPhase(morphProgress) {
    setPhase('morph');

    const eased = easeInOutQuad(morphProgress);
    const titleLift = clamp(0, 1, 1 - morphProgress / MORPH.TITLE_LIFT_DURATION);

    gsap.set(titleEl, {
      opacity: titleLift,
      xPercent: -50,
      y: -MORPH.TITLE_EXIT_PX * eased,
    });

    gsap.set(introCopyEl, {
      opacity: titleLift,
      yPercent: -50,
      y: -MORPH.TITLE_EXIT_PX * eased,
    });

    gsap.set(scrollCueEl, {
      opacity: clamp(0, 1, 1 - morphProgress / MORPH.SCROLL_CUE_FADE_DURATION),
    });

    applyDiagramTransform(eased);

    const labelOpacity = clamp(
      0,
      1,
      1 - segmentProgress(morphProgress, MORPH.LABEL_FADE_START, MORPH.LABEL_FADE_DURATION),
    );
    const numberOpacity = segmentProgress(
      morphProgress,
      MORPH.NUMBER_FADE_START,
      MORPH.NUMBER_FADE_DURATION,
    );

    gsap.set(axisLabels, { opacity: labelOpacity });
    gsap.set(axisNumbers, { opacity: numberOpacity });
    gsap.set(diagramCenterEl, { opacity: 1 });

    const highlightFirst = morphProgress > MORPH.CIRCLE_HIGHLIGHT_AT;
    axisCircles.forEach((circle, i) => {
      gsap.set(circle, { opacity: 1 });
      if (i === 0) {
        circle.classList.toggle('act', highlightFirst);
        circle.classList.remove('dim');
      } else {
        circle.classList.toggle('dim', highlightFirst);
        circle.classList.remove('act');
      }
    });

    const firstBg = backgrounds[0];
    firstBg.style.transition = 'none';
    firstBg.classList.remove('on');
    gsap.set(firstBg, {
      opacity: smoothstep(
        segmentProgress(morphProgress, MORPH.BG_REVEAL_START, MORPH.BG_REVEAL_DURATION),
      ),
    });

    backgrounds.slice(1).forEach((bg) => {
      bg.classList.remove('on');
      bg.style.opacity = '';
      bg.style.transition = '';
    });

    slideCopies.forEach((copy, i) => {
      gsap.set(copy, { yPercent: -50, y: 0 });
      if (i === 0) {
        const opacity = segmentProgress(
          morphProgress,
          MORPH.COPY_FADE_START,
          MORPH.COPY_FADE_DURATION,
        );
        gsap.set(copy, { opacity, visibility: opacity > 0 ? 'visible' : 'hidden' });
      } else {
        gsap.set(copy, { opacity: 0, visibility: 'hidden' });
      }
    });

    resetActiveAxis();
  }

  function renderCrossPhase(crossProgress) {
    setPhase('cross');

    gsap.set([titleEl, introCopyEl, scrollCueEl], { opacity: 0 });
    applyDiagramTransform(1);

    gsap.set(axisLabels, { opacity: 0 });
    gsap.set(axisNumbers, { opacity: 1 });
    gsap.set(diagramCenterEl, { opacity: 1 });

    resetFirstBackgroundOverrides();

    const axisPosition = crossProgress * (AXIS_COUNT - 1);
    const currentIndex = clamp(0, AXIS_COUNT - 1, Math.round(axisPosition));

    setActiveAxis(currentIndex);
    setAxisHighlight(currentIndex);

    const copyStep = window.innerHeight * CROSS.COPY_STEP_RATIO;

    slideCopies.forEach((copy, i) => {
      const offset = i - axisPosition;
      const fade = clamp(
        0,
        1,
        1 - (Math.abs(offset) * CROSS.COPY_FADE_SPREAD - CROSS.COPY_FADE_OFFSET),
      );

      gsap.set(copy, {
        yPercent: -50,
        y: offset * copyStep,
        opacity: fade,
        visibility: fade <= 0 ? 'hidden' : 'visible',
      });
    });
  }

  function render(scrollProgress) {
    if (scrollProgress <= PHASE.HERO_END) {
      renderHeroPhase();
    } else if (scrollProgress < PHASE.MORPH_END) {
      renderMorphPhase(getMorphProgress(scrollProgress));
    } else {
      renderCrossPhase(getCrossProgress(scrollProgress));
    }
  }

  // ---------------------------------------------------------------------------
  // ScrollTrigger
  // ---------------------------------------------------------------------------

  function createScrollTrigger() {
    ScrollTrigger.create({
      id: 'crossfade-main',
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => render(self.progress),
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    section.style.height = SECTION_HEIGHT;
    measureDiagramGeometry();
    createScrollTrigger();
    render(ScrollTrigger.getById('crossfade-main').progress);

    ScrollTrigger.addEventListener('refreshInit', measureDiagramGeometry);

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
