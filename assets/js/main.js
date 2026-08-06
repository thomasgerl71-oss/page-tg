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
      var autoplayTimer = null;

      // Natives scrollTo({behavior:"smooth"}) statt eigener rAF-Animation:
      // Der Browser bricht einen laufenden nativen Smooth-Scroll sofort ab,
      // sobald der Nutzer selbst scrollt — eine eigene Animation würde die
      // Scrollposition dagegen jeden Frame per Code überschreiben und mit
      // manuellem Scrollen kollidieren (sichtbares Ruckeln/Bouncing).
      var isAutoplayScroll = false;
      var wrapClone = null;

      var cleanupWrapClone = function () {
        if (wrapClone) {
          wrapClone.remove();
          wrapClone = null;
        }
      };

      // Für einen nahtlosen Loop von der letzten zur ersten Sektion wird Buch 1
      // kurzzeitig direkt hinter der letzten Sektion geklont, dorthin gescrollt
      // und danach unsichtbar (instant) auf die echte Sektion 1 zurückgesprungen.
      // Der Klon existiert nur für die Dauer dieses einen Übergangs, damit er
      // beim normalen manuellen Scrollen nie auftaucht.
      var jumpBackAfterWrap = function () {
        if (!isAutoplayScroll) {
          // Nutzer hat den Übergang unterbrochen — nur aufräumen, keine
          // Scrollposition erzwingen.
          cleanupWrapClone();
          return;
        }
        isAutoplayScroll = false;
        if (wrapClone) {
          window.scrollTo({ top: snapSections[0].offsetTop, behavior: "instant" });
          cleanupWrapClone();
          currentSectionIndex = 0;
          if (counters.length > 0) {
            counters.forEach(function (el) {
              el.textContent = "01";
            });
          }
        }
      };

      if ("onscrollend" in window) {
        window.addEventListener("scrollend", jumpBackAfterWrap);
      } else {
        var scrollEndFallbackTimer = null;
        window.addEventListener(
          "scroll",
          function () {
            clearTimeout(scrollEndFallbackTimer);
            scrollEndFallbackTimer = setTimeout(jumpBackAfterWrap, 150);
          },
          { passive: true }
        );
      }

      var scheduleAutoplay = function () {
        clearTimeout(autoplayTimer);
        autoplayTimer = setTimeout(function () {
          isAutoplayScroll = true;

          if (currentSectionIndex === lastSectionIndex) {
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
            wrapClone = clone;
            window.scrollTo({ top: clone.offsetTop, behavior: "smooth" });
          } else {
            window.scrollTo({
              top: snapSections[currentSectionIndex + 1].offsetTop,
              behavior: "smooth",
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
