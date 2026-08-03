(function () {
  "use strict";

  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var revealTargets = document.querySelectorAll(".reveal");

  if (revealTargets.length > 0) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
      );

      revealTargets.forEach(function (el, index) {
        el.style.transitionDelay = Math.min(index * 80, 320) + "ms";
        observer.observe(el);
      });
    }
  }

  var timelineTrack = document.querySelector(".timeline__track");
  var timelineProgress = document.querySelector(".timeline__progress");

  if (timelineTrack && timelineProgress) {
    var ticking = false;

    var updateTimelineProgress = function () {
      var rect = timelineTrack.getBoundingClientRect();
      var anchor = window.innerHeight * 0.6;
      var pct = ((anchor - rect.top) / rect.height) * 100;
      pct = Math.min(Math.max(pct, 0), 100);
      timelineProgress.style.height = pct + "%";
      ticking = false;
    };

    updateTimelineProgress();

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(updateTimelineProgress);
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener("resize", updateTimelineProgress);
  }

  var snapSections = document.querySelectorAll(".book-section");

  if (snapSections.length > 0) {
    var counters = document.querySelectorAll(".section-counter__current");
    var currentSectionIndex = 0;
    var lastSectionIndex = snapSections.length - 1;

    // Unsichtbarer Klon von Buch 1 direkt nach der letzten Sektion, damit der
    // Übergang von der letzten zur ersten Sektion wie eine endlose Rotation
    // wirkt statt wie ein Rücksprung.
    var loopClone = null;
    if (snapSections.length > 1) {
      loopClone = snapSections[0].cloneNode(true);
      loopClone.removeAttribute("id");
      loopClone.setAttribute("aria-hidden", "true");
      loopClone.setAttribute("inert", "");
      loopClone.querySelectorAll("[id]").forEach(function (el) {
        el.removeAttribute("id");
      });
      snapSections[lastSectionIndex].insertAdjacentElement(
        "afterend",
        loopClone
      );
    }

    // Der Rücksprung vom Klon zur echten Sektion 1 darf erst erfolgen, wenn
    // das (smoothe) Scrollen komplett zur Ruhe gekommen ist — sonst kollidiert
    // der sofortige scrollTo() mit der noch laufenden Scroll-Animation und
    // wirkt ruckelig.
    var cloneIsActive = false;

    // Der Rücksprung darf nur den automatischen Loop abschließen, nicht ein
    // manuelles Scrollen unterbrechen — sonst kommt man per Hand nie am Klon
    // vorbei zur Fußzeile, weil scroll-snap-stop dort ohnehin anhält.
    var isAutoplayScroll = false;

    var jumpBackToStart = function () {
      if (!cloneIsActive || !isAutoplayScroll) {
        return;
      }
      cloneIsActive = false;
      isAutoplayScroll = false;
      window.scrollTo({
        top: snapSections[0].offsetTop,
        behavior: "instant",
      });
      currentSectionIndex = 0;
      if (counters.length > 0) {
        counters.forEach(function (el) {
          el.textContent = "01";
        });
      }
    };

    if ("onscrollend" in window) {
      window.addEventListener("scrollend", jumpBackToStart);
    } else {
      var scrollEndFallbackTimer = null;
      window.addEventListener(
        "scroll",
        function () {
          clearTimeout(scrollEndFallbackTimer);
          scrollEndFallbackTimer = setTimeout(jumpBackToStart, 150);
        },
        { passive: true }
      );
    }

    if ("IntersectionObserver" in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.target === loopClone) {
              cloneIsActive = entry.isIntersecting;
              return;
            }

            if (!entry.isIntersecting) {
              return;
            }

            currentSectionIndex = Array.prototype.indexOf.call(
              snapSections,
              entry.target
            );
            if (counters.length > 0) {
              var value = entry.target.getAttribute("data-section-index");
              counters.forEach(function (el) {
                el.textContent = value;
              });
            }
          });
        },
        { threshold: 0.6 }
      );

      snapSections.forEach(function (section) {
        sectionObserver.observe(section);
      });
      if (loopClone) {
        sectionObserver.observe(loopClone);
      }
    }

    if (snapSections.length > 1 && !prefersReducedMotion) {
      var AUTOPLAY_DELAY = 4000;
      var AUTOPLAY_SCROLL_DURATION = 1400;
      var autoplayTimer = null;

      var easeInOutCubic = function (t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      // Eigene rAF-Animation statt scrollIntoView({behavior:"smooth"}), weil
      // die native Smooth-Scroll-Dauer/-Kurve vom Browser vorgegeben ist und
      // sich nicht verlängern oder abstimmen lässt.
      var animateScrollTo = function (targetY, duration) {
        var startY = window.pageYOffset;
        var distance = targetY - startY;
        var startTime = null;

        var step = function (timestamp) {
          if (startTime === null) {
            startTime = timestamp;
          }
          var progress = Math.min((timestamp - startTime) / duration, 1);
          window.scrollTo(0, startY + distance * easeInOutCubic(progress));
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        };

        window.requestAnimationFrame(step);
      };

      var scheduleAutoplay = function () {
        clearTimeout(autoplayTimer);
        autoplayTimer = setTimeout(function () {
          var target =
            currentSectionIndex === lastSectionIndex
              ? loopClone
              : snapSections[currentSectionIndex + 1];
          isAutoplayScroll = true;
          animateScrollTo(target.offsetTop, AUTOPLAY_SCROLL_DURATION);
          scheduleAutoplay();
        }, AUTOPLAY_DELAY);
      };

      var navKeys = [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        " ",
        "Home",
        "End",
      ];

      var handleUserActivity = function (event) {
        if (event.type === "keydown" && navKeys.indexOf(event.key) === -1) {
          return;
        }
        isAutoplayScroll = false;
        scheduleAutoplay();
      };

      window.addEventListener("wheel", handleUserActivity, { passive: true });
      window.addEventListener("touchstart", handleUserActivity, {
        passive: true,
      });
      window.addEventListener("keydown", handleUserActivity);

      scheduleAutoplay();
    }
  }
})();
