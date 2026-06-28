import { NextResponse } from 'next/server';

export const maxDuration = 60;

// -------------------------------------------------------------------
// Helper: extract company + job title directly from a careers URL.
// Works for the vast majority of company career pages:
//   openai.com/careers/account-director-mid-market-sydney-australia/
//   stripe.com/jobs/listing/software-engineer/
//   vercel.com/careers/frontend-engineer
// -------------------------------------------------------------------
function extractFromUrl(url: string): { company: string | null; title: string | null } {
  try {
    const parsed = new URL(url);

    // Company: derive from domain root (openai.com → OpenAI)
    const hostname = parsed.hostname.replace(/^www\./, '');
    const domainRoot = hostname.split('.')[0];
    const company = domainRoot.charAt(0).toUpperCase() + domainRoot.slice(1);

    // Job title: find the slug right after a known careers path segment
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const careerKeywords = ['careers', 'jobs', 'job', 'positions', 'openings', 'posting', 'listings', 'listing'];
    let titleSlug: string | null = null;

    for (let i = 0; i < pathParts.length; i++) {
      if (careerKeywords.includes(pathParts[i].toLowerCase()) && pathParts[i + 1]) {
        titleSlug = pathParts[i + 1];
        break;
      }
    }

    // Convert kebab-case slug → Title Case
    const title = titleSlug
      ? titleSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null;

    return { company, title };
  } catch {
    return { company: null, title: null };
  }
}

// -------------------------------------------------------------------
// Helper: get a human-readable domain from a URL for error messages
// -------------------------------------------------------------------
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'the website';
  }
}

export async function POST(req: Request) {
  try {
    const { jobUrl, manualCompany, manualTitle } = await req.json();

    const API_KEY = process.env.ANAKIN_API_KEY;
    if (!API_KEY) return NextResponse.json({ error: "API key is missing" }, { status: 500 });

    let companyName: string | null = manualCompany || null;
    let jobTitle: string = manualTitle || 'Unknown Role';
    let postedDate = '';
    let skipAgeCheck = !!manualCompany; // true when we don't have a real scraped date

    // ---------- 1. AUTO-SCRAPE (IF URL PROVIDED) ----------
    if (jobUrl && !manualCompany) {
      let scrapeSucceeded = false;

      // --- 1a. Submit scrape job ---
      const submitResponse = await fetch('https://api.anakin.io/v1/url-scraper', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl, country: 'us', useBrowser: true, generateJson: true })
      });

      if (submitResponse.ok) {
        const { jobId } = await submitResponse.json();

        if (jobId) {
          // --- 1b. Poll for result ---
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const poll = await fetch(`https://api.anakin.io/v1/url-scraper/${jobId}`, {
              headers: { 'X-API-Key': API_KEY }
            });
            const pollData = await poll.json();

            if (pollData.status === 'completed' || pollData.status === 'succeeded') {
              const jobData = pollData.data || pollData.result;
              if (jobData && Object.keys(jobData).length > 0) {
                // Broad field aliases — different scrapers return different keys
                companyName =
                  jobData.company_name ||
                  jobData.company ||
                  jobData.employer ||
                  jobData.organization ||
                  null;
                postedDate =
                  jobData.posted_date ||
                  jobData.date ||
                  jobData.datePosted ||
                  jobData.postedAt ||
                  '';
                jobTitle =
                  jobData.job_title ||
                  jobData.title ||
                  jobData.position ||
                  jobData.name ||
                  'Unknown Role';
                scrapeSucceeded = true;
              }
              break; // done polling whether data was empty or not
            }

            // Don't throw on 'failed' — fall through to URL extraction below
            if (pollData.status === 'failed') break;
          }
        }
      }
      // submitResponse not ok → fall through to URL extraction below

      // --- 1c. URL extraction fallback ---
      // Runs when: scraper failed, returned empty data, or company still null after scrape
      if (!scrapeSucceeded || !companyName) {
        const extracted = extractFromUrl(jobUrl);

        if (extracted.company) {
          // Use whatever the scraper got, fill gaps with URL extraction
          companyName = companyName || extracted.company;
          if ((jobTitle === 'Unknown Role') && extracted.title) {
            jobTitle = extracted.title;
          }
          skipAgeCheck = true; // no real posted date — skip age scoring
        } else {
          // Can't extract anything useful → ask user for manual input
          const domain = getDomain(jobUrl);
          return NextResponse.json({
            error: "AUTH_BLOCK",
            message: `Could not automatically read job details from ${domain}. Please enter the company and title manually below to run the analysis!`
          }, { status: 422 });
        }
      }
    }

    // ---------- Sanity check ----------
    if (!companyName) {
      return NextResponse.json({
        jobTitle,
        company: 'Unknown',
        score: null,
        flags: ["Could not extract or locate a valid company name."],
        verdict: "Unable to analyze"
      });
    }

    // ---------- 2. WIRE: TECHCRUNCH ANALYSIS ----------
    async function runWireAction(actionId: string, params: Record<string, any>) {
      const submit = await fetch('https://api.anakin.io/v1/wire/task', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, params })
      });
      if (!submit.ok) {
        const err = await submit.json().catch(() => ({}));
        throw new Error(`Wire action ${actionId} rejected (${submit.status}): ${err.message || 'unknown'}`);
      }
      const { job_id: wireJobId } = await submit.json();
      if (!wireJobId) throw new Error(`No job_id from ${actionId}`);

      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(`https://api.anakin.io/v1/wire/jobs/${wireJobId}`, {
          headers: { 'X-API-Key': API_KEY! }
        });
        const pollJson = await poll.json();
        if (pollJson.status === 'completed') return pollJson.data;
        if (pollJson.status === 'failed') throw new Error(`${actionId} failed: ${pollJson.error?.message}`);
      }
      throw new Error(`${actionId} timed out`);
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const afterDate = oneYearAgo.toISOString().split('T')[0];

    const techcrunchData = await runWireAction('tc_search', {
      query: companyName, after: afterDate, limit: 5
    }).catch(e => { console.error('TechCrunch failed:', e.message); return null; });

    // ---------- 3. SCORING ----------
    let ghostScore = 0;
    const flags: string[] = [];

    // Posting age (only when we have a real scraped date)
    if (postedDate && !skipAgeCheck) {
      const posted = new Date(postedDate);
      const daysOld = isNaN(posted.getTime())
        ? null
        : Math.floor((Date.now() - posted.getTime()) / 86400000);

      if (daysOld !== null) {
        if (daysOld > 30) {
          ghostScore += 50;
          flags.push(`Posting is ${daysOld} days old — stale listing.`);
        } else {
          flags.push(`Posting is ${daysOld} days old — looks recent.`);
        }
      }
    } else {
      const ageNote = skipAgeCheck && !manualCompany
        ? "Posting age could not be verified (details auto-extracted from URL)."
        : "Posting age not provided — manual input mode.";
      flags.push(ageNote);
    }

    // TechCrunch coverage
    const tcArticles = techcrunchData?.data?.data ?? [];
    const tcTotal = techcrunchData?.data?.total ?? 0;

    if (!techcrunchData) {
      flags.push("Could not verify company news coverage right now.");
    } else if (tcTotal === 0) {
      ghostScore += 45;
      flags.push("No TechCrunch news coverage found for this company in the last 12 months.");
    } else {
      const mostRecent = tcArticles[0]?.published ? new Date(tcArticles[0].published) : null;
      const monthsSince = mostRecent
        ? (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24 * 30)
        : null;

      if (monthsSince !== null && monthsSince < 6) {
        flags.push(`${tcTotal} TechCrunch mention(s) found — most recent ${Math.round(monthsSince)} month(s) ago. Actively newsworthy.`);
      } else {
        ghostScore += 15;
        flags.push(`${tcTotal} TechCrunch mention(s) found, but nothing recent in the last 6 months.`);
      }
    }

    const verdict = ghostScore > 50
      ? "High Risk: This listing has strong indicators of a ghost job. Verify before applying."
      : "Low Risk: Company activity flags clear. Requisition appears valid!";

    return NextResponse.json({ jobTitle, company: companyName, score: ghostScore, flags, verdict });

  } catch (error: any) {
    console.error("Error in analyze API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}