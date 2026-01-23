// ------------------- Variable Declarations -------------------
const jobsList = document.getElementById('jobsList');
const resultsCount = document.getElementById('resultsCount');

// Layout Containers
const listViewContainer = document.getElementById('listViewContainer');
const jobDetailView = document.getElementById('jobDetailView');

// Filter Containers (Desktop)
const companyOptions = document.getElementById('companyOptions');
const departmentOptions = document.getElementById('departmentOptions');
const locationOptions = document.getElementById('locationOptions');
const typeOptions = document.getElementById('typeOptions');

// Filter Containers (Mobile Drawer)
const companyOptionsDrawer = document.getElementById('companyOptionsDrawer');
const departmentOptionsDrawer = document.getElementById('departmentOptionsDrawer');
const locationOptionsDrawer = document.getElementById('locationOptionsDrawer');
const typeOptionsDrawer = document.getElementById('typeOptionsDrawer');

// UI Navigation & Buttons
const openFilters = document.getElementById('openFilters');
const drawer = document.getElementById('drawer');
const backdrop = document.getElementById('backdrop');
const closeDrawer = document.getElementById('closeDrawer');
const applyDrawer = document.getElementById('applyDrawer');
const clearDrawer = document.getElementById('clearDrawer');
const applyFilters = document.getElementById('applyFilters');
const clearAll = document.getElementById('clearAll');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const sidebar = document.getElementById('sidebar');
const activeFilters = document.getElementById('activeFilters');

// Detail View Elements
const backToJobs = document.getElementById('backToJobs');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');
const detailTitle = document.getElementById('detailTitle');
const detailCompany = document.getElementById('detailCompany');
const detailPosted = document.getElementById('detailPosted');
const detailDescription = document.getElementById('detailDescription');
const detailLocation = document.getElementById('detailLocation');
const detailDept = document.getElementById('detailDept');
const detailSalary = document.getElementById('detailSalary');
const detailType = document.getElementById('detailType');
const detailCount = document.getElementById('detailCount');
const detailEmpty = document.getElementById('detailEmpty');

let jobsData = [];

// ------------------- Helper Functions -------------------
function unique(arr, key) {
  return Array.from(new Set(arr.map(a => a[key]).filter(val => val && val !== ""))).sort();
}

function getPrimaryFilterContainer() {
  return sidebar || drawer;
}

/**
 * Updated to handle Seconds, Minutes, Hours, Days, and Weeks
 * Accepts either a Date string or a number (days)
 */
function formatPosted(value) {
  if (value === undefined || value === null) return 'Just now';

  let diffInSeconds;

  // Check if value is a number (your current postedDays logic)
  if (typeof value === 'number') {
    if (value <= 0) return 'Today';
    diffInSeconds = value * 86400; // Convert days to seconds
  } else {
    // If it's a date string/timestamp
    const now = new Date();
    const posted = new Date(value);
    diffInSeconds = Math.floor((now - posted) / 1000);
  }

  if (diffInSeconds < 1) return 'Just now';

  // Seconds
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  // Minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  // Hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  // Days
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  // Weeks
  const diffInWeeks = Math.ceil(diffInDays / 7);
  return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(value) {
  if (!value || typeof value !== 'string') return '';
  if (!/[<>]/.test(value)) return '';

  const allowedTags = new Set(['A', 'BR', 'P', 'B', 'STRONG', 'EM', 'I', 'UL', 'OL', 'LI']);
  const template = document.createElement('template');
  template.innerHTML = value;

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toUpperCase();
        if (!allowedTags.has(tag)) {
          const text = document.createTextNode(child.textContent || '');
          child.replaceWith(text);
          return;
        }
        if (tag === 'A') {
          const href = child.getAttribute('href') || '';
          if (!href.startsWith('http://') && !href.startsWith('https://')) {
            child.replaceWith(document.createTextNode(child.textContent || ''));
            return;
          }
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        } else {
          Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
        }
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    });
  };

  walk(template.content);
  return template.innerHTML.trim();
}

function stripTags(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toDateISO(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function buildJobPostingSchema(list) {
  const origin = window.location.origin || '';
  const path = window.location.pathname || '';
  const baseUrl = `${origin}${path}`;

  const postings = list.map(job => {
    const title = job.title || job.job_title || 'Job Opening';
    const company = job.company || 'QC & MC';
    const identifierValue = job.name || job.id || title;
    const description = stripTags(job.description || job.job_description || '') || `${title} role at ${company}.`;
    const datePosted = toDateISO(job.posting_date || job.posted_on || job.date_posted);
    const location = job.location || 'Philippines';
    const employmentType = job.employment_type || 'Full-time';

    const schema = {
      "@type": "JobPosting",
      "title": title,
      "description": description,
      "employmentType": employmentType,
      "hiringOrganization": {
        "@type": "Organization",
        "name": company,
        "sameAs": origin
      },
      "jobLocation": {
        "@type": "Place",
        "address": location
      },
      "identifier": {
        "@type": "PropertyValue",
        "name": "Job Opening",
        "value": identifierValue
      },
      "url": identifierValue ? `${baseUrl}#job-${encodeURIComponent(identifierValue)}` : baseUrl
    };

    if (datePosted) schema.datePosted = datePosted;
    return schema;
  });

  return {
    "@context": "https://schema.org",
    "@graph": postings
  };
}

function updateJobPostingSchema(list) {
  const script = document.getElementById('jobPostingSchema');
  if (!script) return;
  const schema = buildJobPostingSchema(list || []);
  script.textContent = JSON.stringify(schema);
}

// ------------------- Render Options (Dynamic Filters with Counts) -------------------
function renderOptions() {
  const comps = unique(jobsData, 'company');
  const depts = unique(jobsData, 'department');
  const locs  = unique(jobsData, 'location');
  const types = unique(jobsData, 'employment_type');
  
  const generateCheckboxHTML = (list, name, dataKey) => {
    return list.map(val => {
      const safeVal = escapeHtml(val);
      const count = jobsData.filter(j => j[dataKey] === val).length;
      return `
        <label class="opt">
          <input type="checkbox" name="${name}" value="${safeVal}"/> 
          ${safeVal} <span class="filter-count">(${count})</span>
        </label>
      `;
    }).join('');
  };

  if(companyOptions) companyOptions.innerHTML = generateCheckboxHTML(comps, 'company', 'company');
  if(departmentOptions) departmentOptions.innerHTML = generateCheckboxHTML(depts, 'department', 'department');
  if(locationOptions) locationOptions.innerHTML = generateCheckboxHTML(locs, 'location', 'location');
  if(typeOptions) typeOptions.innerHTML = generateCheckboxHTML(types, 'employment_type', 'employment_type');
  
  if(companyOptionsDrawer) companyOptionsDrawer.innerHTML = generateCheckboxHTML(comps, 'company', 'company');
  if(departmentOptionsDrawer) departmentOptionsDrawer.innerHTML = generateCheckboxHTML(depts, 'department', 'department');
  if(locationOptionsDrawer) locationOptionsDrawer.innerHTML = generateCheckboxHTML(locs, 'location', 'location');
  if(typeOptionsDrawer) typeOptionsDrawer.innerHTML = generateCheckboxHTML(types, 'employment_type', 'employment_type');

  if (sidebar) {
    sidebar.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => applyFrom(sidebar));
    });
  }
}

// ------------------- Render Job List (Replaced Alert with Detail View) -------------------
function renderList(list) {
  resultsCount.textContent = `Showing ${list.length} result${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    jobsList.innerHTML = `<div style="padding: 2rem; text-align: center; color: #666;"><p>No job openings found.</p></div>`;
    return;
  }

  jobsList.innerHTML = ''; 

  list.forEach(j => {
    const card = document.createElement('article');
    card.className = 'job-card';
    card.style.cursor = 'pointer';

    const title = escapeHtml(j.title || 'N/A');
    const type = escapeHtml(j.employment_type || 'Full-time');
    const company = escapeHtml(j.company || 'N/A');
    const location = escapeHtml(j.location || 'N/A');
    const department = escapeHtml(j.department || 'N/A');
    const salary = escapeHtml(j.salary || 'N/A');
    
    card.innerHTML = `
        <div class="job-card-body">
          <div class="job-main">
            <div class="job-header">
                <h3 class="job-title">${title}</h3>
                <span class="type-badge">${type}</span>
            </div>
            
            <div class="job-company-row">
                <span class="company-name">${company}</span>
                <span class="dot">&middot;</span>
                <span class="posted-date">${formatPosted(j.postedDays)}</span>
            </div>

            <div class="job-meta">
                <div class="detail-item">
                    <span class="icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </span>
                    <span>${location}</span> 
                </div>

                <div class="detail-item">
                    <span class="icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="6" y1="3" x2="6" y2="15"></line>
                            <circle cx="18" cy="6" r="3"></circle>
                            <circle cx="6" cy="18" r="3"></circle>
                            <path d="M18 9a9 9 0 0 1-9 9"></path>
                        </svg>
                    </span>
                    <span>${department}</span>
                </div>

                <div class="detail-item">
                    <span class="icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                        </svg>
                    </span>
                    <span>${salary}</span>
                </div>
            </div>
          </div>
          <div class="job-side"></div>
        </div>

        <div class="job-card-footer">
          <span>Applications received: <strong>${j.applicants || 0}</strong></span>
        </div>
    `;

    card.addEventListener('click', () => showJobDetail(j));
    jobsList.appendChild(card);
  });
}

// ------------------- Filtering Engine (Retained) -------------------
function selectedValues(container, name) {
  return Array.from(container.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
}

function applyFrom(container) {
  const comps  = selectedValues(container, 'company');
  const depts  = selectedValues(container, 'department');
  const locs   = selectedValues(container, 'location');
  const types  = selectedValues(container, 'employment_type');
  
  const postingName = container === drawer ? 'postingDrawer' : 'posting';
  const posting = (container.querySelector(`input[name="${postingName}"]:checked`) || {value: 'any'}).value;

  let filtered = jobsData.slice();

  if (comps.length) filtered = filtered.filter(j => comps.includes(j.company));
  if (depts.length) filtered = filtered.filter(j => depts.includes(j.department));
  if (locs.length)  filtered = filtered.filter(j => locs.includes(j.location));
  if (types.length) filtered = filtered.filter(j => types.includes(j.employment_type));

  if (posting !== 'any') {
    filtered = filtered.filter(j => j.postedDays <= Number(posting));
  }

  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(j => 
      (j.title || '').toLowerCase().includes(query) ||
      (j.company || '').toLowerCase().includes(query) ||
      (j.department || '').toLowerCase().includes(query)
    );
  }

  renderList(filtered);

  const activeCount = comps.length + depts.length + locs.length + types.length + (posting !== 'any' ? 1 : 0);
  activeFilters.textContent = activeCount ? `${activeCount} active filter${activeCount > 1 ? 's' : ''}` : 'Filters';

  if (container === drawer) closeDrawerFn();
}

// ------------------- Drawer Controls (Retained) -------------------
function openDrawer() {
  drawer.classList.add('open');
  backdrop.classList.add('active');
}

function closeDrawerFn() {
  drawer.classList.remove('open');
  backdrop.classList.remove('active');
}

// ------------------- Event Listeners (Retained) -------------------
if (applyFilters) {
  applyFilters.addEventListener('click', () => applyFrom(sidebar));
}
applyDrawer.addEventListener('click', () => applyFrom(drawer));

if (clearAll && sidebar) {
  clearAll.addEventListener('click', () => {
    sidebar.querySelectorAll('input').forEach(i => i.checked = false);
    const any = sidebar.querySelector('input[name="posting"][value="any"]');
    if (any) any.checked = true;
    applyFrom(sidebar);
  });
}

clearDrawer.addEventListener('click', () => {
  drawer.querySelectorAll('input').forEach(i => i.checked = false);
  const any = drawer.querySelector('input[name="postingDrawer"][value="any"]');
  if (any) any.checked = true;
  applyFrom(drawer);
});

openFilters.addEventListener('click', openDrawer);
closeDrawer.addEventListener('click', closeDrawerFn);
backdrop.addEventListener('click', closeDrawerFn);

searchInput.addEventListener('input', () => applyFrom(getPrimaryFilterContainer()));
clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  applyFrom(getPrimaryFilterContainer());
});

// ------------------- Data Fetching (Retained) -------------------
async function fetchJobs() {
  try {
    const [jobsRes, countsRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/job-applicant-counts")
    ]);

    const jobsJson = await jobsRes.json();
    const countsJson = await countsRes.json();

    const jobs = jobsJson.message || [];
    const counts = countsJson.message || {};

    jobsData = jobs.map(j => ({
      ...j,
      applicants: counts[j.name] || 0
    }));

    renderOptions();
    renderList(jobsData);
    updateJobPostingSchema(jobsData);

    handleRouting();

  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    jobsList.innerHTML = "<p style='color:red; text-align:center;'>Error loading jobs. Please try again later.</p>";
  }
}

fetchJobs();


// ------------------- Navigation & Routing Logic (NEW) -------------------

/**
 * Checks the URL hash on page load or refresh.
 * If a hash exists (e.g., #job-J101), it opens that specific job detail.
 */
// Global variable to hold the currently viewed job object
let currentJob = null;

function handleRouting() {
    const hash = window.location.hash;
    
    if (hash && hash.startsWith('#job-')) {
        const jobId = hash.replace('#job-', '');
        const job = jobsData.find(j => String(j.name) === jobId || String(j.id) === jobId);
        
        if (job) {
            showJobDetail(job, true);
        } else {
            showListView();
        }
    } else {
        showListView();
    }
}

function showListView() {
    currentJob = null; // Clear active job
    if (jobDetailView) jobDetailView.style.display = 'none';
    if (detailEmpty) detailEmpty.style.display = 'block';
    if (listViewContainer) {
        const isDesktop = window.matchMedia('(min-width: 901px)').matches;
        listViewContainer.classList.remove('detail-open', 'detail-only');
        listViewContainer.classList.toggle('detail-ready', isDesktop);
        listViewContainer.style.display = 'block';
    }
}

function showJobDetail(job, isFromRouting = false) {
    // Store the job object globally for the Apply button to use
    currentJob = job;

    window.location.hash = `job-${job.name || job.id}`;

    if (detailEmpty) detailEmpty.style.display = 'none';
    if (listViewContainer) {
        const isDesktop = window.matchMedia('(min-width: 901px)').matches;
        listViewContainer.style.display = 'block';
        listViewContainer.classList.add('detail-open');
        listViewContainer.classList.remove('detail-ready');
        listViewContainer.classList.toggle('detail-only', !isDesktop);
    }
    if (jobDetailView) jobDetailView.style.display = 'block';
    
    if (!isFromRouting) window.scrollTo(0, 0);

    // Update UI elements
    breadcrumbTitle.textContent = job.title;
    detailTitle.textContent = job.title;
    detailCompany.textContent = job.company;
    detailPosted.textContent = formatPosted(job.postedDays);
    detailLocation.textContent = job.location || 'N/A';
    detailDept.textContent = job.department || 'N/A';
    detailSalary.textContent = job.salary || 'N/A';
    detailType.textContent = job.employment_type || 'Full-time';
    detailCount.textContent = job.applicants || '0';
    
    const safeDescription = sanitizeHtml(job.description || '');
    detailDescription.innerHTML = safeDescription || '<p>No description provided.</p>';
}

// ------------------- Navigation Events -------------------

if (backToJobs) {
    backToJobs.addEventListener('click', () => {
        window.location.hash = '';
        showListView();
    });
}

// THE APPLY BUTTON LOGIC
// We use currentJob to pass the correct ID and Title to the application page
const applyBtn = document.querySelector('.apply-btn-large');
if (applyBtn) {
    applyBtn.addEventListener('click', () => {
        if (currentJob) {
            const title = encodeURIComponent(currentJob.title);
            const id = encodeURIComponent(currentJob.name || currentJob.id);
            window.location.href = `apply_now.html?job=${title}&id=${id}`;
        }
    });
}

// ------------------- Event Initialization -------------------

// Listen for the hash change (helps with back/forward browser buttons)
window.addEventListener('hashchange', handleRouting);

window.addEventListener('resize', () => {
    if (!listViewContainer) return;
    const isDesktop = window.matchMedia('(min-width: 901px)').matches;
    if (currentJob) {
        listViewContainer.classList.toggle('detail-only', !isDesktop);
    } else {
        listViewContainer.classList.toggle('detail-ready', isDesktop);
        listViewContainer.classList.remove('detail-only');
    }
});

// Call routing on initial load
window.addEventListener('load', handleRouting);
