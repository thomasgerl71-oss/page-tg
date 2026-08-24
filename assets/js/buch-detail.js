(function () {
  "use strict";

  // --------------------------------------------------------------------
  // Die Zusatzangaben (ISBN, Preis, Bestellen, E-Book, Amazon, …) unter
  // dem Klappentext jeder Buch-Detailseite werden aus einem Google Sheet
  // geladen, damit sie ohne Code-Änderung gepflegt werden können.
  //
  // Aufbau des Sheets (erste Zeile = Überschrift):
  //   Spalte 1: Titel (nur zur Zuordnung, wird nicht angezeigt)
  //   Ab Spalte 2: eine Spalte pro Angabe, Überschrift = Bezeichnung auf
  //   der Seite (z. B. "ISBN", "Preis", "Bestellen", "E-Book", "Hörbuch",
  //   "Amazon"). Reihenfolge und Anzahl der Spalten sind frei wählbar.
  //
  //   Pro Buch zwei Zeilen direkt untereinander:
  //     Zeile 1: die anzuzeigenden Werte je Spalte
  //     Zeile 2: die passenden Links je Spalte (leer lassen, wenn die
  //              jeweilige Angabe keinen Link hat, z. B. ISBN/Preis)
  //   Ist der Wert für eine Spalte bei einem Buch leer, wird dieser
  //   Punkt auf der Seite für dieses Buch einfach weggelassen (z. B.
  //   "Hörbuch" nur bei Büchern, die eins haben).
  //
  //   Freigabe wie beim Termine-Sheet: "Freigeben" > "Allgemeiner
  //   Zugriff" auf "Jeder, der über den Link verfügt" (Betrachter).
  // --------------------------------------------------------------------

  var SHEET_ID = "19TqorlOZEhLPBCHHuoVuOdHUU85AxAI4bRKqMylMfoA";
  var GID = "0";

  var CSV_URL = SHEET_ID
    ? "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + GID
    : "";

  var listEl = document.getElementById("book-meta-list");
  if (!listEl) {
    return;
  }

  var bookTitle = (listEl.getAttribute("data-book-title") || "").trim();

  function setStatus(message) {
    listEl.innerHTML = "";
    var p = document.createElement("p");
    p.className = "termine-status";
    p.textContent = message;
    listEl.appendChild(p);
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") {
          i++;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function normalizeTitle(title) {
    return title.trim().toLowerCase();
  }

  function findBookEntry(rows, title) {
    if (rows.length < 3) {
      return null;
    }

    var headers = rows[0].slice(1).map(function (h) {
      return h.trim();
    });
    var target = normalizeTitle(title);

    for (var i = 1; i < rows.length; i += 2) {
      var valuesRow = rows[i];
      var linksRow = rows[i + 1] || [];

      if (normalizeTitle(valuesRow[0] || "") !== target) {
        continue;
      }

      var fields = [];
      for (var col = 0; col < headers.length; col++) {
        var value = (valuesRow[col + 1] || "").trim();
        if (value === "") {
          continue;
        }
        fields.push({
          label: headers[col],
          value: value,
          link: (linksRow[col + 1] || "").trim(),
        });
      }
      return fields;
    }

    return null;
  }

  function render(fields) {
    listEl.innerHTML = "";

    fields.forEach(function (field) {
      var wrap = document.createElement("div");

      var dt = document.createElement("dt");
      dt.textContent = field.label;
      wrap.appendChild(dt);

      var dd = document.createElement("dd");
      if (field.link) {
        var a = document.createElement("a");
        a.href = field.link;
        a.textContent = field.value;
        dd.appendChild(a);
      } else {
        dd.textContent = field.value;
      }
      wrap.appendChild(dd);

      listEl.appendChild(wrap);
    });
  }

  if (!CSV_URL || !bookTitle) {
    setStatus("Zusatzangaben sind noch nicht eingerichtet.");
    return;
  }

  fetch(CSV_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.text();
    })
    .then(function (text) {
      var fields = findBookEntry(parseCsv(text), bookTitle);
      if (fields === null) {
        setStatus("Zusatzangaben konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.");
        return;
      }
      if (fields.length === 0) {
        setStatus("Zusatzangaben folgen in Kürze.");
        return;
      }
      render(fields);
    })
    .catch(function () {
      setStatus("Zusatzangaben konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.");
    });
})();
