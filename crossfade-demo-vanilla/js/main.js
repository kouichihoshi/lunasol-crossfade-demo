(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const AXIS_COUNT = 4;
  const SECTION_HEIGHT = '620vh';

  /** Scroll progress thresholds (0–1) */
  const PHASE = {
    HERO_END: 0.13,
    MORPH_END: 0.40,
  };

  /** Morph-phase timing (local progress 0–1 within morph) */
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

  /** Crossfade-phase copy slide */
  const CROSS = {
    COPY_STEP_RATIO: 0.8,
    COPY_FADE_SPREAD: 1.5,
    COPY_FADE_OFFSET: 0.12,
  };

  /** Diagram tracker geometry (hero → left sidebar) */
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
  const axisCircles = [...stage.querySelectorAll('.hcircle')];
  const axisLabels = axisCircles.map((circle) => circle.querySelector('.htx'));
  const axisNumbers = axisCircles.map((circle) => circle.querySelector('.hnum'));
  const backgrounds = [...stage.querySelectorAll('.bg')];
  const slideCopies = [...stage.querySelectorAll('.slidecopy')];
  const counterEl = document.getElementById('cur');
  const patternCtrl = document.getElementById('ctrl');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let activeAxisIndex = -1;

  /** Cached geometry for diagram morph (hero position → tracker position) */
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
  // Math helpers
  // ---------------------------------------------------------------------------

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /** Ease-in-out quad — used for morph motion */
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /** Smoothstep — used for background reveal */
  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  /** Map value from [start, start+duration] into 0–1 */
  function segmentProgress(progress, start, duration) {
    return clamp((progress - start) / duration, 0, 1);
  }

  function formatOpacity(value) {
    return clamp(value, 0, 1).toFixed(3);
  }

  // ---------------------------------------------------------------------------
  // Scroll progress
  // ---------------------------------------------------------------------------

  function getScrollProgress() {
    const viewportHeight = window.innerHeight;
    const scrollable = section.offsetHeight - viewportHeight;
    const scrolled = -section.getBoundingClientRect().top;
    return clamp(scrolled / scrollable, 0, 1);
  }

  /** Morph-local progress: 0 at morph start, 1 at morph end */
  function getMorphProgress(scrollProgress) {
    const morphSpan = PHASE.MORPH_END - PHASE.HERO_END;
    return clamp((scrollProgress - PHASE.HERO_END) / morphSpan, 0, 1);
  }

  /** Crossfade-local progress: 0 at cross start, 1 at section end */
  function getCrossProgress(scrollProgress) {
    return (scrollProgress - PHASE.MORPH_END) / (1 - PHASE.MORPH_END);
  }

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------

  function measureDiagramGeometry() {
    diagramEl.style.transform = 'translateY(-50%)';

    const stageRect = stage.getBoundingClientRect();
    const diagramRect = diagramEl.getBoundingClientRect();

    geometry.heroCenterX = diagramRect.left + diagramRect.width / 2 - stageRect.left;
    geometry.heroCenterY = diagramRect.top + diagramRect.height / 2 - stageRect.top;
    geometry.heroWidth = diagramRect.width;

    const trackerWidth = Math.min(TRACKER.MAX_WIDTH, window.innerWidth * TRACKER.WIDTH_RATIO);
    const leftMargin = clamp(
      window.innerWidth * TRACKER.MARGIN_RATIO,
      TRACKER.MARGIN_MIN,
      TRACKER.MARGIN_MAX,
    );

    geometry.trackerCenterX = leftMargin + trackerWidth / 2;
    geometry.trackerCenterY = window.innerHeight * 0.5;
    geometry.scaleToTracker = trackerWidth / geometry.heroWidth;
    geometry.deltaX = geometry.trackerCenterX - geometry.heroCenterX;
    geometry.deltaY = geometry.trackerCenterY - geometry.heroCenterY;
  }

  function diagramTransform(morphAmount) {
    const tx = geometry.deltaX * morphAmount;
    const ty = geometry.deltaY * morphAmount;
    const scale = 1 + morphAmount * (geometry.scaleToTracker - 1);
    return `translateY(-50%) translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${scale.toFixed(4)})`;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function setPhase(name) {
    stage.dataset.phase = name;
  }

  function setOpacity(el, value) {
    el.style.opacity = typeof value === 'number' ? formatOpacity(value) : value;
  }

  function hideSlideCopies() {
    slideCopies.forEach((copy) => {
      copy.style.opacity = '0';
      copy.style.visibility = 'hidden';
    });
  }

  function resetBackgrounds() {
    backgrounds.forEach((bg) => {
      bg.classList.remove('on');
      bg.style.opacity = '';
      bg.style.transition = '';
    });
  }

  /** Clear manual overrides on the first background (used during morph) */
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
      circle.style.opacity = '1';
      circle.classList.toggle('act', isActive);
      circle.classList.toggle('dim', !isActive);
    });
  }

  // ---------------------------------------------------------------------------
  // Phase renderers
  // ---------------------------------------------------------------------------

  function renderHeroPhase() {
    setPhase('hero');

    setOpacity(titleEl, 1);
    titleEl.style.transform = 'translateX(-50%)';

    setOpacity(introCopyEl, 1);
    introCopyEl.style.transform = 'translateY(-50%)';

    setOpacity(scrollCueEl, 1);
    diagramEl.style.transform = 'translateY(-50%)';

    axisLabels.forEach((label) => setOpacity(label, 1));
    axisNumbers.forEach((num) => setOpacity(num, 0));
    setOpacity(diagramCenterEl, 1);

    axisCircles.forEach((circle) => {
      circle.style.opacity = '1';
      circle.classList.remove('act', 'dim');
    });

    resetFirstBackgroundOverrides();
    resetBackgrounds();
    hideSlideCopies();
    resetActiveAxis();
  }

  function renderMorphPhase(morphProgress) {
    setPhase('morph');

    const eased = easeInOut(morphProgress);
    const titleLift = clamp(1 - morphProgress / MORPH.TITLE_LIFT_DURATION, 0, 1);

    setOpacity(titleEl, titleLift);
    titleEl.style.transform = `translateX(-50%) translateY(${(-MORPH.TITLE_EXIT_PX * eased).toFixed(1)}px)`;

    setOpacity(introCopyEl, titleLift);
    introCopyEl.style.transform = `translateY(calc(-50% - ${(MORPH.TITLE_EXIT_PX * eased).toFixed(1)}px))`;

    setOpacity(scrollCueEl, clamp(1 - morphProgress / MORPH.SCROLL_CUE_FADE_DURATION, 0, 1));
    diagramEl.style.transform = diagramTransform(eased);

    const labelOpacity = clamp(
      1 - segmentProgress(morphProgress, MORPH.LABEL_FADE_START, MORPH.LABEL_FADE_DURATION),
      0,
      1,
    );
    const numberOpacity = segmentProgress(
      morphProgress,
      MORPH.NUMBER_FADE_START,
      MORPH.NUMBER_FADE_DURATION,
    );

    axisLabels.forEach((label) => setOpacity(label, labelOpacity));
    axisNumbers.forEach((num) => setOpacity(num, numberOpacity));
    setOpacity(diagramCenterEl, 1);

    const highlightFirst = morphProgress > MORPH.CIRCLE_HIGHLIGHT_AT;
    axisCircles.forEach((circle, i) => {
      circle.style.opacity = '1';
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
    setOpacity(
      firstBg,
      smoothstep(segmentProgress(morphProgress, MORPH.BG_REVEAL_START, MORPH.BG_REVEAL_DURATION)),
    );

    backgrounds.slice(1).forEach((bg) => {
      bg.classList.remove('on');
      bg.style.opacity = '';
      bg.style.transition = '';
    });

    slideCopies.forEach((copy, i) => {
      copy.style.transform = 'translateY(-50%)';
      if (i === 0) {
        const opacity = segmentProgress(
          morphProgress,
          MORPH.COPY_FADE_START,
          MORPH.COPY_FADE_DURATION,
        );
        setOpacity(copy, opacity);
        copy.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      } else {
        copy.style.opacity = '0';
        copy.style.visibility = 'hidden';
      }
    });

    resetActiveAxis();
  }

  function renderCrossPhase(crossProgress) {
    setPhase('cross');

    setOpacity(titleEl, 0);
    setOpacity(introCopyEl, 0);
    setOpacity(scrollCueEl, 0);

    diagramEl.style.transform = diagramTransform(1);

    axisLabels.forEach((label) => setOpacity(label, 0));
    axisNumbers.forEach((num) => setOpacity(num, 1));
    setOpacity(diagramCenterEl, 1);

    resetFirstBackgroundOverrides();

    const axisPosition = crossProgress * (AXIS_COUNT - 1);
    const currentIndex = clamp(Math.round(axisPosition), 0, AXIS_COUNT - 1);

    setActiveAxis(currentIndex);
    setAxisHighlight(currentIndex);

    const copyStep = window.innerHeight * CROSS.COPY_STEP_RATIO;

    slideCopies.forEach((copy, i) => {
      const offset = i - axisPosition;
      copy.style.transform = `translateY(calc(-50% + ${(offset * copyStep).toFixed(1)}px))`;

      const fade = clamp(
        1 - (Math.abs(offset) * CROSS.COPY_FADE_SPREAD - CROSS.COPY_FADE_OFFSET),
        0,
        1,
      );
      setOpacity(copy, fade);
      copy.style.visibility = fade <= 0 ? 'hidden' : 'visible';
    });
  }

  // ---------------------------------------------------------------------------
  // Main update loop
  // ---------------------------------------------------------------------------

  function update() {
    const scrollProgress = getScrollProgress();

    if (scrollProgress <= PHASE.HERO_END) {
      renderHeroPhase();
    } else if (scrollProgress < PHASE.MORPH_END) {
      renderMorphPhase(getMorphProgress(scrollProgress));
    } else {
      renderCrossPhase(getCrossProgress(scrollProgress));
    }
  }

  function layout() {
    section.style.height = SECTION_HEIGHT;
    measureDiagramGeometry();
    update();
  }

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------

  patternCtrl.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    stage.dataset.pattern = button.dataset.p;
    patternCtrl.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('act', btn === button);
    });
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', layout);

  layout();
})();
