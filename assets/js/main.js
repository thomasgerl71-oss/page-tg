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

    if ("IntersectionObserver" in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
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
    }

    if (snapSections.length > 1 && !prefersReducedMotion) {
      var AUTOPLAY_DELAY = 4000;
      var AUTOPLAY_SCROLL_DURATION = 900;
      var autoplayTimer = null;
      var activeAnimation = null;
      var activeClone = null;

      var easeInOutCubic = function (t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      // Für einen nahtlosen Loop von der letzten zur ersten Sektion wird Buch 1
      // kurzzeitig direkt hinter der letzten Sektion geklont, dorthin gescrollt
      // und danach unsichtbar (instant) auf die echte Sektion 1 zurückgesprungen.
      // Der Klon existiert nur für die Dauer dieses einen Übergangs, damit er
      // beim normalen manuellen Scrollen nie auftaucht.
      var cleanupClone = function () {
        if (activeClone) {
          if (activeClone.parentNode) {
            activeClone.parentNode.removeChild(activeClone);
          }
          activeClone = null;
        }
      };

      // Eigene rAF-Animation mit Easing statt natives scrollTo({behavior:"smooth"}):
      // Native Smooth-Scrolls starten/enden in den meisten Browsern abrupt statt
      // sanft. behavior:"instant" pro Frame erzwingen, weil html global
      // scroll-behavior: smooth gesetzt hat, das sonst jeden Frame zusätzlich
      // selbst weich animieren und mit der eigenen Kurve hier kollidieren würde
      // (sichtbares Ruckeln/"Schnappen" gegen Ende der Animation).
      var animateScrollTo = function (targetY, duration, onComplete) {
        if (activeAnimation) {
          activeAnimation.cancelled = true;
        }
        var anim = { cancelled: false };
        activeAnimation = anim;

        var startY = window.pageYOffset;
        var distance = targetY - startY;
        var startTime = null;

        var step = function (timestamp) {
          if (anim.cancelled) {
            return;
          }
          if (startTime === null) {
            startTime = timestamp;
          }
          var progress = Math.min((timestamp - startTime) / duration, 1);
          window.scrollTo({
            top: startY + distance * easeInOutCubic(progress),
            left: 0,
            behavior: "instant",
          });
          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else if (onComplete) {
            onComplete();
          }
        };

        window.requestAnimationFrame(step);
      };

      var scheduleAutoplay = function () {
        clearTimeout(autoplayTimer);
        autoplayTimer = setTimeout(function () {
          if (currentSectionIndex !== lastSectionIndex) {
            animateScrollTo(
              snapSections[currentSectionIndex + 1].offsetTop,
              AUTOPLAY_SCROLL_DURATION
            );
          } else {
            var clone = snapSections[0].cloneNode(true);
            clone.removeAttribute("id");
            clone.setAttribute("aria-hidden", "true");
            clone.setAttribute("inert", "");
            clone.querySelectorAll("[id]").forEach(function (el) {
              el.removeAttribute("id");
            });
            snapSections[lastSectionIndex].insertAdjacentElement(
              "afterend",
              clone
            );
            activeClone = clone;

            animateScrollTo(clone.offsetTop, AUTOPLAY_SCROLL_DURATION, function () {
              window.scrollTo({ top: snapSections[0].offsetTop, behavior: "instant" });
              cleanupClone();
              currentSectionIndex = 0;
              if (counters.length > 0) {
                counters.forEach(function (el) {
                  el.textContent = "01";
                });
              }
            });
          }

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
        // Eine laufende Klon-Übergangsanimation sofort sauber beenden, damit
        // manuelles Scrollen niemals auf den (nur kurzzeitig existierenden)
        // Klon treffen kann.
        if (activeClone) {
          if (activeAnimation) {
            activeAnimation.cancelled = true;
          }
          window.scrollTo({ top: snapSections[0].offsetTop, behavior: "instant" });
          cleanupClone();
          currentSectionIndex = 0;
        }
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
