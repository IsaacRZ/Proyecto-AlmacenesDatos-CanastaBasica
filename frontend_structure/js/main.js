// ======================================================
// main.js
// Interacciones globales del proyecto
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initRevealOnScroll();
  initCardTilt();
  initKpiCounters();
  initButtonRipple();
  initHeroMouseEffect();
  initChartAutoResize();
});

// ------------------------------------------------------
// 1. Marcar enlace activo del menú
// ------------------------------------------------------
function setActiveNav() {
  const links = document.querySelectorAll(".nav a");
  if (!links.length) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const linkPage = href.split("/").pop();
    link.classList.remove("active");

    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
}

// ------------------------------------------------------
// 2. Animación al hacer scroll
// ------------------------------------------------------
function initRevealOnScroll() {
  const elements = document.querySelectorAll(
    ".section, .card, .chart-card, .kpi-card, .large-card, .filters-section, .map-card"
  );

  if (!elements.length) return;

  elements.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  });

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
    }
  );

  elements.forEach((el) => observer.observe(el));
}

// ------------------------------------------------------
// 3. Efecto 3D suave en tarjetas
//    Se desactiva en gráficos para no afectar interacción
// ------------------------------------------------------
function initCardTilt() {
  const cards = document.querySelectorAll(".card, .kpi-card, .large-card, .summary-item, .mini-kpi");
  if (!cards.length) return;

  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;

  if (isTouchDevice) return;

  cards.forEach((card) => {
    let frameId = null;

    const resetCard = () => {
      card.style.transition = "transform 0.35s ease";
      card.style.transform = "";
    };

    const updateTilt = (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateY = ((x - centerX) / centerX) * 4;
      const rotateX = ((centerY - y) / centerY) * 4;

      card.style.transition = "transform 0.08s linear";
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    };

    card.addEventListener("mousemove", (event) => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => updateTilt(event));
    });

    card.addEventListener("mouseleave", resetCard);
    card.addEventListener("blur", resetCard);
  });
}

// ------------------------------------------------------
// 4. KPIs animados
// ------------------------------------------------------
function initKpiCounters() {
  const kpis = document.querySelectorAll(".kpi-card h3, .mini-kpi strong");
  if (!kpis.length) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateKpi(entry.target);
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.35 }
  );

  kpis.forEach((kpi) => observer.observe(kpi));

  window.addEventListener("dashboard:kpisUpdated", () => {
    const refreshed = document.querySelectorAll(".kpi-card h3, .mini-kpi strong");
    refreshed.forEach((element) => animateKpi(element));
  });
}

function animateKpi(element) {
  const originalText = element.textContent.trim();

  if (!originalText || originalText === "₡0" || originalText === "0%" || originalText === "0" || originalText === "N/D") {
    return;
  }

  const hasCurrency = originalText.includes("₡");
  const hasPercent = originalText.includes("%");

  const cleaned = originalText.replace(/[₡,%\s,]/g, "");
  const target = Number(cleaned);

  if (Number.isNaN(target)) return;

  const duration = 900;
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = easeOutCubic(progress);
    const current = target * eased;

    let displayValue = "";

    if (hasCurrency) {
      displayValue = "₡" + Math.round(current).toLocaleString("es-CR");
    } else if (hasPercent) {
      displayValue = current.toFixed(1) + "%";
    } else if (Number.isInteger(target)) {
      displayValue = Math.round(current).toString();
    } else {
      displayValue = current.toFixed(2);
    }

    element.textContent = displayValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = originalText;
    }
  }

  requestAnimationFrame(update);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ------------------------------------------------------
// 5. Efecto ripple en botones
// ------------------------------------------------------
function initButtonRipple() {
  const buttons = document.querySelectorAll(".btn");

  buttons.forEach((button) => {
    button.style.position = "relative";
    button.style.overflow = "hidden";

    button.addEventListener("click", (event) => {
      const ripple = document.createElement("span");
      const rect = button.getBoundingClientRect();

      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;

      ripple.style.position = "absolute";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.borderRadius = "50%";
      ripple.style.background = "rgba(255,255,255,0.22)";
      ripple.style.transform = "scale(0)";
      ripple.style.pointerEvents = "none";
      ripple.style.transition = "transform 0.55s ease, opacity 0.55s ease";
      ripple.style.opacity = "1";

      button.appendChild(ripple);

      requestAnimationFrame(() => {
        ripple.style.transform = "scale(3)";
        ripple.style.opacity = "0";
      });

      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// ------------------------------------------------------
// 6. Movimiento sutil en la landing
// ------------------------------------------------------
function initHeroMouseEffect() {
  const hero = document.querySelector(".hero");
  const heroContent = document.querySelector(".hero-content");
  const heroPanel = document.querySelector(".hero-panel");

  if (!hero || !heroContent || !heroPanel) return;

  hero.addEventListener("mousemove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const moveX = (x - 0.5) * 14;
    const moveY = (y - 0.5) * 14;

    heroContent.style.transform = `translate(${moveX * 0.6}px, ${moveY * 0.6}px)`;
    heroPanel.style.transform = `translate(${moveX * -0.4}px, ${moveY * -0.4}px)`;
    heroContent.style.transition = "transform 0.12s linear";
    heroPanel.style.transition = "transform 0.12s linear";
  });

  hero.addEventListener("mouseleave", () => {
    heroContent.style.transform = "";
    heroPanel.style.transform = "";
    heroContent.style.transition = "transform 0.35s ease";
    heroPanel.style.transition = "transform 0.35s ease";
  });
}

// ------------------------------------------------------
// 7. Ajuste automático de tamaño de gráficos
// ------------------------------------------------------
function initChartAutoResize() {
  const resizeCharts = () => {
    if (!window.DashboardStore?.charts) return;
    Object.values(window.DashboardStore.charts).forEach((chart) => {
      if (chart?.resize) chart.resize();
    });
  };

  window.addEventListener("resize", resizeCharts);
  window.addEventListener("dashboard:filtersChanged", () => {
    setTimeout(resizeCharts, 60);
  });
}