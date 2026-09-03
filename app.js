const INDUSTRIES = [
  "Top Stories",
  "Current Affairs",
  "Agriculture & Allied",
  "FMCG",
  "Biotech & Life Sciences",
  "Consulting & Strategy",
  "Operations & Supply Chain",
  "Product",
  "Commercial & Marketing",
  "Global Trade"
];

let DATA = {
  stories: [],
  source_status: []
};

let activeIndustry = "Top Stories";
let historyIndex = null;

const $ = (selector) => document.querySelector(selector);


/* =========================================================
   TAB RENDERING
   ========================================================= */

function renderTabs() {
  const tabs = $("#tabs");

  if (!tabs) return;

  tabs.innerHTML = INDUSTRIES.map(industry => `
    <button
      class="${industry === activeIndustry ? "on" : ""}"
      data-industry="${industry}"
    >
      ${industry}
    </button>
  `).join("");
}


/* =========================================================
   MAIN STORY RENDERING
   ========================================================= */

function renderStories() {
  renderTabs();

  const search = ($("#q")?.value || "").toLowerCase().trim();
  const pivot = $("#pivot")?.value || "All pivots";
  const geography = $("#geo")?.value || "India + Global";
  const minimumScore = Number($("#score")?.value || 0);

  let stories = (DATA.stories || []).filter(story => {

    // Industry / Top Stories
    const industryMatch =
      activeIndustry === "Top Stories"
        ? Number(story.score || 0) >= 70
        : story.industry === activeIndustry;

    // Search
    const searchableText = [
      story.title,
      story.summary,
      story.player,
      story.source,
      story.industry,
      story.pivot,
      story.reason
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const searchMatch =
      !search || searchableText.includes(search);

    // Managerial pivot
    const pivotMatch =
      pivot === "All pivots" ||
      story.pivot === pivot;

    // Geography
    const geographyMatch =
      geography === "India + Global" ||
      story.geo === geography;

    // Relevance score
    const scoreMatch =
      Number(story.score || 0) >= minimumScore;

    return (
      industryMatch &&
      searchMatch &&
      pivotMatch &&
      geographyMatch &&
      scoreMatch
    );
  });


  // Highest relevance first
  stories.sort(
    (a, b) => Number(b.score || 0) - Number(a.score || 0)
  );


  // Top Stories is intentionally a concise briefing
  if (activeIndustry === "Top Stories") {
    stories = stories.slice(0, 40);
  }


  if ($("#count")) {
    $("#count").textContent = stories.length;
  }

  if ($("#total")) {
    $("#total").textContent = (DATA.stories || []).length;
  }

  if ($("#newcount")) {
    $("#newcount").textContent =
      (DATA.stories || []).filter(story => story.is_new).length;
  }


  const feed = $("#feed");

  if (!feed) return;


  if (!stories.length) {
    feed.innerHTML = `
      <div class="empty">
        No matching stories for this view.
        Try another industry, date range, geography or relevance score.
      </div>
    `;
    return;
  }


  feed.innerHTML = stories.map(story => {

    const score = Number(story.score || 0);

    let scoreLabel = "DISCOVERY";

    if (score >= 75) {
      scoreLabel = "HIGH";
    } else if (score >= 60) {
      scoreLabel = "USEFUL";
    }


    const summary =
      story.summary ||
      "Open the original report for full context and supporting detail.";


    const newTag = story.is_new
      ? `<i class="new">NEW</i>`
      : "";


    const playerTag = story.player
      ? `<i>${escapeHtml(story.player)}</i>`
      : "";


    return `
      <article>

        <div class="top">
          <span>
            ${escapeHtml(story.source || "News")}
            ·
            ${escapeHtml(story.industry || "")}
          </span>

          <b>
            ${score}/100 · ${scoreLabel}
          </b>
        </div>


        <div class="tags">
          ${
            story.pivot
              ? `<i>${escapeHtml(story.pivot)}</i>`
              : ""
          }

          ${
            story.geo
              ? `<i>${escapeHtml(story.geo)}</i>`
              : ""
          }

          ${newTag}
          ${playerTag}
        </div>


        <a
          href="${escapeAttribute(story.link || "#")}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(story.title || "Untitled story")}
        </a>


        <div class="summary">
          ${escapeHtml(summary)}
        </div>


        ${
          story.reason
            ? `
              <p class="reason">
                ${escapeHtml(story.reason)}
              </p>
            `
            : ""
        }


        <small>
          ${formatPublicationDate(story.date)}
        </small>

      </article>
    `;
  }).join("");
}


/* =========================================================
   LOAD LATEST SNAPSHOT
   ========================================================= */

async function loadLatest() {

  setStatus("Loading latest intelligence…");

  try {

    const response = await fetch(
      `data/latest.json?v=${Date.now()}`,
      {
        cache: "no-store"
      }
    );


    if (!response.ok) {
      throw new Error(
        `latest.json returned HTTP ${response.status}`
      );
    }


    const result = await response.json();


    DATA = {
      stories: Array.isArray(result.stories)
        ? result.stories
        : [],

      source_status: Array.isArray(result.source_status)
        ? result.source_status
        : []
    };


    if ($("#updated")) {

      const generated = result.generated_at
        ? new Date(result.generated_at)
        : null;


      $("#updated").textContent =
        generated && !Number.isNaN(generated.getTime())
          ? `Updated ${generated.toLocaleString()}`
          : "Latest intelligence loaded";
    }


    if ($("#healthy")) {

      const healthySources =
        DATA.source_status.filter(
          source => source.ok
        ).length;

      $("#healthy").textContent = healthySources;
    }


    renderStories();

  } catch (error) {

    console.error(
      "Unable to load latest.json:",
      error
    );


    setStatus("Latest snapshot unavailable");


    if ($("#feed")) {
      $("#feed").innerHTML = `
        <div class="empty">

          <strong>
            The latest intelligence snapshot could not be loaded.
          </strong>

          <br><br>

          Check that
          <code>data/latest.json</code>
          exists and that the GitHub Action has completed successfully.

        </div>
      `;
    }
  }
}


/* =========================================================
   LOAD HISTORY INDEX
   ========================================================= */

async function loadHistoryIndex() {

  if (historyIndex) {
    return historyIndex;
  }


  const response = await fetch(
    `data/history.json?v=${Date.now()}`,
    {
      cache: "no-store"
    }
  );


  if (!response.ok) {
    throw new Error(
      `history.json returned HTTP ${response.status}`
    );
  }


  historyIndex = await response.json();

  return historyIndex;
}


/* =========================================================
   DATE RANGE / ARCHIVE LOADING
   ========================================================= */

async function loadDateRange(
  numberOfDays,
  customRange = false
) {

  setStatus("Loading historical intelligence…");


  try {

    const history =
      await loadHistoryIndex();


    let toDate;
    let fromDate;


    if (customRange) {

      const fromValue = $("#from")?.value;
      const toValue = $("#to")?.value;


      if (!fromValue || !toValue) {
        return;
      }


      fromDate =
        new Date(`${fromValue}T12:00:00`);

      toDate =
        new Date(`${toValue}T12:00:00`);


      if (fromDate > toDate) {

        alert(
          "The From date must be earlier than the To date."
        );

        return;
      }

    } else {

      toDate = new Date();

      fromDate = new Date(
        toDate.getTime() -
        (numberOfDays - 1) * 86400000
      );
    }


    const fromISO =
      toISODate(fromDate);

    const toISO =
      toISODate(toDate);


    const availableDates =
      Array.isArray(history.dates)
        ? history.dates
        : [];


    const datesToLoad =
      availableDates.filter(
        date =>
          date >= fromISO &&
          date <= toISO
      );


    if (!datesToLoad.length) {

      DATA = {
        stories: [],
        source_status: []
      };


      if ($("#healthy")) {
        $("#healthy").textContent = "—";
      }


      setStatus(
        `No archive available for ${fromISO} → ${toISO}`
      );


      renderStories();

      return;
    }


    const archiveResults =
      await Promise.all(

        datesToLoad.map(async date => {

          try {

            const response = await fetch(
              `data/archive/${date}.json?v=${Date.now()}`,
              {
                cache: "no-store"
              }
            );


            if (!response.ok) {
              return null;
            }


            return await response.json();

          } catch (error) {

            console.warn(
              `Unable to load archive ${date}`,
              error
            );

            return null;
          }
        })
      );


    /*
       A story can appear on several archive days.
       Keep one copy, preferring the higher ranking.
    */

    const storyMap = new Map();


    archiveResults
      .filter(Boolean)
      .flatMap(
        archive =>
          Array.isArray(archive.stories)
            ? archive.stories
            : []
      )
      .forEach(story => {

        const existing =
          storyMap.get(story.id);


        if (
          !existing ||
          Number(existing.score || 0) <
          Number(story.score || 0)
        ) {
          storyMap.set(
            story.id,
            story
          );
        }
      });


    DATA = {
      stories: [...storyMap.values()],
      source_status: []
    };


    if ($("#healthy")) {
      $("#healthy").textContent = "—";
    }


    setStatus(
      `Archive ${fromISO} → ${toISO}`
    );


    renderStories();

  } catch (error) {

    console.error(
      "Unable to load historical data:",
      error
    );


    setStatus(
      "Historical archive unavailable"
    );
  }
}


/* =========================================================
   DATE FILTER
   ========================================================= */

const dateFilter =
  $("#date");


if (dateFilter) {

  dateFilter.addEventListener(
    "change",
    event => {

      const value =
        event.target.value;


      const custom =
        value === "custom";


      if ($("#from")) {
        $("#from").hidden =
          !custom;
      }


      if ($("#to")) {
        $("#to").hidden =
          !custom;
      }


      if (value === "latest") {

        loadLatest();

        return;
      }


      if (!custom) {

        loadDateRange(
          Number(value)
        );
      }
    }
  );
}


/* =========================================================
   CUSTOM DATE RANGE
   ========================================================= */

["from", "to"].forEach(id => {

  const input =
    $("#" + id);


  if (!input) return;


  input.addEventListener(
    "change",
    () => {

      const from =
        $("#from")?.value;

      const to =
        $("#to")?.value;


      if (from && to) {

        loadDateRange(
          1,
          true
        );
      }
    }
  );
});


/* =========================================================
   INDUSTRY TABS
   ========================================================= */

const tabContainer =
  $("#tabs");


if (tabContainer) {

  tabContainer.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-industry]"
        );


      if (!button) return;


      activeIndustry =
        button.dataset.industry;


      renderStories();
    }
  );
}


/* =========================================================
   SEARCH / FILTER EVENTS
   ========================================================= */

["q", "pivot", "geo", "score"]
  .forEach(id => {

    const element =
      $("#" + id);


    if (!element) return;


    element.addEventListener(
      id === "q"
        ? "input"
        : "change",

      renderStories
    );
  });


/* =========================================================
   HELPERS
   ========================================================= */

function setStatus(text) {

  if ($("#updated")) {
    $("#updated").textContent =
      text;
  }
}


function toISODate(date) {

  return date
    .toISOString()
    .slice(0, 10);
}


function formatPublicationDate(value) {

  if (!value) return "";


  const date =
    new Date(value);


  if (Number.isNaN(date.getTime())) {
    return value;
  }


  return date.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

  return escapeHtml(value);
}


/* =========================================================
   START APPLICATION
   ========================================================= */

renderTabs();

loadLatest();
